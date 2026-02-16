"""
ACP Service - Virtuals Protocol Agent Commerce Protocol Integration

This service enables Trende to operate as a Provider Agent in the ACP ecosystem,
allowing other AI agents to purchase research services.
"""

import asyncio
import logging
import os
import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

from virtuals_acp.client import VirtualsACP
from virtuals_acp.contract_clients.contract_client_v2 import ACPContractClientV2
from virtuals_acp.configs.configs import BASE_MAINNET_ACP_X402_CONFIG_V2

from backend.agents.workflow import run_trend_analysis
from backend.database.repository import Repository

logger = logging.getLogger(__name__)


class ACPService:
    """
    Service for handling ACP (Agent Commerce Protocol) interactions.
    
    Trende operates as a Provider Agent, offering research services to other agents.
    """
    
    def __init__(self):
        """Initialize ACP service with configuration from environment."""
        self.repository = Repository()
        
        # ACP configuration
        self.enabled = os.getenv("ACP_ENABLED", "false").lower() == "true"
        self.agent_wallet_address = os.getenv("ACP_AGENT_WALLET_ADDRESS")
        self.wallet_private_key = os.getenv("ACP_WALLET_PRIVATE_KEY")
        self.entity_id = os.getenv("ACP_ENTITY_ID")
        self.service_price = float(os.getenv("ACP_SERVICE_PRICE", "10.0"))
        self.sla_seconds = int(os.getenv("ACP_SERVICE_SLA_SECONDS", "180"))
        
        # Job tracking
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        
        # Initialize ACP client if enabled
        self.acp_client: Optional[VirtualsACP] = None
        if self.enabled:
            self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the ACP client with contract configuration."""
        try:
            if not all([self.agent_wallet_address, self.wallet_private_key, self.entity_id]):
                logger.error("Missing required ACP configuration. Set ACP_AGENT_WALLET_ADDRESS, ACP_WALLET_PRIVATE_KEY, and ACP_ENTITY_ID")
                self.enabled = False
                return
            
            self.acp_client = VirtualsACP(
                acp_contract_clients=ACPContractClientV2(
                    wallet_private_key=self.wallet_private_key,
                    agent_wallet_address=self.agent_wallet_address,
                    entity_id=self.entity_id,
                    config=BASE_MAINNET_ACP_X402_CONFIG_V2,
                ),
                on_new_task=self._handle_new_task
            )
            
            logger.info(f"ACP Service initialized for agent {self.entity_id}")
            logger.info(f"Service price: ${self.service_price} USDC, SLA: {self.sla_seconds}s")
            
        except Exception as e:
            logger.error(f"Failed to initialize ACP client: {e}")
            self.enabled = False
    
    async def _handle_new_task(self, job_data: Dict[str, Any]):
        """
        Callback handler for new job requests from ACP.
        
        Args:
            job_data: Job request data from ACP network
        """
        try:
            job_id = job_data.get("job_id") or job_data.get("onchain_job_id")
            logger.info(f"Received new ACP job: {job_id}")
            
            # Validate job request
            validation_result = self._validate_job_request(job_data)
            if not validation_result["valid"]:
                logger.warning(f"Rejecting job {job_id}: {validation_result['reason']}")
                await self._reject_job(job_id, validation_result["reason"])
                return
            
            # Accept the job
            await self._accept_job(job_id, job_data)
            
            # Execute research asynchronously
            asyncio.create_task(self._execute_research_job(job_id, job_data))
            
        except Exception as e:
            logger.error(f"Error handling new task: {e}", exc_info=True)
    
    def _validate_job_request(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate incoming job request.
        
        Args:
            job_data: Job request data
            
        Returns:
            Dict with 'valid' boolean and 'reason' string
        """
        # Check if input is provided
        input_data = job_data.get("input") or job_data.get("service_requirement", {})
        if not input_data:
            return {"valid": False, "reason": "Missing input data"}
        
        # Check if query is provided
        query = input_data.get("query")
        if not query or not isinstance(query, str) or len(query.strip()) == 0:
            return {"valid": False, "reason": "Missing or invalid query parameter"}
        
        # Check price (if specified)
        max_price = job_data.get("max_price")
        if max_price is not None and float(max_price) < self.service_price:
            return {
                "valid": False,
                "reason": f"Price ${max_price} below minimum ${self.service_price}"
            }
        
        # Check deadline (if specified)
        deadline = job_data.get("deadline") or job_data.get("expired_at")
        if deadline:
            try:
                deadline_dt = datetime.datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                time_available = (deadline_dt - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
                if time_available < self.sla_seconds:
                    return {
                        "valid": False,
                        "reason": f"Insufficient time: {time_available}s < {self.sla_seconds}s SLA"
                    }
            except Exception as e:
                logger.warning(f"Could not parse deadline: {e}")
        
        return {"valid": True, "reason": ""}
    
    async def _accept_job(self, job_id: str, job_data: Dict[str, Any]):
        """
        Accept a job request.
        
        Args:
            job_id: ACP job identifier
            job_data: Job request data
        """
        try:
            # Generate internal task ID
            task_id = str(uuid4())
            
            # Store job info
            self.active_jobs[job_id] = {
                "task_id": task_id,
                "job_data": job_data,
                "status": "accepted",
                "accepted_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }
            
            # Respond to ACP
            memo_id = job_data.get("memo_id", 0)
            self.acp_client.respond_job(
                job_id=job_id,
                memo_id=memo_id,
                accept=True,
                reason="Job accepted. Research in progress."
            )
            
            logger.info(f"Accepted job {job_id}, internal task {task_id}")
            
        except Exception as e:
            logger.error(f"Error accepting job {job_id}: {e}", exc_info=True)
            raise
    
    async def _reject_job(self, job_id: str, reason: str):
        """
        Reject a job request.
        
        Args:
            job_id: ACP job identifier
            reason: Rejection reason
        """
        try:
            self.acp_client.respond_job(
                job_id=job_id,
                memo_id=0,
                accept=False,
                reason=reason
            )
            logger.info(f"Rejected job {job_id}: {reason}")
        except Exception as e:
            logger.error(f"Error rejecting job {job_id}: {e}", exc_info=True)
    
    async def _execute_research_job(self, job_id: str, job_data: Dict[str, Any]):
        """
        Execute the research job and deliver results.
        
        Args:
            job_id: ACP job identifier
            job_data: Job request data
        """
        try:
            job_info = self.active_jobs.get(job_id)
            if not job_info:
                logger.error(f"Job {job_id} not found in active jobs")
                return
            
            task_id = job_info["task_id"]
            input_data = job_data.get("input") or job_data.get("service_requirement", {})
            
            # Extract parameters
            query = input_data.get("query")
            platforms = input_data.get("platforms", ["twitter", "tiktok", "linkedin", "web"])
            
            logger.info(f"Starting research for job {job_id}: {query}")
            
            # Update status
            job_info["status"] = "processing"
            job_info["started_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            # Execute Trende research workflow
            result = await run_trend_analysis(
                idea=query,
                platforms=platforms,
                task_id=task_id,
                sponsor=None  # ACP jobs are paid via protocol
            )
            
            # Format deliverable for ACP
            deliverable = self._format_deliverable(result, task_id)
            
            # Deliver to ACP
            await self._deliver_job(job_id, deliverable)
            
            # Update status
            job_info["status"] = "delivered"
            job_info["completed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            job_info["result"] = deliverable
            
            logger.info(f"Successfully delivered job {job_id}")
            
        except Exception as e:
            logger.error(f"Error executing job {job_id}: {e}", exc_info=True)
            
            # Update status
            if job_id in self.active_jobs:
                self.active_jobs[job_id]["status"] = "failed"
                self.active_jobs[job_id]["error"] = str(e)
            
            # Optionally notify ACP of failure
            # (ACP will handle timeout if we don't deliver)
    
    def _format_deliverable(self, result: Dict[str, Any], task_id: str) -> Dict[str, Any]:
        """
        Format Trende research result into ACP deliverable format.
        
        Args:
            result: Trende research result
            task_id: Internal task identifier
            
        Returns:
            Formatted deliverable for ACP
        """
        summary = result.get("summary", {})
        attestation = summary.get("attestationData", {})
        
        return {
            "summary": summary.get("overview", "No summary available"),
            "attestation_id": attestation.get("attestation_id", ""),
            "proof_url": f"https://trende.famile.xyz/proof/{task_id}",
            "confidence_score": summary.get("confidenceScore", 0.0),
            "signature": attestation.get("signature", ""),
            "signer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "input_hash": attestation.get("input_hash", ""),
            "providers": attestation.get("payload", {}).get("providers", []),
            "method": attestation.get("method", "tee-attestation"),
            "generated_at": attestation.get("generated_at", ""),
            "metadata": {
                "task_id": task_id,
                "platforms_searched": result.get("query", {}).get("platforms", []),
                "total_items": sum(len(r.get("items", [])) for r in result.get("results", [])),
            }
        }
    
    async def _deliver_job(self, job_id: str, deliverable: Dict[str, Any]):
        """
        Deliver completed job to ACP.
        
        Args:
            job_id: ACP job identifier
            deliverable: Formatted deliverable data
        """
        try:
            self.acp_client.deliver_job(
                job_id=job_id,
                deliverable=deliverable
            )
            logger.info(f"Delivered job {job_id}")
        except Exception as e:
            logger.error(f"Error delivering job {job_id}: {e}", exc_info=True)
            raise
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get status of an active job.
        
        Args:
            job_id: ACP job identifier
            
        Returns:
            Job status dict or None if not found
        """
        return self.active_jobs.get(job_id)
    
    def get_active_jobs_count(self) -> int:
        """Get count of currently active jobs."""
        return len([j for j in self.active_jobs.values() if j["status"] in ["accepted", "processing"]])
    
    async def start_listening(self):
        """Start listening for ACP job requests."""
        if not self.enabled or not self.acp_client:
            logger.warning("ACP service not enabled or not initialized")
            return
        
        logger.info("Starting ACP job listener...")
        # The ACP client handles listening via websockets internally
        # Jobs will be routed to _handle_new_task callback


# Global instance
acp_service = ACPService()
