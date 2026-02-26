"""
Background task service for managing agent workflows and autonomous operations.
"""

import asyncio
import datetime
import os
import uuid
from typing import Any

from backend.agents.workflow import create_workflow
from backend.api.helpers import parse_iso
from backend.api.trends_utils import (
    derive_source_breakdown,
    estimate_live_progress,
    task_runtime_alerts,
)
from backend.database.repository import Repository
from backend.services.ai_service import ai_service
from backend.services.attestation_service import attestation_service
from backend.services.chainlink_service import chainlink_service
from shared.models import QueryStatus


class BackgroundTaskService:
    """Service for managing background tasks like workflows, sentinel, and reapers."""

    def __init__(self) -> None:
        self.repo = Repository()
        # Read-through cache for active tasks (Repository is source of truth)
        self._task_cache: dict[str, dict[str, Any]] = {}

    # =========================================================================
    # Task Cache Management
    # =========================================================================

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        """Get task from cache or Repository (source of truth)."""
        if task_id in self._task_cache:
            return self._task_cache[task_id]
        task = self.repo.get_task(task_id)
        if task:
            self._task_cache[task_id] = task
        return task

    def save_task(self, task_id: str, task: dict[str, Any]) -> None:
        """Save task to cache and Repository."""
        self._task_cache[task_id] = task
        self.repo.save_task(task_id, task)

    def update_task(self, task_id: str, updates: dict[str, Any]) -> None:
        """Update task fields in cache and Repository."""
        task = self.get_task(task_id)
        if task:
            task.update(updates)
            task["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.save_task(task_id, task)

    def mark_task_failed(
        self, task: dict[str, Any], reason: str, log_prefix: str = "❌"
    ) -> None:
        """Mark a task as failed with reason."""
        task_id = task.get("task_id")
        task["status"] = QueryStatus.FAILED
        task["error"] = reason
        logs = task.get("logs", [])
        logs.append(f"{log_prefix}: {reason}")
        task["logs"] = logs[-200:]
        task["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if task_id:
            self.save_task(task_id, task)

    def find_matching_active_task(
        self,
        topic: str,
        platforms: list[str],
        models: list[str],
        augmentation: dict[str, str] | None = None,
    ) -> str | None:
        """Find an active task matching the parameters."""
        # Normalize inputs
        topic_norm = topic.strip().lower()
        platforms_set = set(platforms or [])
        models_set = set(models or [])

        for task_id, task in list(self._task_cache.items()):
            if task.get("status") not in {
                QueryStatus.PENDING,
                QueryStatus.PLANNING,
                QueryStatus.RESEARCHING,
                QueryStatus.PROCESSING,
                QueryStatus.ANALYZING,
            }:
                continue
            if task.get("topic", "").strip().lower() != topic_norm:
                continue
            if set(task.get("platforms", [])) != platforms_set:
                continue
            if set(task.get("models", [])) != models_set:
                continue
            if (task.get("augmentation") or {}) != (augmentation or {}):
                continue
            return task_id
        return None

    # =========================================================================
    # Agent Workflow
    # =========================================================================

    async def run_agent_workflow(
        self,
        task_id: str,
        topic: str,
        platforms: list[str],
        models: list[str],
        augmentation: dict[str, str] | None = None,
    ) -> None:
        """Run the agent workflow for a task."""
        workflow = create_workflow()
        initial_state: dict[str, Any] = {
            "topic": topic,
            "platforms": platforms,
            "models": models,
            "query_id": task_id,
            "status": QueryStatus.PENDING,
            "logs": ["Task initialized."],
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "raw_findings": [],
            "filtered_findings": [],
            "plan": None,
            "search_queries": [],
            "summary": None,
            "final_report_md": None,
            "relevance_score": 0.0,
            "impact_score": 0.0,
            "confidence_score": 0.0,
            "validation_results": [],
            "research_payload": None,
            "consensus_data": None,
            "attestation_data": None,
            "current_depth": 0,
            "max_depth": 2 if "tinyfish" in (platforms or []) or "web" in (platforms or []) else 1,
            "follow_up_directions": [],
            "retry_platforms": [],
            "attempted_query_keys": [],
            "augmentation": augmentation or {},
            "source_routes": [],
            "financial_intelligence": None,
            "error": None,
        }

        # Run the graph
        try:
            task = self.get_task(task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")

            async for output in workflow.astream(initial_state):  # type: ignore
                for node_name, state_update in output.items():
                    # Update the task state with the latest changes from the agent
                    for key, value in state_update.items():
                        task[key] = value

                    # Honor explicit terminal statuses from node output first.
                    explicit_status = state_update.get("status")
                    if explicit_status in [QueryStatus.COMPLETED, QueryStatus.FAILED]:
                        task["status"] = explicit_status
                    # Otherwise set an operational status based on the executing node.
                    elif node_name == "planner":
                        task["status"] = QueryStatus.RESEARCHING
                    elif node_name == "researcher":
                        task["status"] = QueryStatus.PROCESSING
                    elif node_name == "validator":
                        task["status"] = QueryStatus.ANALYZING
                    elif node_name == "financial_intelligence":
                        task["status"] = QueryStatus.ANALYZING
                    elif node_name == "analyzer":
                        task["status"] = QueryStatus.PROCESSING
                    elif node_name == "architect":
                        task["status"] = QueryStatus.COMPLETED

                    if node_name == "architect":
                        task["logs"].append("🏆 MISSION ACCOMPLISHED: Final results ready.")

                    task["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

                    consensus_data = task.get("consensus_data") or {}
                    attestation_data = task.get("attestation_data") or {}
                    created_dt = parse_iso(task.get("created_at"))
                    updated_dt = parse_iso(task.get("updated_at"))
                    duration_seconds = (
                        int((updated_dt - created_dt).total_seconds())
                        if created_dt and updated_dt
                        else 0
                    )
                    provider_failure_rate = self._provider_failure_rate(consensus_data)
                    guardrail_alerts = task_runtime_alerts(task)
                    merged_warnings = list(
                        dict.fromkeys((consensus_data.get("warnings", []) or []) + guardrail_alerts)
                    )
                    findings_count = len(task.get("raw_findings") or [])
                    quality_assessment = task.get("quality_assessment") or {}
                    data_sufficiency = "healthy"
                    if findings_count == 0:
                        data_sufficiency = "sparse"
                    elif findings_count < 5:
                        data_sufficiency = "partial"
                    if quality_assessment and not quality_assessment.get("passed", True):
                        data_sufficiency = "partial"
                    task["run_telemetry"] = {
                        "run_id": task_id,
                        "provider_count": len(consensus_data.get("providers", [])),
                        "agreement_score": consensus_data.get("agreement_score", 0.0),
                        "diversity_level": consensus_data.get("diversity_level", "low"),
                        "attestation_status": attestation_data.get("status", "pending"),
                        "data_sufficiency": data_sufficiency,
                        "findings_count": findings_count,
                        "warnings": merged_warnings,
                        "provider_failure_rate": provider_failure_rate,
                        "duration_seconds": duration_seconds,
                        "logs": task.get("logs", [])[-12:],
                        "updated_at": task["updated_at"],
                        "quality_gate": quality_assessment,
                        "source_routes": task.get("source_routes", []),
                        "source_breakdown": derive_source_breakdown(task.get("raw_findings") or []),
                    }

                    # Log the node completion
                    if "logs" not in task:
                        task["logs"] = []
                    task["logs"].append(f"Completed step: {node_name}")

                    # Persist update to Repository (source of truth)
                    self.save_task(task_id, task)
        except Exception as e:
            print(f"Workflow error for task {task_id}: {e}")
            task = self.get_task(task_id)
            if task:
                task["status"] = QueryStatus.FAILED
                task["error"] = str(e)
                task["logs"].append(f"❌ CRITICAL ERROR: {str(e)}")
                self.save_task(task_id, task)

    def _provider_failure_rate(self, consensus_data: dict[str, Any]) -> float:
        """Calculate provider failure rate from consensus data."""
        providers = consensus_data.get("providers", [])
        if not providers:
            return 0.0
        failed = sum(1 for p in providers if p.get("failed", False))
        return failed / len(providers)

    # =========================================================================
    # Agent Actions
    # =========================================================================

    async def run_agent_action(self, action_id: str) -> None:
        """Execute an agent action."""
        now = datetime.datetime.now(datetime.timezone.utc)
        self.repo.update_action(
            action_id,
            status="running",
            started_at=now,
        )

        action = self.repo.get_action(action_id)
        if not action:
            return

        action_type = action.get("action_type")
        task_id = action.get("task_id")
        input_payload = action.get("input_payload") or {}

        try:
            task = self.get_task(task_id) if task_id else None
            if task_id and not task:
                raise ValueError("Referenced task not found.")

            # Handle different action types
            result_payload = await self._execute_action(
                action_type, task_id, task, input_payload
            )

            self.repo.update_action(
                action_id,
                status="succeeded",
                result_payload=result_payload,
                completed_at=datetime.datetime.now(datetime.timezone.utc),
            )
        except Exception as exc:
            self.repo.update_action(
                action_id,
                status="failed",
                error=str(exc),
                completed_at=datetime.datetime.now(datetime.timezone.utc),
            )

    async def _execute_action(
        self,
        action_type: str | None,
        task_id: str | None,
        task: dict[str, Any] | None,
        input_payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a specific action type."""
        import os

        base_url = os.getenv("FRONTEND_URL", "https://trende.vercel.app")

        if action_type == "generate_alpha_manifest":
            if not task or task.get("status") != QueryStatus.COMPLETED:
                raise ValueError("Task must be completed before manifest generation.")
            data = task.get("research_payload", {}) or {}
            token = data.get("token", {})
            proof_url = f"{base_url}/meme/{task_id}"
            return {
                "manifest": {
                    "name": token.get("name"),
                    "symbol": token.get("ticker"),
                    "description": token.get("description", ""),
                    "website": proof_url,
                    "trende_proof_id": task_id,
                    "attestation": task.get("attestation_data"),
                },
                "status": "ready",
            }

        elif action_type == "draft_paragraph":
            if not task:
                raise ValueError("draft_paragraph requires task_id.")
            result_node = task.get("result") if isinstance(task.get("result"), dict) else task
            final_report = (
                result_node.get("final_report_md")
                if isinstance(result_node, dict)
                else task.get("final_report_md", "")
            ) or ""
            title = input_payload.get("title") or f"Trende Brief: {task.get('topic', 'Analysis')}"
            return {
                "draft": {
                    "title": title,
                    "body_markdown": final_report[:12000],
                    "source_task_id": task_id,
                },
                "status": "ready",
            }

        elif action_type == "resolve_oracle_market":
            market_id = input_payload.get("market_id")
            if not market_id:
                raise ValueError("resolve_oracle_market requires market_id")
            if not chainlink_service.is_configured():
                raise RuntimeError("Chainlink service not configured")

            result = await chainlink_service.resolve_market(market_id)
            if task_id and task:
                task["oracle_resolved"] = True
                task["oracle_resolution_tx"] = result.get("transaction_hash")
                self.save_task(task_id, task)

            return {
                "market_id": market_id,
                "transaction_hash": result.get("transaction_hash"),
                "status": "resolved",
            }

        else:
            raise ValueError(f"Unknown action type: {action_type}")

    # =========================================================================
    # Sentinel Loop (Autonomous Oracle Resolution)
    # =========================================================================

    async def sentinel_loop(self) -> None:
        """
        Autonomous agent sentinel that scans for completed research where an oracle
        market has been staged but not yet resolved, then triggers resolution via
        Chainlink Functions without any human action.

        This is Trende's proof of genuine autonomy — the agent acts on its own.
        Poll interval: 90s (avoids hammering RPC, gives markets time to mature).
        """
        await asyncio.sleep(30)  # Initial grace period for server startup
        while True:
            try:
                await self.sentinel_tick()
            except Exception as exc:
                print(f"[SENTINEL] ⚠️ Tick error (non-fatal): {exc}")
            await asyncio.sleep(90)

    async def sentinel_tick(self) -> None:
        """Single sentinel evaluation cycle."""
        if not chainlink_service.is_configured():
            return  # Skip silently if Chainlink not configured

        # Find tasks with staged markets not yet resolved
        all_tasks = self.repo.get_all_tasks()
        eligible = [
            t for t in all_tasks
            if t.get("status") == QueryStatus.COMPLETED
            and t.get("oracle_market_id")
            and not t.get("oracle_resolved")
        ]

        if not eligible:
            return

        print(f"[SENTINEL] 🔍 Found {len(eligible)} task(s) eligible for oracle resolution.")

        for task in eligible[:3]:  # Process at most 3 per tick to avoid overloading
            task_id = task.get("task_id")
            market_id = task.get("oracle_market_id")

            # Check if a resolve action is already in flight
            existing_actions = self.repo.get_actions_for_task(task_id) if task_id else []
            already_resolving = any(
                a.get("action_type") == "resolve_oracle_market"
                and a.get("status") in ("queued", "running", "succeeded")
                for a in existing_actions
            )
            if already_resolving:
                continue

            print(f"[SENTINEL] ⚙️ Auto-resolving market {market_id} for task {task_id}")

            # Create a system-initiated resolve action
            action_id = str(uuid.uuid4())
            created = self.repo.create_action(
                action_id=action_id,
                action_type="resolve_oracle_market",
                task_id=task_id,
                caller_address="sentinel://auto",
                idempotency_key=f"sentinel-{task_id}-{market_id}",
                input_payload={"market_id": market_id, "source": "sentinel"},
            )
            if created:
                asyncio.create_task(self.run_agent_action(action_id))
                print(f"[SENTINEL] ✅ Dispatched resolution action {action_id} for market {market_id}")

    # =========================================================================
    # Stale Task Reaper
    # =========================================================================

    async def stale_task_reaper_loop(self) -> None:
        """Reap stale non-terminal tasks that were orphaned by restarts/deploys."""
        await asyncio.sleep(25)
        stale_after = max(120, int(os.getenv("STALE_TASK_TIMEOUT_SECS", "1800")))
        while True:
            try:
                now = datetime.datetime.now(datetime.timezone.utc)
                for item in self.repo.get_all_tasks(limit=300):
                    if item.get("status") not in {
                        QueryStatus.PENDING,
                        QueryStatus.PLANNING,
                        QueryStatus.RESEARCHING,
                        QueryStatus.PROCESSING,
                        QueryStatus.ANALYZING,
                    }:
                        continue
                    task_id = item.get("task_id")
                    if not task_id:
                        continue
                    full_task = self.get_task(task_id) or item
                    if not full_task:
                        continue
                    updated = parse_iso(full_task.get("updated_at")) or parse_iso(full_task.get("created_at"))
                    age_secs = int((now - updated).total_seconds()) if updated else stale_after + 1
                    if age_secs <= stale_after:
                        continue
                    self.mark_task_failed(
                        full_task,
                        f"Task auto-expired after {age_secs}s without terminal completion.",
                        log_prefix="⚠️ STALE REAPER",
                    )
            except Exception as exc:
                print(f"[STALE-REAPER] non-fatal error: {exc}")
            await asyncio.sleep(60)

    # =========================================================================
    # Resume Interrupted Tasks
    # =========================================================================

    async def resume_interrupted_tasks(self) -> None:
        """Resume non-terminal tasks from previous runs on startup."""
        # Only resume recent non-terminal tasks; expire stale ones.
        max_resume_age = max(60, int(os.getenv("TASK_RESUME_MAX_AGE_SECS", "1200")))
        now = datetime.datetime.now(datetime.timezone.utc)
        unfinished = [t for t in self.repo.get_all_tasks(limit=200) if t["status"] in {
            QueryStatus.PENDING,
            QueryStatus.PLANNING,
            QueryStatus.RESEARCHING,
            QueryStatus.PROCESSING,
            QueryStatus.ANALYZING,
        }]
        for t in unfinished:
            # Load full state
            full_task = self.repo.get_task(t["task_id"])
            if not full_task:
                continue
            updated = parse_iso(full_task.get("updated_at")) or parse_iso(full_task.get("created_at"))
            age_secs = int((now - updated).total_seconds()) if updated else max_resume_age + 1
            if age_secs > max_resume_age:
                self.mark_task_failed(
                    full_task,
                    f"Task expired on startup cleanup after {age_secs}s without terminal completion.",
                    log_prefix="⚠️ AUTO-EXPIRE",
                )
                continue
            self.save_task(t["task_id"], full_task)
            # Restart agent loop in background
            asyncio.create_task(
                self.run_agent_workflow(
                    t["task_id"],
                    full_task["topic"],
                    full_task.get("platforms", []),
                    full_task.get("models", []),
                    full_task.get("augmentation", {}),
                )
            )


# Singleton instance
background_service = BackgroundTaskService()
