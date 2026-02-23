import asyncio
import json
import os
import uuid
import datetime
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, FastAPI, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, model_validator

from backend.agents.workflow import create_workflow, run_editorial_task
from backend.api.routes import acp as acp_routes
from backend.services.acp_service import acp_service
from backend.database.repository import Repository, init_db
from backend.services.ai_service import OPENROUTER_VARIANTS, ai_service
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
    allow_origins=["*"],  # Configure properly for production
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


async def resume_interrupted_tasks() -> None:
    # Only resume if they are in a processing state
    unfinished = [
        t
        for t in repo.get_all_tasks(limit=100)
        if t["status"] not in [QueryStatus.COMPLETED, QueryStatus.FAILED]
    ]
    for t in unfinished:
        # Load full state
        full_task = repo.get_task(t["task_id"])
        if full_task:
            tasks[t["task_id"]] = full_task
            # Restart agent loop in background
            asyncio.create_task(
                run_agent_workflow(
                    t["task_id"],
                    full_task["topic"],
                    full_task.get("platforms", []),
                    full_task.get("models", []),
                )
            )


repo = Repository()

# Simple in-memory task store (should move to Redis/DB later)
tasks = {}


def _normalize_key_parts(values: list[str]) -> tuple[str, ...]:
    return tuple(sorted({(value or "").strip().lower() for value in values if (value or "").strip()}))


def _find_matching_active_task(topic: str, platforms: list[str], models: list[str]) -> str | None:
    topic_key = (topic or "").strip().lower()
    platforms_key = _normalize_key_parts(platforms)
    models_key = _normalize_key_parts(models)
    active_statuses = {
        QueryStatus.PENDING,
        QueryStatus.PLANNING,
        QueryStatus.RESEARCHING,
        QueryStatus.PROCESSING,
        QueryStatus.ANALYZING,
    }
    now = datetime.datetime.now(datetime.timezone.utc)
    max_age = datetime.timedelta(minutes=20)

    for existing_id, task in tasks.items():
        if task.get("status") not in active_statuses:
            continue
        task_topic = str(task.get("topic", "")).strip().lower()
        if task_topic != topic_key:
            continue
        if _normalize_key_parts(task.get("platforms", []) or []) != platforms_key:
            continue
        if _normalize_key_parts(task.get("models", []) or []) != models_key:
            continue
        created_at_raw = task.get("created_at")
        try:
            created_at = datetime.datetime.fromisoformat(str(created_at_raw).replace("Z", "+00:00"))
        except Exception:
            created_at = now
        if now - created_at > max_age:
            continue
        return existing_id
    return None


def _parse_iso(value: Any) -> datetime.datetime | None:
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _provider_failure_rate(consensus_data: dict[str, Any]) -> float:
    outputs = consensus_data.get("provider_outputs") or []
    if not outputs:
        return 0.0
    failures = [item for item in outputs if str(item.get("status", "ok")).lower() != "ok"]
    return round(len(failures) / max(len(outputs), 1), 3)


def _task_runtime_alerts(task: dict[str, Any]) -> list[str]:
    alerts: list[str] = []
    status = str(task.get("status", "")).lower()
    created_at = _parse_iso(task.get("created_at"))
    updated_at = _parse_iso(task.get("updated_at")) or datetime.datetime.now(datetime.timezone.utc)
    consensus = task.get("consensus_data") or {}
    result_node = task.get("result") if isinstance(task.get("result"), dict) else {}
    consensus = consensus or result_node.get("consensus_data") or {}
    attestation = task.get("attestation_data") or result_node.get("attestation_data") or {}
    findings = result_node.get("raw_findings") or task.get("raw_findings") or []
    report_md = str(result_node.get("final_report_md") or task.get("final_report_md") or "").strip()

    stuck_seconds = int(os.getenv("RUN_HEALTH_STUCK_SECONDS", "420"))
    if created_at and status in {
        QueryStatus.PENDING,
        QueryStatus.PLANNING,
        QueryStatus.RESEARCHING,
        QueryStatus.PROCESSING,
        QueryStatus.ANALYZING,
    }:
        elapsed = (updated_at - created_at).total_seconds()
        if elapsed > stuck_seconds:
            alerts.append(f"stuck_run: elapsed {int(elapsed)}s > {stuck_seconds}s")

    if status == QueryStatus.COMPLETED and str(attestation.get("status", "")).lower() != "signed":
        alerts.append("attestation_not_signed")

    provider_failure_rate = _provider_failure_rate(consensus)
    if provider_failure_rate >= float(os.getenv("RUN_HEALTH_PROVIDER_FAIL_RATE", "0.5")):
        alerts.append(f"provider_failure_rate_high:{provider_failure_rate}")

    if status == QueryStatus.COMPLETED and len(findings) == 0:
        alerts.append("empty_findings")
    if status == QueryStatus.COMPLETED and len(report_md) < 120:
        alerts.append("report_too_short_for_export")

    return alerts


