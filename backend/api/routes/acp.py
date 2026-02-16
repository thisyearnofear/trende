"""
ACP API Routes - Agent Commerce Protocol endpoints

These endpoints provide status and management for ACP integration.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from backend.services.acp_service import acp_service

router = APIRouter(prefix="/api/acp", tags=["acp"])


class ACPStatusResponse(BaseModel):
    """ACP service status response."""
    enabled: bool
    agent_wallet_address: Optional[str]
    entity_id: Optional[str]
    service_price: float
    sla_seconds: int
    active_jobs_count: int
    status: str


class ACPJobStatusResponse(BaseModel):
    """Individual job status response."""
    job_id: str
    task_id: str
    status: str
    accepted_at: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    error: Optional[str]


@router.get("/status", response_model=ACPStatusResponse)
async def get_acp_status() -> ACPStatusResponse:
    """
    Get ACP service status and configuration.
    
    Returns:
        ACP service status including configuration and active jobs count
    """
    return ACPStatusResponse(
        enabled=acp_service.enabled,
        agent_wallet_address=acp_service.agent_wallet_address,
        entity_id=acp_service.entity_id,
        service_price=acp_service.service_price,
        sla_seconds=acp_service.sla_seconds,
        active_jobs_count=acp_service.get_active_jobs_count(),
        status="operational" if acp_service.enabled else "disabled"
    )


@router.get("/jobs", response_model=List[ACPJobStatusResponse])
async def get_active_jobs() -> List[ACPJobStatusResponse]:
    """
    Get list of all active ACP jobs.
    
    Returns:
        List of active jobs with their status
    """
    jobs = []
    for job_id, job_info in acp_service.active_jobs.items():
        jobs.append(ACPJobStatusResponse(
            job_id=job_id,
            task_id=job_info["task_id"],
            status=job_info["status"],
            accepted_at=job_info.get("accepted_at"),
            started_at=job_info.get("started_at"),
            completed_at=job_info.get("completed_at"),
            error=job_info.get("error")
        ))
    return jobs


@router.get("/jobs/{job_id}", response_model=ACPJobStatusResponse)
async def get_job_status(job_id: str) -> ACPJobStatusResponse:
    """
    Get status of a specific ACP job.
    
    Args:
        job_id: ACP job identifier
        
    Returns:
        Job status details
        
    Raises:
        HTTPException: If job not found
    """
    job_info = acp_service.get_job_status(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    return ACPJobStatusResponse(
        job_id=job_id,
        task_id=job_info["task_id"],
        status=job_info["status"],
        accepted_at=job_info.get("accepted_at"),
        started_at=job_info.get("started_at"),
        completed_at=job_info.get("completed_at"),
        error=job_info.get("error")
    )


@router.post("/start")
async def start_acp_listener():
    """
    Start the ACP job listener.
    
    This endpoint starts listening for incoming job requests from the ACP network.
    
    Returns:
        Status message
    """
    if not acp_service.enabled:
        raise HTTPException(
            status_code=400,
            detail="ACP service is not enabled. Set ACP_ENABLED=true in environment."
        )
    
    await acp_service.start_listening()
    
    return {
        "status": "started",
        "message": "ACP job listener started successfully",
        "agent_id": acp_service.entity_id
    }


@router.get("/health")
async def acp_health_check():
    """
    Health check endpoint for ACP service.
    
    Returns:
        Health status
    """
    return {
        "status": "healthy" if acp_service.enabled else "disabled",
        "enabled": acp_service.enabled,
        "active_jobs": acp_service.get_active_jobs_count(),
        "service_price": acp_service.service_price,
        "sla_seconds": acp_service.sla_seconds
    }
