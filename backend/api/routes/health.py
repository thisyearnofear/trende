"""
Health check routes for system status and diagnostics.
"""

from typing import Any

from fastapi import APIRouter

from backend.integrations.connectors.synthdata import SynthDataConnector
from backend.services.ai_service import OPENROUTER_VARIANTS, VENICE_VARIANTS, ai_service
from backend.services.attestation_service import attestation_service
from backend.api.models import AttestationVerifyRequest


router = APIRouter(prefix="/api/health", tags=["health"])


def _configured_consensus_routes() -> dict[str, Any]:
    """Get configured consensus routes based on environment variables."""
    import os

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


@router.get("/consensus")
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


@router.post("/attestation/verify")
async def verify_attestation(request: AttestationVerifyRequest) -> dict[str, Any]:
    """Verify a Trende proof payload."""
    verified = attestation_service.verify(request.payload, request.attestation)
    return {
        "verified": verified,
        "provider": request.attestation.get("provider"),
        "method": request.attestation.get("method"),
        "attestation_id": request.attestation.get("attestation_id"),
    }


@router.get("/attestation")
async def attestation_health(probe: bool = False) -> dict[str, Any]:
    """
    Proof preflight endpoint.
    - probe=false: reports server-side proof readiness
    - probe=true: returns proof lane details for the active runtime
    """
    return await attestation_service.health_check(probe=probe)


@router.get("/synthdata")
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


@router.get("/runs")
async def run_health(limit: int = 50) -> dict[str, Any]:
    """
    Runtime guardrail snapshot for recent runs.
    Highlights stuck runs, attestation issues, export-risk runs, and provider instability.
    """
    from backend.database.repository import Repository
    from backend.api.trends_utils import task_runtime_alerts
    from backend.api.main import _get_task
    from shared.models import QueryStatus

    repo = Repository()
    records = repo.get_all_tasks(limit=limit)
    inspected: list[dict[str, Any]] = []
    issue_count = 0

    for item in records:
        task_id = item.get("task_id")
        if not task_id:
            continue
        full = _get_task(task_id) or item
        alerts = task_runtime_alerts(full)
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