class QueryRequest(BaseModel):
    topic: str | None = None
    idea: str | None = None
    platforms: list[str] = Field(default_factory=lambda: ["twitter", "newsapi", "linkedin"])
    models: list[str] = Field(default_factory=lambda: ["venice", "aisa", "openrouter"])
    relevance_threshold: float | None = None
    payment: X402Payment | None = None

    @model_validator(mode="after")
    def validate_topic(self) -> "QueryRequest":
        resolved = (self.topic or self.idea or "").strip()
        if not resolved:
            raise ValueError("Either 'topic' or 'idea' is required")
        self.topic = resolved
        return self


class AttestationVerifyRequest(BaseModel):
    payload: dict[str, Any]
    attestation: dict[str, Any]


class SaveResearchRequest(BaseModel):
    visibility: str = "private"
    pin_to_ipfs: bool = False
    save_label: str | None = None
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_visibility(self) -> "SaveResearchRequest":
        normalized = (self.visibility or "private").strip().lower()
        if normalized not in {"private", "unlisted", "public"}:
            raise ValueError("visibility must be one of: private, unlisted, public")
        self.visibility = normalized
        self.tags = [tag.strip().lower() for tag in self.tags if tag.strip()][:8]
        if self.save_label is not None:
            self.save_label = self.save_label.strip()[:120] or None
        return self


class ActionSubmitRequest(BaseModel):
    action_type: str
    task_id: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None

    @model_validator(mode="after")
    def validate_action(self) -> "ActionSubmitRequest":
        self.action_type = (self.action_type or "").strip().lower()
        if not self.action_type:
            raise ValueError("action_type is required.")
        if self.idempotency_key is not None:
            self.idempotency_key = self.idempotency_key.strip()[:128] or None
        return self


def _configured_consensus_routes() -> dict[str, Any]:
    routes: list[dict[str, str]] = []

    if os.getenv("VENICE_API_KEY"):
        routes.append({"provider": "venice", "model_id": "llama-3.3-70b"})
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
        full = tasks.get(task_id) or repo.get_task(task_id) or item
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


