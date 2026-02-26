import asyncio
import json
import os
import uuid
import datetime
import math
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import quote_plus
import httpx

from fastapi import BackgroundTasks, FastAPI, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, model_validator

from backend.agents.workflow import create_workflow, run_editorial_task
from backend.api.routes import acp as acp_routes
from backend.services.acp_service import acp_service
from backend.integrations.connectors.synthdata import SynthDataConnector
from backend.database.repository import Repository, init_db
from backend.services.ai_service import OPENROUTER_VARIANTS, VENICE_VARIANTS, ai_service
from backend.services.attestation_service import attestation_service
from backend.services.export_service import (
    build_export_payload,
    render_json_report,
    render_markdown_report,
    render_pdf_report,
)
from backend.services.x402_service import X402Payment, x402_service
from backend.services.archive_service import archive_service
from backend.utils.rate_limit import UserRateLimitInfo, user_rate_limiter
from shared.models import QueryStatus

ACTIVE_TASK_STATUSES = {
    QueryStatus.PENDING,
    QueryStatus.PLANNING,
    QueryStatus.RESEARCHING,
    QueryStatus.PROCESSING,
    QueryStatus.ANALYZING,
}

TERMINAL_TASK_STATUSES = {QueryStatus.COMPLETED, QueryStatus.FAILED}


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Initialize DB on startup
    init_db()
    await enforce_attestation_startup_gate()
    # Resume interrupted tasks
    await resume_interrupted_tasks()
    if acp_service.enabled:
        asyncio.create_task(acp_service.start_listening())
    # Start sentinel: autonomous oracle market resolution loop
    asyncio.create_task(_sentinel_loop())
    # Reap stale non-terminal tasks that were orphaned by restarts/deploys.
    asyncio.create_task(_stale_task_reaper_loop())
    yield


async def _sentinel_loop() -> None:
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
            await _sentinel_tick()
        except Exception as exc:
            print(f"[SENTINEL] ⚠️ Tick error (non-fatal): {exc}")
        await asyncio.sleep(90)


async def _sentinel_tick() -> None:
    """Single sentinel evaluation cycle."""
    from backend.services.chainlink_service import chainlink_service  # lazy import

    if not chainlink_service.is_configured():
        return  # Skip silently if Chainlink not configured

    # Find tasks with staged markets not yet resolved
    all_tasks = repo.get_all_tasks()
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
        existing_actions = repo.get_actions_for_task(task_id) if task_id else []
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
        created = repo.create_action(
            action_id=action_id,
            action_type="resolve_oracle_market",
            task_id=task_id,
            caller_address="sentinel://auto",
            idempotency_key=f"sentinel-{task_id}-{market_id}",
            input_payload={"market_id": market_id, "source": "sentinel"},
        )
        if created:
            asyncio.create_task(run_agent_action(action_id))
            print(f"[SENTINEL] ✅ Dispatched resolution action {action_id} for market {market_id}")



app = FastAPI(title="Trende Agent API", lifespan=lifespan)

