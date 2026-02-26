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
from backend.api.routes import health as health_routes
from backend.api.routes import synthdata as synthdata_routes
from backend.api.routes import user as user_routes
from backend.api.services.background_service import background_service
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
    await background_service.resume_interrupted_tasks()
    if acp_service.enabled:
        asyncio.create_task(acp_service.start_listening())
    # Start sentinel: autonomous oracle market resolution loop
    asyncio.create_task(background_service.sentinel_loop())
    # Reap stale non-terminal tasks that were orphaned by restarts/deploys.
    asyncio.create_task(background_service.stale_task_reaper_loop())
    yield


# _sentinel_loop - now in background_service

# _sentinel_tick - now in background_service


app = FastAPI(title="Trende Agent API", lifespan=lifespan)

# ACP routes
app.include_router(acp_routes.router)

# Health routes
app.include_router(health_routes.router)

# SynthData routes
app.include_router(synthdata_routes.router)

# User routes
app.include_router(user_routes.router)

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


# get_client_ip function moved to routes/user.py


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


# resume_interrupted_tasks - now in background_service

# _mark_task_failed - now in background_service

# _stale_task_reaper_loop - now in background_service

repo = Repository()

# Read-through cache for active tasks (Repository is source of truth)
_task_cache: dict[str, dict[str, Any]] = {}


# _get_task - now in background_service

# _save_task - now in background_service

# _update_task - now in background_service

# _normalize_key_parts available in trends_utils.py or helpers.py


# _find_matching_active_task - now in background_service

async def run_agent_workflow(
    task_id: str,
    topic: str,
    platforms: list[str],
    models: list[str],
    augmentation: dict[str, str] | None = None,
) -> None:
    """Wrapper for backward compatibility - delegates to BackgroundTaskService."""
    await background_service.run_agent_workflow(
        task_id, topic, platforms, models, augmentation
    )





async def run_agent_action(action_id: str) -> None:
    """Wrapper for backward compatibility - delegates to BackgroundTaskService."""
    await background_service.run_agent_action(action_id)


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


# list_synthdata_assets endpoint moved to routes/synthdata.py

# get_synthdata_forecast endpoint moved to routes/synthdata.py

# get_polymarket_events endpoint moved to routes/synthdata.py

# synthdata_health endpoint moved to routes/health.py


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