@app.post("/api/trends/start", response_model=None)
async def start_analysis(
    request: QueryRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    response: Response,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> dict[str, Any] | Response:
    # Check if payment bypasses rate limit (premium tier)
    has_premium = False
    if request.payment and x402_service.verify_payment(request.payment):
        has_premium = True

    # Check rate limit
    allowed, rate_info, error_response = await check_rate_limit(
        http_request,
        wallet_address=x_wallet_address,
    )

    # Add rate limit headers to response
    for k, v in rate_info.to_headers().items():
        response.headers[k] = v

    # If rate limit exceeded and no valid payment, return error
    if not allowed and not has_premium:
        return error_response or Response(status_code=429)

    matching_task_id = _find_matching_active_task(
        request.topic or "",
        request.platforms,
        request.models,
    )
    if matching_task_id:
        existing = tasks.get(matching_task_id) or {}
        return {
            "task_id": matching_task_id,
            "id": matching_task_id,
            "status": existing.get("status", QueryStatus.PENDING),
            "createdAt": existing.get("created_at"),
            "reused": True,
        }

    task_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    tasks[task_id] = {
        "task_id": task_id,
        "status": QueryStatus.PENDING,
        "logs": [],
        "result": None,
        "topic": request.topic,
        "platforms": request.platforms,
        "models": request.models,
        "sponsor_address": x_wallet_address,  # Track who funded this research
        "owner_address": x_wallet_address,
        "is_saved": False,
        "visibility": "private",
        "saved_at": None,
        "ipfs_cid": None,
        "ipfs_uri": None,
        "save_label": None,
        "tags": [],
        "created_at": now,
        "updated_at": now,
        "run_telemetry": {
            "run_id": task_id,
            "provider_count": 0,
            "agreement_score": 0.0,
            "diversity_level": "low",
            "attestation_status": "pending",
            "data_sufficiency": "unknown",
            "findings_count": 0,
            "logs": [],
        },
    }

    # Save to DB
    repo.save_task(task_id, tasks[task_id])

    background_tasks.add_task(
        run_agent_workflow,
        task_id,
        request.topic or "",
        request.platforms,
        request.models,
    )

    created_at = tasks[task_id]["created_at"]
    return {
        "task_id": task_id,
        "id": task_id,
        "status": QueryStatus.PENDING,
        "createdAt": created_at,
    }


async def run_agent_workflow(
    task_id: str, topic: str, platforms: list[str], models: list[str]
) -> None:
    workflow = create_workflow()
    initial_state: dict[str, Any] = {
        "topic": topic,
        "platforms": platforms,
        "models": models,
        "query_id": task_id,
        "status": QueryStatus.PENDING,
        "logs": ["Task initialized."],
        "created_at": tasks[task_id]["created_at"],
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
        "meme_page_data": None,
        "consensus_data": None,
        "attestation_data": None,
        "current_depth": 0,
        "max_depth": 2 if "tinyfish" in (platforms or []) or "web" in (platforms or []) else 1,
        "follow_up_directions": [],
        "error": None,
    }

    # Run the graph
    try:
        async for output in workflow.astream(initial_state):  # type: ignore
            for node_name, state_update in output.items():
                # Update the global task state with the latest changes from the agent
                for key, value in state_update.items():
                    tasks[task_id][key] = value

                # Honor explicit terminal statuses from node output first.
                explicit_status = state_update.get("status")
                if explicit_status in [QueryStatus.COMPLETED, QueryStatus.FAILED]:
                    tasks[task_id]["status"] = explicit_status
                # Otherwise set an operational status based on the executing node.
                elif node_name == "planner":
                    tasks[task_id]["status"] = QueryStatus.RESEARCHING
                elif node_name == "researcher":
                    tasks[task_id]["status"] = QueryStatus.PROCESSING
                elif node_name == "validator":
                    tasks[task_id]["status"] = QueryStatus.ANALYZING
                elif node_name == "analyzer":
                    tasks[task_id]["status"] = QueryStatus.PROCESSING
                elif node_name == "architect":
                    tasks[task_id]["status"] = QueryStatus.COMPLETED

                if node_name == "architect":
                    tasks[task_id]["logs"].append("🏆 MISSION ACCOMPLISHED: Final results ready.")

                tasks[task_id]["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

                consensus_data = tasks[task_id].get("consensus_data") or {}
                attestation_data = tasks[task_id].get("attestation_data") or {}
                created_dt = _parse_iso(tasks[task_id].get("created_at"))
                updated_dt = _parse_iso(tasks[task_id].get("updated_at"))
                duration_seconds = (
                    int((updated_dt - created_dt).total_seconds())
                    if created_dt and updated_dt
                    else 0
                )
                provider_failure_rate = _provider_failure_rate(consensus_data)
                guardrail_alerts = _task_runtime_alerts(tasks[task_id])
                merged_warnings = list(
                    dict.fromkeys((consensus_data.get("warnings", []) or []) + guardrail_alerts)
                )
                findings_count = len(tasks[task_id].get("raw_findings") or [])
                data_sufficiency = "healthy"
                if findings_count == 0:
                    data_sufficiency = "sparse"
                elif findings_count < 5:
                    data_sufficiency = "partial"
                tasks[task_id]["run_telemetry"] = {
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
                    "logs": tasks[task_id].get("logs", [])[-12:],
                    "updated_at": tasks[task_id]["updated_at"],
                }

                # Log the node completion
                if "logs" not in tasks[task_id]:
                    tasks[task_id]["logs"] = []
                tasks[task_id]["logs"].append(f"Completed step: {node_name}")

                # Persist update to DB
                repo.save_task(task_id, tasks[task_id])
    except Exception as e:
        print(f"Workflow error for task {task_id}: {e}")
        tasks[task_id]["status"] = QueryStatus.FAILED
        tasks[task_id]["error"] = str(e)
        tasks[task_id]["logs"].append(f"❌ CRITICAL ERROR: {str(e)}")
        repo.save_task(task_id, tasks[task_id])


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
        task = tasks.get(task_id) or (repo.get_task(task_id) if task_id else None)
        if task_id and not task:
            raise ValueError("Referenced task not found.")

        base_url = os.getenv("FRONTEND_URL", "https://trende.vercel.app")

        if action_type == "generate_alpha_manifest":
            if not task or task.get("status") != QueryStatus.COMPLETED:
                raise ValueError("Task must be completed before manifest generation.")
            data = task.get("meme_page_data", {}) or {}
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
            if task_id in tasks:
                tasks[task_id] = task
            repo.save_task(task_id, task)

    except Exception as exc:
        repo.update_action(
            action_id,
            status="failed",
            error=str(exc),
            completed_at=datetime.datetime.now(datetime.timezone.utc),
        )


@app.get("/api/trends/history")
async def get_history(saved_only: bool = False) -> dict[str, Any]:
    """Returns a list of all past queries."""
    records = repo.get_all_tasks()
    if saved_only:
        records = [item for item in records if item.get("is_saved")]
    return {
        "queries": [
            {
                "id": item.get("task_id"),
                "idea": item.get("topic", ""),
                "status": item.get("status", QueryStatus.PENDING),
                "createdAt": item.get("created_at", ""),
                "savedAt": item.get("saved_at"),
                "isSaved": bool(item.get("is_saved")),
                "visibility": item.get("visibility", "private"),
                "ipfsUri": item.get("ipfs_uri"),
                "saveLabel": item.get("save_label"),
            }
            for item in records
        ]
    }


@app.get("/api/trends/saved", response_model=None)
async def get_saved_research(
    limit: int = 100,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> Any:
    if not x_wallet_address:
        return Response(
            status_code=401,
            content=json.dumps({"error": "Wallet connection required to fetch saved research."}),
        )
    records = repo.get_saved_research(x_wallet_address, limit=limit)
    return {
        "saved": [
            {
                "id": item.get("task_id"),
                "idea": item.get("topic", ""),
                "status": item.get("status", QueryStatus.PENDING),
                "platforms": item.get("platforms", []),
                "createdAt": item.get("created_at", ""),
                "savedAt": item.get("saved_at"),
                "visibility": item.get("visibility", "private"),
                "ipfsCid": item.get("ipfs_cid"),
                "ipfsUri": item.get("ipfs_uri"),
                "saveLabel": item.get("save_label"),
                "tags": item.get("tags", []),
                "hasAttestation": bool(item.get("has_attestation")),
            }
            for item in records
        ],
        "total": len(records),
    }


@app.post("/api/trends/{task_id}/save", response_model=None)
async def save_research(
    task_id: str,
    request: SaveResearchRequest,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> Any:
    if not x_wallet_address:
        return Response(
            status_code=401,
            content=json.dumps({"error": "Connect wallet before saving research."}),
        )

    task = tasks.get(task_id) or repo.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    result_node = task.get("result") if isinstance(task.get("result"), dict) else task
    archive_payload = {
        "task_id": task_id,
        "topic": task.get("topic"),
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
        "platforms": task.get("platforms", []),
        "models": task.get("models", []),
        "summary": result_node.get("summary") if isinstance(result_node, dict) else task.get("summary"),
        "final_report_md": result_node.get("final_report_md") if isinstance(result_node, dict) else task.get("final_report_md"),
        "consensus_data": result_node.get("consensus_data") if isinstance(result_node, dict) else task.get("consensus_data"),
        "attestation_data": result_node.get("attestation_data") if isinstance(result_node, dict) else task.get("attestation_data"),
    }
    archive_info = await archive_service.archive_payload(
        archive_payload,
        prefer_ipfs=request.pin_to_ipfs,
    )

    try:
        saved = repo.mark_task_saved(
            task_id=task_id,
            wallet_address=x_wallet_address,
            visibility=request.visibility,
            ipfs_cid=archive_info.get("cid"),
            ipfs_uri=archive_info.get("uri"),
            save_label=request.save_label,
            tags=request.tags,
        )
    except PermissionError as exc:
        return Response(status_code=403, content=json.dumps({"error": str(exc)}))

    if not saved:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    if task_id in tasks:
        tasks[task_id].update(
            {
                "owner_address": saved.get("owner_address"),
                "is_saved": saved.get("is_saved"),
                "visibility": saved.get("visibility"),
                "saved_at": saved.get("saved_at"),
                "ipfs_cid": saved.get("ipfs_cid"),
                "ipfs_uri": saved.get("ipfs_uri"),
                "save_label": saved.get("save_label"),
                "tags": saved.get("tags"),
            }
        )

    return {
        "saved": {
            "id": task_id,
            "owner": saved.get("owner_address"),
            "visibility": saved.get("visibility"),
            "savedAt": saved.get("saved_at"),
            "ipfsCid": saved.get("ipfs_cid"),
            "ipfsUri": saved.get("ipfs_uri"),
            "saveLabel": saved.get("save_label"),
            "tags": saved.get("tags", []),
        },
        "archive": archive_info,
    }


@app.post("/api/actions/submit", response_model=None)
async def submit_action(
    request: ActionSubmitRequest,
    background_tasks: BackgroundTasks,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> dict[str, Any] | Response:
    if request.idempotency_key:
        existing = repo.get_action_by_idempotency_key(request.idempotency_key)
        if existing:
            return {"action": existing, "idempotent": True}

    action_id = str(uuid.uuid4())
    created = repo.create_action(
        action_id=action_id,
        action_type=request.action_type,
        task_id=request.task_id,
        caller_address=x_wallet_address,
        idempotency_key=request.idempotency_key,
        input_payload=request.input,
    )
    if not created:
        return Response(status_code=500, content=json.dumps({"error": "Failed to create action"}))

    background_tasks.add_task(run_agent_action, action_id)
    return {"action": created, "idempotent": False}


@app.get("/api/actions/{action_id}", response_model=None)
async def get_action_status(action_id: str) -> dict[str, Any] | Response:
    action = repo.get_action(action_id)
    if not action:
        return Response(status_code=404, content=json.dumps({"error": "Action not found"}))
    return {"action": action}


@app.get("/api/commons")
async def get_public_commons(limit: int = 50, sponsor: str | None = None) -> dict[str, Any]:
    """
    Public Research Commons - browse all completed, attested research.

    This endpoint is publicly accessible without authentication.
    All completed research becomes part of the commons.
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


@app.get("/api/trends/status/{task_id}", response_model=None)
async def get_status(task_id: str) -> dict[str, Any] | Response:
    task = tasks.get(task_id)
    if not task:
        task = repo.get_task(task_id)
        if task:
            tasks[task_id] = task
            
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))
    return task


@app.get("/api/trends/{task_id}", response_model=None)
async def get_task_results(task_id: str) -> dict[str, Any] | Response:
    """Returns the full task results in the format expected by the frontend."""
    task = tasks.get(task_id)
    if not task:
        task = repo.get_task(task_id)
        if task:
            tasks[task_id] = task
            
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    # Normalize result extraction (Handle both memory state and DB state)
    # In memory, findings are at top level or in result node. 
    # In DB, findings are serialized inside task['result']['raw_findings']
    res_node_raw = task.get("result")
    res_node = res_node_raw if isinstance(res_node_raw, dict) else task

    # Transform raw items into TrendResult objects
    items_by_platform: dict[str, list[dict[str, Any]]] = {}
    
    # Try multiple paths for findings
    raw_findings = []
    if isinstance(res_node, dict) and res_node.get("raw_findings"):
        raw_findings = res_node.get("raw_findings")
    elif isinstance(task, dict) and task.get("raw_findings"):
        raw_findings = task.get("raw_findings")
        
    for item in raw_findings or []:
        normalized_item = item.model_dump() if hasattr(item, "model_dump") else item
        platform = (
            normalized_item.get("platform", "web") if isinstance(normalized_item, dict) else "web"
        )
        if platform not in items_by_platform:
            items_by_platform[platform] = []
        items_by_platform[platform].append(normalized_item)

    results = []
    for platform, items in items_by_platform.items():
        results.append(
            {
                "queryId": task_id,
                "platform": platform,
                "items": items,
                "relevanceScore": res_node.get("relevance_score", 0.0)
                if isinstance(res_node, dict)
                else 0.0,
                "totalFetched": len(items),
                "processingTimeMs": 0,  # TODO: Track this
            }
        )

    confidence_score = 0.0
    validation_results = []
    meme_page_data = None
    consensus_data = None
    attestation_data = None
    summary_text = ""
    final_report_md = ""
    run_telemetry = {}
    editorial_data = None

    if isinstance(res_node, dict):
        confidence_score = res_node.get("confidence_score", task.get("confidence_score", 0.0))
        validation_results = res_node.get("validation_results", task.get("validation_results", []))
        meme_page_data = res_node.get("meme_page_data", task.get("meme_page_data"))
        consensus_data = res_node.get("consensus_data", task.get("consensus_data"))
        attestation_data = res_node.get("attestation_data", task.get("attestation_data"))
        summary_text = res_node.get("summary", task.get("summary", ""))
        final_report_md = res_node.get("final_report_md", task.get("final_report_md", ""))
        run_telemetry = res_node.get("run_telemetry", task.get("run_telemetry", {}))
        editorial_data = res_node.get("editorial_data", task.get("editorial_data"))

    # Construct response matching ResultsResponse in frontend/lib/types.ts
    return {
        "query": {
            "id": task_id,
            "idea": task.get("topic", ""),
            "platforms": task.get("platforms", []),
            "status": task.get("status", "pending"),
            "createdAt": task.get("created_at", ""),
            "updatedAt": task.get("updated_at", task.get("created_at", "")),
            "errorMessage": task.get("error"),
            "totalResults": len(res_node.get("raw_findings") or [])
            if isinstance(res_node, dict)
            else 0,
            "relevanceThreshold": 0.5,
            "isSaved": bool(task.get("is_saved")),
            "visibility": task.get("visibility", "private"),
            "savedAt": task.get("saved_at"),
            "ipfsUri": task.get("ipfs_uri"),
            "saveLabel": task.get("save_label"),
        },
        "results": results,
        "summary": {
            "overview": summary_text,
            "keyThemes": [],  # TODO: Extract from report
            "topTrends": [],  # TODO: Extract from report
            "sentiment": "neutral",
            "confidenceScore": confidence_score,
            "validationResults": validation_results,
            "finalReportMd": final_report_md,
            "memePageData": meme_page_data,
            "consensusData": consensus_data,
            "attestationData": attestation_data,
            "oracleMarketId": task.get("oracle_market_id"),
            "generatedAt": task.get("updated_at", task.get("created_at", "")),
        },
        "telemetry": {
            "runId": run_telemetry.get("run_id", task_id),
            "providerCount": run_telemetry.get(
                "provider_count", len((consensus_data or {}).get("providers") or [])
            ),
            "providerFailureRate": run_telemetry.get(
                "provider_failure_rate",
                _provider_failure_rate(consensus_data or {}),
            ),
            "agreementScore": run_telemetry.get(
                "agreement_score", (consensus_data or {}).get("agreement_score", 0.0)
            ),
            "diversityLevel": run_telemetry.get(
                "diversity_level", (consensus_data or {}).get("diversity_level", "low")
            ),
            "durationSeconds": run_telemetry.get("duration_seconds", 0),
            "attestationStatus": run_telemetry.get(
                "attestation_status", (attestation_data or {}).get("status", "pending")
            ),
            "dataSufficiency": run_telemetry.get("data_sufficiency", "unknown"),
            "findingsCount": run_telemetry.get("findings_count", len(raw_findings or [])),
            "warnings": run_telemetry.get("warnings", (consensus_data or {}).get("warnings", [])),
            "logs": run_telemetry.get("logs", task.get("logs", [])[-12:]),
            "updatedAt": run_telemetry.get(
                "updated_at", task.get("updated_at", task.get("created_at", ""))
            ),
        },
        "editorial": editorial_data,
    }


@app.get("/api/trends/{task_id}/export", response_model=None)
async def export_task_report(task_id: str, format: str = "pdf") -> Response:
    task = tasks.get(task_id)
    if not task:
        task = repo.get_task(task_id)
        if task:
            tasks[task_id] = task
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    normalized_format = (format or "pdf").strip().lower()
    payload = build_export_payload(task_id=task_id, task=task)
    report_md = str(payload.get("final_report_md") or "").strip()
    summary = str(payload.get("summary") or "").strip()
    source_count = int((payload.get("stats") or {}).get("source_count") or 0)
    if not report_md and not summary and source_count == 0:
        return Response(
            status_code=422,
            content=json.dumps({"error": "Report content is empty; export aborted."}),
            media_type="application/json",
        )
    file_stub = f"trende-report-{task_id[:8]}"

    if normalized_format == "pdf":
        body = render_pdf_report(payload)
        media = "application/pdf"
        filename = f"{file_stub}.pdf"
    elif normalized_format in {"md", "markdown"}:
        body = render_markdown_report(payload).encode("utf-8")
        media = "text/markdown; charset=utf-8"
        filename = f"{file_stub}.md"
    elif normalized_format == "json":
        body = render_json_report(payload)
        media = "application/json; charset=utf-8"
        filename = f"{file_stub}.json"
    else:
        return Response(
            status_code=400,
            content=json.dumps({"error": "format must be one of: pdf, md, json"}),
            media_type="application/json",
        )

    return Response(
        content=body,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


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
    task = tasks.get(task_id) or repo.get_task(task_id)
    if not task or task.get("status") != QueryStatus.COMPLETED:
        return Response(
            status_code=404, content=json.dumps({"error": "Alpha not ready or task not found"})
        )

    data = task.get("meme_page_data", {})
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


@app.get("/api/trends/stream/{task_id}")
async def stream_status(task_id: str) -> StreamingResponse:
    async def event_generator() -> AsyncIterator[str]:
        # Initial delay to allow frontend to hook in
        await asyncio.sleep(1.0)
        while True:
            # Try to get from in-memory tasks first
            state = tasks.get(task_id)
            
            # If not in memory, try reloading from DB
            if not state:
                state = repo.get_task(task_id)
                if state:
                    # Cache it back to memory for streaming
                    tasks[task_id] = state
            
            if not state:
                payload = {
                    "type": "error",
                    "message": "Task not found",
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "data": {"task_id": task_id},
                }
                yield f"data: {json.dumps(payload)}\n\n"
                break

            # Estimate progress based on current status/logs
            progress = 0
            if state["status"] == QueryStatus.PENDING:
                progress = 10
            elif state["status"] == QueryStatus.PLANNING:
                progress = 25
            elif state["status"] == QueryStatus.RESEARCHING:
                progress = 45
            elif state["status"] == QueryStatus.PROCESSING:
                # This status is used by Validator and Architect nodes
                last_log = state.get("logs", [])[-1] if state.get("logs") else ""
                if "Validat" in last_log:
                    progress = 65
                elif "Architect" in last_log:
                    progress = 95
                else:
                    progress = 75
            elif state["status"] == QueryStatus.ANALYZING:
                progress = 85
            elif state["status"] == QueryStatus.COMPLETED:
                progress = 100

            state["progress"] = progress
            payload = {
                "type": "status",
                "message": f"{state['status']} ({progress}%)",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "data": {
                    "task_id": task_id,
                    "status": state["status"],
                    "progress": progress,
                    "logs": state.get("logs", [])[-5:],
                },
            }
            yield f"data: {json.dumps(payload)}\n\n"

            # Check for terminal state
            if state["status"] in [QueryStatus.COMPLETED, QueryStatus.FAILED]:
                # Send one final status update to ensure frontend knows it's finished
                final_payload = {
                    "type": "result" if state["status"] == QueryStatus.COMPLETED else "error",
                    "message": "Analysis completed"
                    if state["status"] == QueryStatus.COMPLETED
                    else "Analysis failed",
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "data": {"task_id": task_id, "status": state["status"]},
                }
                yield f"data: {json.dumps(final_payload)}\n\n"
                break

            # Keep-alive comment
            yield ": keep-alive\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Critical for Nginx
            "Access-Control-Allow-Origin": "*",
        }
    )

class PublishRequest(BaseModel):
    platform: str = "paragraph"
    api_key: str

    @model_validator(mode="after")
    def validate_publish_request(self) -> "PublishRequest":
        self.platform = (self.platform or "paragraph").strip().lower()
        if self.platform != "paragraph":
            raise ValueError("Only paragraph publishing is supported.")
        self.api_key = (self.api_key or "").strip()
        if len(self.api_key) < 16:
            raise ValueError("Invalid Paragraph API key.")
        return self

@app.post("/api/trends/{task_id}/publish", response_model=None)
async def publish_trend(
    task_id: str, 
    request: PublishRequest,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address")
) -> Any:
    """
    Triggers the editorial agent to draft and publish the trend report.
    """
    if not x_wallet_address:
        return JSONResponse(status_code=401, content={"error": "Connect wallet before publishing."})

    if request.platform.strip().lower() != "paragraph":
        return JSONResponse(status_code=400, content={"error": "Unsupported publish platform."})

    # 1. Retrieve the completed task
    task = tasks.get(task_id) or repo.get_task(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})

    owner_address = (
        (task.get("owner_address") or task.get("sponsor_address") or "")
        .strip()
        .lower()
    )
    requester = x_wallet_address.strip().lower()
    if owner_address and owner_address != requester:
        return JSONResponse(status_code=403, content={"error": "Task owned by a different wallet."})
        
    if task.get("status") != QueryStatus.COMPLETED:
        return JSONResponse(status_code=400, content={"error": "Analysis not complete. Cannot publish."})

    # Retrieve report from result node or top level
    res_node = task.get("result") if isinstance(task.get("result"), dict) else task
    report_md = (res_node.get("final_report_md") or "").strip()
    if not report_md:
        # Fallback: synthesize a markdown draft from summary + findings.
        summary = (res_node.get("summary") or task.get("summary") or "").strip()
        findings = res_node.get("raw_findings") or task.get("raw_findings") or []
        lines = [f"# {task.get('topic', 'Trend Analysis')}"]
        if summary:
            lines.extend(["", "## Executive Summary", summary])
        if findings:
            lines.extend(["", "## Key Evidence"])
            for idx, item in enumerate(findings[:8], start=1):
                normalized = item.model_dump() if hasattr(item, "model_dump") else item
                if not isinstance(normalized, dict):
                    continue
                title = normalized.get("title") or "Untitled Source"
                url = normalized.get("url") or ""
                content = str(normalized.get("content") or "").strip()[:280]
                bullet = f"- **S{idx}: {title}**"
                if url:
                    bullet += f" ([link]({url}))"
                if content:
                    bullet += f": {content}"
                lines.append(bullet)
        report_md = "\n".join(lines).strip()
        if not report_md:
            return JSONResponse(status_code=400, content={"error": "No trend report found to draft."})

    # 2. Run Editorial Workflow
    try:
        editorial_result = await run_editorial_task(
            topic=task.get("topic", "Trend Analysis"),
            report_md=report_md,
            api_key=request.api_key.strip(),
        )
        
        # 3. Update Task with Editorial Data (Optional, or just return it)
        # We might want to store that this was published
        editorial_data = {
            "draft": editorial_result.get("editorial_draft"),
            "published_url": editorial_result.get("published_url"),
            "status": editorial_result.get("publish_status"),
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        task["editorial_data"] = editorial_data
        task["owner_address"] = owner_address or requester
        if task_id in tasks:
            tasks[task_id] = task
        repo.save_task(task_id, task)

        draft = editorial_result.get("editorial_draft") or ""
        
        return {
            "success": editorial_result.get("publish_status") in {"SUCCESS", "DRAFT_ONLY"},
            "url": editorial_result.get("published_url"),
            "status": editorial_result.get("publish_status"),
            "draft_preview": (str(draft)[:200] + "...") if draft else "",
        }
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Publishing workflow failed."})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
