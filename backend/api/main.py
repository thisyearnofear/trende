import asyncio
import json
import os
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import BackgroundTasks, FastAPI, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, model_validator

from backend.agents.workflow import create_workflow
from backend.database.repository import Repository, init_db
from backend.services.ai_service import OPENROUTER_VARIANTS, ai_service
from backend.services.attestation_service import attestation_service
from backend.services.x402_service import X402Payment, x402_service
from backend.utils.rate_limit import UserRateLimitInfo, user_rate_limiter
from shared.models import QueryStatus


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Initialize DB on startup
    init_db()
    await enforce_attestation_startup_gate()
    # Resume interrupted tasks
    await resume_interrupted_tasks()
    yield


app = FastAPI(title="Trende Agent API", lifespan=lifespan)

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


class QueryRequest(BaseModel):
    topic: str | None = None
    idea: str | None = None
    platforms: list[str] = Field(default_factory=lambda: ["twitter", "newsapi", "linkedin"])
    models: list[str] = Field(default_factory=lambda: ["venice", "aisa", "openrouter"])
    relevance_threshold: float | None = None

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
    payment: X402Payment | None = None,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> dict[str, Any] | Response:
    # Check if payment bypasses rate limit (premium tier)
    has_premium = False
    if payment and x402_service.verify_payment(payment):
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

    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    tasks[task_id] = {
        "task_id": task_id,
        "status": QueryStatus.PENDING,
        "logs": [],
        "result": None,
        "topic": request.topic,
        "platforms": request.platforms,
        "models": request.models,
        "sponsor_address": x_wallet_address,  # Track who funded this research
        "created_at": now,
        "updated_at": now,
        "run_telemetry": {
            "run_id": task_id,
            "provider_count": 0,
            "agreement_score": 0.0,
            "diversity_level": "low",
            "attestation_status": "pending",
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
        "error": None,
    }

    # Run the graph
    async for output in workflow.astream(initial_state):  # type: ignore
        for node_name, state_update in output.items():
            # Set explicit QueryStatus based on node name
            if node_name == "planner":
                tasks[task_id]["status"] = QueryStatus.PLANNING
            elif node_name == "researcher":
                tasks[task_id]["status"] = QueryStatus.RESEARCHING
            elif node_name == "validator":
                tasks[task_id]["status"] = QueryStatus.PROCESSING  # Use PROCESSING as a bridge
            elif node_name == "analyzer":
                tasks[task_id]["status"] = QueryStatus.ANALYZING
            elif node_name == "architect":
                tasks[task_id]["status"] = QueryStatus.PROCESSING  # Wrapping up

            # Update the global task state with the latest changes from the agent
            for key, value in state_update.items():
                tasks[task_id][key] = value
            tasks[task_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

            consensus_data = tasks[task_id].get("consensus_data") or {}
            attestation_data = tasks[task_id].get("attestation_data") or {}
            tasks[task_id]["run_telemetry"] = {
                "run_id": task_id,
                "provider_count": len(consensus_data.get("providers", [])),
                "agreement_score": consensus_data.get("agreement_score", 0.0),
                "diversity_level": consensus_data.get("diversity_level", "low"),
                "attestation_status": attestation_data.get("status", "pending"),
                "warnings": consensus_data.get("warnings", []),
                "logs": tasks[task_id].get("logs", [])[-12:],
                "updated_at": tasks[task_id]["updated_at"],
            }

            # Log the node completion
            if "logs" not in tasks[task_id]:
                tasks[task_id]["logs"] = []
            tasks[task_id]["logs"].append(f"Completed step: {node_name}")

            # Persist update to DB
            repo.save_task(task_id, tasks[task_id])


@app.get("/api/trends/status/{task_id}", response_model=None)
async def get_status(task_id: str) -> dict[str, Any] | Response:
    task = tasks.get(task_id) or repo.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))
    return task


@app.get("/api/trends/{task_id}", response_model=None)
async def get_task_results(task_id: str) -> dict[str, Any] | Response:
    """Returns the full task results in the format expected by the frontend."""
    task = tasks.get(task_id) or repo.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    # Normalize result extraction (Handle both memory state and DB state)
    res_node_raw = task.get("result")
    res_node = res_node_raw if isinstance(res_node_raw, dict) else task

    # Transform raw items into TrendResult objects
    items_by_platform: dict[str, list[dict[str, Any]]] = {}
    raw_findings = res_node.get("raw_findings") if isinstance(res_node, dict) else []
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

    if isinstance(res_node, dict):
        confidence_score = res_node.get("confidence_score", task.get("confidence_score", 0.0))
        validation_results = res_node.get("validation_results", task.get("validation_results", []))
        meme_page_data = res_node.get("meme_page_data", task.get("meme_page_data"))
        consensus_data = res_node.get("consensus_data", task.get("consensus_data"))
        attestation_data = res_node.get("attestation_data", task.get("attestation_data"))
        summary_text = res_node.get("summary", task.get("summary", ""))
        final_report_md = res_node.get("final_report_md", task.get("final_report_md", ""))
        run_telemetry = res_node.get("run_telemetry", task.get("run_telemetry", {}))

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
            "generatedAt": task.get("updated_at", task.get("created_at", "")),
        },
        "telemetry": {
            "runId": run_telemetry.get("run_id", task_id),
            "providerCount": run_telemetry.get(
                "provider_count", len((consensus_data or {}).get("providers") or [])
            ),
            "agreementScore": run_telemetry.get(
                "agreement_score", (consensus_data or {}).get("agreement_score", 0.0)
            ),
            "diversityLevel": run_telemetry.get(
                "diversity_level", (consensus_data or {}).get("diversity_level", "low")
            ),
            "attestationStatus": run_telemetry.get(
                "attestation_status", (attestation_data or {}).get("status", "pending")
            ),
            "warnings": run_telemetry.get("warnings", (consensus_data or {}).get("warnings", [])),
            "logs": run_telemetry.get("logs", task.get("logs", [])[-12:]),
            "updatedAt": run_telemetry.get(
                "updated_at", task.get("updated_at", task.get("created_at", ""))
            ),
        },
    }


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


@app.get("/api/trends/history")
async def get_history() -> dict[str, Any]:
    """Returns a list of all past queries."""
    records = repo.get_all_tasks()
    return {
        "queries": [
            {
                "id": item.get("task_id"),
                "idea": item.get("topic", ""),
                "status": item.get("status", QueryStatus.PENDING),
                "createdAt": item.get("created_at", ""),
            }
            for item in records
        ]
    }


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


@app.get("/api/trends/stream/{task_id}")
async def stream_status(task_id: str) -> StreamingResponse:
    async def event_generator() -> AsyncIterator[str]:
        while True:
            if task_id not in tasks:
                payload = {
                    "type": "error",
                    "message": "Task not found",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {"task_id": task_id},
                }
                yield f"data: {json.dumps(payload)}\n\n"
                break

            state = tasks[task_id]

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
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "task_id": task_id,
                    "status": state["status"],
                    "progress": progress,
                    "logs": state.get("logs", [])[-5:],
                },
            }
            yield f"data: {json.dumps(payload)}\n\n"

            if state["status"] in [QueryStatus.COMPLETED, QueryStatus.FAILED]:
                result_payload = {
                    "type": "result" if state["status"] == QueryStatus.COMPLETED else "error",
                    "message": "Analysis completed"
                    if state["status"] == QueryStatus.COMPLETED
                    else "Analysis failed",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {"task_id": task_id, "status": state["status"]},
                }
                yield f"data: {json.dumps(result_payload)}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