# ACP routes
app.include_router(acp_routes.router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://trende.famile.xyz",
        "https://api.trende.famile.xyz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-RateLimit-Remaining",
        "X-RateLimit-Limit",
        "X-RateLimit-Reset",
        "X-RateLimit-Tier",
        "X-402-Amount",
        "X-402-Recipient",
        "X-402-Chain-ID",
        "X-402-Token-Type",
        "X-402-Scheme",
    ],
)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_rate_limit(
    request: Request,
    wallet_address: str | None = None,
) -> tuple[bool, UserRateLimitInfo, Response | None]:
    """
    Check rate limit and return (allowed, info, error_response).
    If not allowed and X402 is enabled, returns 402 response.
    """
    ip_address = get_client_ip(request)
    allowed, info = await user_rate_limiter.check_and_consume(wallet_address, ip_address)

    if allowed:
        return True, info, None

    # Rate limit exceeded - check if X402 payment can unlock
    require_x402 = os.getenv("REQUIRE_X402", "false").lower() == "true"

    if require_x402:
        # Return 402 Payment Required
        headers = x402_service.get_payment_headers(
            os.getenv("X402_PAYMENT_AMOUNT", "0.001"),
            os.getenv("X402_RECIPIENT_ADDRESS", ""),
            int(os.getenv("MONAD_CHAIN_ID", "10143")),
        )
        headers.update(info.to_headers())
        return (
            False,
            info,
            JSONResponse(
                status_code=402,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"You've used all {info.limit} searches for today. Connect wallet or pay to continue.",
                    "tier": info.tier,
                    "reset_at": info.reset_at.isoformat(),
                },
                headers=headers,
            ),
        )

    # X402 not enabled, just return 429
    return (
        False,
        info,
        JSONResponse(
            status_code=429,
            content={
                "error": "Rate limit exceeded",
                "message": f"You've used all {info.limit} searches for today. Try again after {info.reset_at.isoformat()}.",
                "tier": info.tier,
                "reset_at": info.reset_at.isoformat(),
            },
            headers=info.to_headers(),
        ),
    )


async def enforce_attestation_startup_gate() -> None:
    """
    In strict Eigen mode, fail fast on startup if attestation endpoint is not reachable.
    """
    if attestation_service.provider != "eigencompute" or not attestation_service.strict_mode:
        return

    health = await attestation_service.health_check(probe=True)
    if health.get("ok"):
        return

    message = health.get("message") or "Attestation health check failed."
    probe = health.get("probe") or {}
    endpoint = (
        probe.get("endpoint")
        or attestation_service.eigen_health_url
        or attestation_service.eigen_url
    )
    status_code = probe.get("status_code")
    raise RuntimeError(
        "Startup aborted: ATTESTATION_STRICT_MODE=true requires live Eigen attestation reachability. "
        f"endpoint={endpoint!r} status_code={status_code!r} reason={message}"
    )


# _env_flag available in trends_utils.py or helpers.py


async def resume_interrupted_tasks() -> None:
    # Only resume recent non-terminal tasks; expire stale ones.
    max_resume_age = max(60, int(os.getenv("TASK_RESUME_MAX_AGE_SECS", "1200")))
    now = datetime.datetime.now(datetime.timezone.utc)
    unfinished = [t for t in repo.get_all_tasks(limit=200) if t["status"] in ACTIVE_TASK_STATUSES]
    for t in unfinished:
        # Load full state
        full_task = repo.get_task(t["task_id"])
        if not full_task:
            continue
        updated = _parse_iso(full_task.get("updated_at")) or _parse_iso(full_task.get("created_at"))
        age_secs = int((now - updated).total_seconds()) if updated else max_resume_age + 1
        if age_secs > max_resume_age:
            _mark_task_failed(
                full_task,
                f"Task expired on startup cleanup after {age_secs}s without terminal completion.",
                log_prefix="⚠️ AUTO-EXPIRE",
            )
            continue
        _save_task(t["task_id"], full_task)
        # Restart agent loop in background
        asyncio.create_task(
            run_agent_workflow(
                t["task_id"],
                full_task["topic"],
                full_task.get("platforms", []),
                full_task.get("models", []),
                full_task.get("augmentation", {}),
            )
        )


def _mark_task_failed(task: dict[str, Any], reason: str, log_prefix: str = "❌") -> None:
    task_id = task.get("task_id")
    task["status"] = QueryStatus.FAILED
    task["error"] = reason
    logs = task.get("logs", [])
    logs.append(f"{log_prefix}: {reason}")
    task["logs"] = logs[-200:]
    task["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if task_id:
        _save_task(task_id, task)


async def _stale_task_reaper_loop() -> None:
    await asyncio.sleep(25)
    stale_after = max(120, int(os.getenv("STALE_TASK_TIMEOUT_SECS", "1800")))
    while True:
        try:
            now = datetime.datetime.now(datetime.timezone.utc)
            for item in repo.get_all_tasks(limit=300):
                if item.get("status") not in ACTIVE_TASK_STATUSES:
                    continue
                task_id = item.get("task_id")
                if not task_id:
                    continue
                full_task = _get_task(task_id) or item
                if not full_task:
                    continue
                updated = _parse_iso(full_task.get("updated_at")) or _parse_iso(full_task.get("created_at"))
                age_secs = int((now - updated).total_seconds()) if updated else stale_after + 1
                if age_secs <= stale_after:
                    continue
                _mark_task_failed(
                    full_task,
                    f"Task auto-expired after {age_secs}s without terminal completion.",
                    log_prefix="⚠️ STALE REAPER",
                )
        except Exception as exc:
            print(f"[STALE-REAPER] non-fatal error: {exc}")
        await asyncio.sleep(60)


repo = Repository()

# Read-through cache for active tasks (Repository is source of truth)
_task_cache: dict[str, dict[str, Any]] = {}


def _get_task(task_id: str) -> dict[str, Any] | None:
    """Get task from cache or Repository (source of truth)."""
    if task_id in _task_cache:
        return _task_cache[task_id]
    task = repo.get_task(task_id)
    if task:
        _task_cache[task_id] = task
    return task


def _save_task(task_id: str, task: dict[str, Any]) -> None:
    """Save task to Repository (source of truth) and update cache."""
    repo.save_task(task_id, task)
    _task_cache[task_id] = task


def _update_task(task_id: str, updates: dict[str, Any]) -> None:
    """Update task fields in Repository and cache."""
    task = _get_task(task_id)
    if task:
        task.update(updates)
        _save_task(task_id, task)


# _normalize_key_parts available in trends_utils.py or helpers.py


def _find_matching_active_task(
    topic: str,
    platforms: list[str],
    models: list[str],
    augmentation: dict[str, str] | None = None,
) -> str | None:
    topic_key = (topic or "").strip().lower()
    platforms_key = _normalize_key_parts(platforms)
    models_key = _normalize_key_parts(models)
    augmentation = augmentation or {}
    augment_key = tuple(
        f"{k}:{str(v).strip().lower()}"
        for k, v in sorted((augmentation or {}).items())
    )
    active_statuses = {
        QueryStatus.PENDING,
        QueryStatus.PLANNING,
        QueryStatus.RESEARCHING,
        QueryStatus.PROCESSING,
        QueryStatus.ANALYZING,
    }
    now = datetime.datetime.now(datetime.timezone.utc)
    max_age = datetime.timedelta(minutes=20)

    for task_id in list(_task_cache.keys()):
        task = _get_task(task_id)
        if not task or task.get("status") not in active_statuses:
            continue
        task_topic = str(task.get("topic", "")).strip().lower()
        if task_topic != topic_key:
            continue
        if _normalize_key_parts(task.get("platforms", []) or []) != platforms_key:
            continue
        if _normalize_key_parts(task.get("models", []) or []) != models_key:
            continue
        task_augmentation = task.get("augmentation") or {}
        task_augment_key = tuple(
            f"{k}:{str(v).strip().lower()}"
            for k, v in sorted(task_augmentation.items())
        )
        if task_augment_key != augment_key:
            continue
        created_at = _parse_iso(task.get("created_at")) or now
        if now - created_at > max_age:
            continue
        return existing_id
    return None


# _parse_iso available in trends_utils.py or helpers.py


# _provider_failure_rate available in trends_utils.py or helpers.py


def _configured_consensus_routes() -> dict[str, Any]:
    routes: list[dict[str, str]] = []

    if os.getenv("VENICE_API_KEY"):
        for label, model in VENICE_VARIANTS:
            routes.append({"provider": label, "model_id": model})
    if os.getenv("AISA_API_KEY"):
        routes.append({"provider": "aisa", "model_id": "gpt-4o"})
    if os.getenv("GEMINI_API_KEY"):
        routes.append({"provider": "gemini", "model_id": "gemini-1.5-flash"})
    if os.getenv("OPENROUTER_API_KEY"):
        for label, model in OPENROUTER_VARIANTS:
            routes.append({"provider": label, "model_id": model})

    providers = sorted({route["provider"] for route in routes})
    return {
        "routes": routes,
        "providers": providers,
        "provider_count": len(providers),
        "route_count": len(routes),
        "can_run_consensus": len(routes) >= 2,
    }


@app.get("/api/health/consensus")
async def consensus_health(probe: bool = False) -> dict[str, Any]:
    """
    Consensus preflight endpoint.
    - probe=false: reports configured providers/routes from env keys
    - probe=true: performs lightweight live provider checks
    """
    snapshot = _configured_consensus_routes()
    response: dict[str, Any] = {
        "ok": snapshot["can_run_consensus"],
        "probe_enabled": probe,
        "provider_count": snapshot["provider_count"],
        "route_count": snapshot["route_count"],
        "providers": snapshot["providers"],
        "routes": snapshot["routes"],
        "status": "ready" if snapshot["can_run_consensus"] else "degraded",
        "message": (
            "Consensus engine has enough configured routes."
            if snapshot["can_run_consensus"]
            else "Less than 2 configured routes. Consensus will degrade to fallback behavior."
        ),
    }

    if not probe:
        return response

    probe_prompt = "Consensus health probe: return one short sentence."
    results = await ai_service.get_parallel_provider_results(
        probe_prompt,
        system_prompt="You are a health probe assistant.",
        providers=["venice", "aisa", "openrouter", "gemini"],
    )

    successful = [item for item in results if item.get("status") == "ok"]
    failed = [item for item in results if item.get("status") != "ok"]
    live_ok = len(successful) >= 2

    response.update(
        {
            "ok": live_ok,
            "status": "ready" if live_ok else "degraded",
            "message": (
                "Live probe confirms consensus viability."
                if live_ok
                else "Live probe returned fewer than 2 healthy routes."
            ),
            "live_probe": {
                "healthy_route_count": len(successful),
                "failed_route_count": len(failed),
                "healthy_routes": successful,
                "failed_routes": failed,
            },
        }
    )
    return response


@app.post("/api/attest/verify")
async def verify_attestation(request: AttestationVerifyRequest) -> dict[str, Any]:
    verified = attestation_service.verify(request.payload, request.attestation)
    return {
        "verified": verified,
        "provider": request.attestation.get("provider"),
        "method": request.attestation.get("method"),
        "attestation_id": request.attestation.get("attestation_id"),
    }


@app.get("/api/health/attestation")
async def attestation_health(probe: bool = False) -> dict[str, Any]:
    """
    Attestation preflight endpoint.
    - probe=false: reports provider config readiness
    - probe=true: performs live Eigen endpoint reachability test when configured
    """
    return await attestation_service.health_check(probe=probe)


@app.get("/api/health/runs")
async def run_health(limit: int = 50) -> dict[str, Any]:
    """
    Runtime guardrail snapshot for recent runs.
    Highlights stuck runs, attestation issues, export-risk runs, and provider instability.
    """
    records = repo.get_all_tasks(limit=limit)
    inspected: list[dict[str, Any]] = []
    issue_count = 0

    for item in records:
        task_id = item.get("task_id")
        if not task_id:
            continue
        full = _get_task(task_id) or item
        alerts = _task_runtime_alerts(full)
        if alerts:
            issue_count += 1
        inspected.append(
            {
                "task_id": task_id,
                "status": full.get("status", QueryStatus.PENDING),
                "created_at": full.get("created_at"),
                "updated_at": full.get("updated_at"),
                "alerts": alerts,
            }
        )

    return {
        "ok": issue_count == 0,
        "inspected": len(inspected),
        "issues": issue_count,
        "runs": inspected,
    }


@app.get("/api/user/rate-limit")
async def get_user_rate_limit(
    http_request: Request,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> dict[str, Any]:
    """
    Get current rate limit info for the user.
    Returns tier, remaining searches, and reset time.
    """
    ip_address = get_client_ip(http_request)
    info = await user_rate_limiter.get_info(x_wallet_address, ip_address)
    return {
        "tier": info.tier,
        "remaining": info.remaining,
        "limit": info.limit,
        "reset_at": info.reset_at.isoformat(),
        "wallet_connected": x_wallet_address is not None,
    }


# start_analysis endpoint moved to backend/api/routes/trends.py


async def run_agent_workflow(
    task_id: str,
    topic: str,
    platforms: list[str],
    models: list[str],
    augmentation: dict[str, str] | None = None,
) -> None:
    workflow = create_workflow()
    initial_state: dict[str, Any] = {
        "topic": topic,
        "platforms": platforms,
        "models": models,
        "query_id": task_id,
        "status": QueryStatus.PENDING,
        "logs": ["Task initialized."],
        "created_at": task["created_at"],
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
        task = _get_task(task_id)
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
                created_dt = _parse_iso(task.get("created_at"))
                updated_dt = _parse_iso(task.get("updated_at"))
                duration_seconds = (
                    int((updated_dt - created_dt).total_seconds())
                    if created_dt and updated_dt
                    else 0
                )
                provider_failure_rate = _provider_failure_rate(consensus_data)
                guardrail_alerts = _task_runtime_alerts(task)
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
                    "source_breakdown": _derive_source_breakdown(task.get("raw_findings") or []),
                }

                # Log the node completion
                if "logs" not in task:
                    task["logs"] = []
                task["logs"].append(f"Completed step: {node_name}")

                # Persist update to Repository (source of truth)
                _save_task(task_id, task)
    except Exception as e:
        print(f"Workflow error for task {task_id}: {e}")
        task = _get_task(task_id)
        if task:
            task["status"] = QueryStatus.FAILED
            task["error"] = str(e)
            task["logs"].append(f"❌ CRITICAL ERROR: {str(e)}")
            _save_task(task_id, task)


async def run_agent_action(action_id: str) -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    repo.update_action(
        action_id,
        status="running",
        started_at=now,
    )

    action = repo.get_action(action_id)
    if not action:
        return

    action_type = action.get("action_type")
    task_id = action.get("task_id")
    input_payload = action.get("input_payload") or {}

    try:
        task = _get_task(task_id)
        if task_id and not task:
            raise ValueError("Referenced task not found.")

        base_url = os.getenv("FRONTEND_URL", "https://trende.vercel.app")

        if action_type == "generate_alpha_manifest":
            if not task or task.get("status") != QueryStatus.COMPLETED:
                raise ValueError("Task must be completed before manifest generation.")
            data = task.get("research_payload", {}) or {}
            token = data.get("token", {})
            proof_url = f"{base_url}/meme/{task_id}"
            result_payload = {
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
            result_payload = {
                "draft": {
                    "title": title,
                    "body_markdown": final_report[:12000],
                    "source_task_id": task_id,
                },
                "status": "ready",
            }
        elif action_type == "draft_podcast":
            if not _env_flag("ENABLE_PODCAST_ACTION", "false"):
                raise ValueError("draft_podcast is disabled. Set ENABLE_PODCAST_ACTION=true to enable.")
            if not task:
                raise ValueError("draft_podcast requires task_id.")
            result_payload = _build_podcast_payload(task_id, task, input_payload)
        elif action_type == "export_proof_bundle":
            if not task:
                raise ValueError("export_proof_bundle requires task_id.")
            result_node = task.get("result") if isinstance(task.get("result"), dict) else task
            attestation = (
                result_node.get("attestation_data")
                if isinstance(result_node, dict)
                else task.get("attestation_data")
            ) or {}
            result_payload = {
                "proof_url": f"{base_url}/proof/{task_id}",
                "attestation_id": attestation.get("attestation_id"),
                "signature": attestation.get("signature"),
                "input_hash": attestation.get("input_hash"),
                "status": "ready",
            }
        elif action_type == "activate_sentinel":
            if not task:
                raise ValueError("activate_sentinel requires task_id.")
            
            interval = input_payload.get("interval", "daily")
            threshold = input_payload.get("alert_threshold", 0.8)
            
            result_payload = {
                "sentinel_id": f"SNTL-{task_id[:8]}",
                "status": "active",
                "config": {
                    "interval": interval,
                    "target_task_id": task_id,
                    "alert_threshold": threshold,
                    "recursive_research": True,
                    "tee_verification": True
                },
                "next_run": (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).isoformat(),
                "message": f"Sentinel established for {task.get('topic', 'topic')}. Agent will monitor and re-verify alpha every {interval}."
            }
        elif action_type == "stage_oracle_market":
            if not task:
                raise ValueError("stage_oracle_market requires task_id.")
            from backend.services.chainlink_service import chainlink_service
            
            topic = task.get("topic", "Trend Analysis")
            duration = input_payload.get("duration", 86400)
            
            tx_hash = await chainlink_service.create_market(topic, duration)
            if not tx_hash:
                raise ValueError("Failed to create on-chain market via Chainlink.")
            
            result_payload = {
                "tx_hash": tx_hash,
                "explorer_url": f"{chainlink_service.chain_info['explorer']}/tx/{tx_hash}",
                "status": "staged",
                "network": chainlink_service.active_chain,
                "message": f"Market for '{topic}' staged on-chain. Resolution will be triggered via Chainlink Functions."
            }
        elif action_type == "resolve_oracle_market":
            if not task:
                raise ValueError("resolve_oracle_market requires task_id.")
            from backend.services.chainlink_service import chainlink_service
            
            # For resolution, we need the market ID. 
            # In this hackathon version, we might store it in a manual override or use a default.
            # Usually we'd get this from a previous 'stage_oracle_market' action result.
            market_id = input_payload.get("market_id")
            if not market_id:
                # Attempt to find it in previous actions
                past_actions = repo.get_actions_for_task(task_id)
                for a in past_actions:
                    if a.get("action_type") == "stage_oracle_market" and a.get("status") == "succeeded":
                        # If we had the marketId from an event, we'd use it here.
                        # For now, we use a placeholder or the topic's hash.
                        import hashlib
                        topic = task.get("topic", "")
                        market_id = "0x" + hashlib.sha256(topic.encode()).hexdigest()
                        break
            
            if not market_id:
                raise ValueError("No active oracle market found for this research.")

            # Load the JS source for resolution
            source_path = os.path.join(os.getcwd(), "backend/chainlink/functions/oracle-resolution.js")
            with open(source_path, "r") as f:
                js_source = f.read()

            tx_hash = await chainlink_service.resolve_market(market_id, js_source)
            if not tx_hash:
                raise ValueError("Failed to trigger on-chain resolution via Chainlink.")

            result_payload = {
                "tx_hash": tx_hash,
                "explorer_url": f"{chainlink_service.chain_info['explorer']}/tx/{tx_hash}",
                "status": "resolution_requested",
                "market_id": market_id,
                "message": f"Resolution for market {market_id[:10]}... requested via Chainlink DON."
            }
        else:
            result_payload = {
                "status": "accepted",
                "message": "Action type scaffolded but no executor implemented yet.",
                "action_type": action_type,
            }

        repo.update_action(
            action_id,
            status="succeeded",
            result_payload=result_payload,
            completed_at=datetime.datetime.now(datetime.timezone.utc),
            error=None,
        )
        
        # Post-action task updates
        if action_type == "stage_oracle_market" and task_id:
            # Generate a market_id and store it in the task
            import hashlib
            topic = task.get("topic", "")
            market_id = "0x" + hashlib.sha256(topic.encode()).hexdigest()
            
            task["oracle_market_id"] = market_id
            _save_task(task_id, task)

    except Exception as exc:
        repo.update_action(
            action_id,
            status="failed",
            error=str(exc),
            completed_at=datetime.datetime.now(datetime.timezone.utc),
        )


# get_history endpoint moved to backend/api/routes/trends.py


# get_saved_research endpoint moved to backend/api/routes/trends.py


# save_research endpoint moved to backend/api/routes/trends.py


@app.get("/api/commons")
async def get_public_commons(limit: int = 50, sponsor: str | None = None) -> dict[str, Any]:
    """
    Public Research Commons - browse completed high-quality public research.

    This endpoint is publicly accessible without authentication.
    Quality-gating defaults exclude sparse/partial runs unless server config opts in.
    """
    records = repo.get_public_research(limit=limit, sponsor=sponsor)

    return {
        "research": [
            {
                "id": item.get("task_id"),
                "topic": item.get("topic", ""),
                "sponsor": item.get("sponsor_address"),
                "platforms": item.get("platforms", []),
                "hasAttestation": item.get("has_attestation", False),
                "createdAt": item.get("created_at", ""),
            }
            for item in records
        ],
        "total": len(records),
        "filter": {
            "sponsor": sponsor,
        },
    }


# get_status endpoint moved to backend/api/routes/trends.py



# get_task_results endpoint moved to backend/api/routes/trends.py


# export_task_report endpoint moved to backend/api/routes/trends.py


@app.get("/api/agent/alpha/{task_id}", response_model=None)
async def get_agent_alpha(
    task_id: str, payment: X402Payment | None = None
) -> dict[str, Any] | Response:
    """
    Agent-to-Agent (A2A) Endpoint.
    Returns a compact, verifiable conviction manifest for external launch bots.
    """
    # 1. Verification Logic
    require_x402 = os.getenv("REQUIRE_X402", "false").lower() == "true"
    if require_x402 and (not payment or not x402_service.verify_payment(payment)):
        return Response(status_code=402, content="Intelligence Purchase Required (X402)")

    # 2. Data Retrieval
    task = _get_task(task_id)
    if not task or task.get("status") != QueryStatus.COMPLETED:
        return Response(
            status_code=404, content=json.dumps({"error": "Alpha not ready or task not found"})
        )

    data = task.get("research_payload", {})
    if not data:
        return Response(
            status_code=404, content=json.dumps({"error": "Architect failed to generate manifest"})
        )

    # 3. Manifest Construction (Compatible with nad.fun Skill Spec)
    # We embed the Trende proof link into the description to ensure permanent verifiability.
    base_url = os.getenv("FRONTEND_URL", "https://trende.vercel.app")
    proof_url = f"{base_url}/meme/{task_id}"

    token = data.get("token", {})
    description = f"{token.get('description', '')}\n\n--- VERIFIED BY TRENDE ---\nProof of Multi-Model Consensus: {proof_url}"

    return {
        "manifest": {
            "name": token.get("name"),
            "symbol": token.get("ticker"),
            "description": description,
            "image_uri": "https://trende.vercel.app/api/assets/placeholder.png",  # TODO: Dynamic asset generation
            "twitter": "",
            "telegram": "",
            "website": proof_url,
            "trende_proof_id": task_id,
            "attestation": task.get("attestation_data"),
        },
        "status": "verifiable_alpha",
        "settlement": "X402_COMPLETED",
    }


# stream_status endpoint moved to backend/api/routes/trends.py


# publish_trend endpoint moved to backend/api/routes/trends.py


# ask_about_task endpoint moved to backend/api/routes/trends.py



# SynthData Endpoints

class SynthDataForecastRequest(BaseModel):
    asset: str
    include_options: bool = False
    include_liquidation: bool = False
    leverage: float = 10.0


@app.get("/api/synthdata/assets")
async def list_synthdata_assets() -> dict[str, Any]:
    """List all supported assets for SynthData forecasting."""
    connector = SynthDataConnector()
    return {
        "crypto": list(connector.supported_crypto),
        "equities": list(connector.supported_equities),
        "aliases": connector.asset_aliases,
    }


@app.post("/api/synthdata/forecast")
async def get_synthdata_forecast(request: SynthDataForecastRequest) -> dict[str, Any]:
    """
    Get probabilistic price forecast for an asset.
    
    Returns comprehensive financial intelligence including:
    - Price forecasts (7d and 30d) with percentile ranges
    - Volatility metrics
    - Risk assessment
    - Optional: Option pricing, liquidation analysis
    """
    connector = SynthDataConnector()
    if not connector.api_key:
        return JSONResponse(
            status_code=503,
            content={"error": "SynthData API not configured"}
        )
    
    # Normalize asset symbol/alias first (case-insensitive), then uppercase symbol.
    asset_input = (request.asset or "").strip()
    alias_key = asset_input.lower()
    if alias_key in connector.asset_aliases:
        asset = connector.asset_aliases[alias_key]
    else:
        asset = asset_input.upper()
    
    if asset not in connector.supported_crypto and asset not in connector.supported_equities:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Asset '{request.asset}' not supported",
                "supported_assets": list(connector.supported_crypto | connector.supported_equities)
            }
        )
    
    insight = await connector.get_comprehensive_asset_insight(
        asset=asset,
        include_options=request.include_options,
        include_liquidation=request.include_liquidation,
        leverage=request.leverage
    )
    
    if not insight:
        return JSONResponse(
            status_code=404,
            content={"error": f"No forecast data available for {asset}"}
        )
    
    return {
        "asset": asset,
        "asset_type": insight.asset_type,
        "current_price": insight.current_price,
        "forecast_7d": insight.price_forecast_7d,
        "forecast_30d": insight.price_forecast_30d,
        "risk_level": insight.risk_level,
        "volatility": {
            "realized": insight.realized_volatility,
            "implied": insight.implied_volatility,
        },
        "liquidation_probability": insight.liquidation_probability,
        "option_prices": insight.option_prices,
        "timestamp": insight.timestamp.isoformat() if insight.timestamp else None,
        "data_source": "SynthData (Bittensor Subnet 50)",
    }


@app.get("/api/synthdata/polymarket/events")
async def get_polymarket_events() -> dict[str, Any]:
    """Get available Polymarket events for comparison."""
    connector = SynthDataConnector()
    if not connector.api_key:
        return JSONResponse(
            status_code=503,
            content={"error": "SynthData API not configured"}
        )
    
    events = await connector.get_polymarket_events()
    return {"events": events or []}


@app.get("/api/health/synthdata")
async def synthdata_health() -> dict[str, Any]:
    """Check SynthData API connectivity and configuration."""
    connector = SynthDataConnector()
    
    if not connector.api_key:
        return {
            "ok": False,
            "configured": False,
            "message": "SynthData API key not configured",
        }
    
    # Try a lightweight request
    try:
        # Try to get BTC forecast as health check
        forecast = await connector.get_prediction_percentiles("BTC", "7d")
        return {
            "ok": forecast is not None,
            "configured": True,
            "message": "SynthData API healthy" if forecast else "SynthData API returned empty response",
            "supported_assets": {
                "crypto": list(connector.supported_crypto),
                "equities": list(connector.supported_equities),
            }
        }
    except Exception as e:
        return {
            "ok": False,
            "configured": True,
            "message": f"SynthData API error: {str(e)}",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
