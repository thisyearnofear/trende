"""
Telemetry routes for research events and mission tracking.
"""

import json
import uuid
from typing import Any

from fastapi import APIRouter, Header, Request, Response

from backend.api.models import ResearchTelemetryRequest
from backend.api.services import TaskService


router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])
task_service = TaskService()


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/mission-event", response_model=None)
async def ingest_mission_event(
    event: ResearchTelemetryRequest,
    request: Request,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> Any:
    """Ingest a mission telemetry event."""
    created = task_service.create_mission_event(
        event_id=str(uuid.uuid4()),
        event_name=event.name,
        payload=event.payload,
        session_id=event.session_id,
        source=event.source or "frontend",
        stage=event.stage,
        wallet_address=x_wallet_address,
        client_ip=get_client_ip(request),
        user_agent=(request.headers.get("User-Agent") or "")[:240],
    )
    if not created:
        return Response(status_code=500, content=json.dumps({"error": "Failed to store telemetry event"}))
    return {"ok": True, "event": created}


@router.get("/mission-events")
async def list_mission_events(
    limit: int = 200,
    session_id: str | None = None,
    name: str | None = None,
) -> dict[str, Any]:
    """List mission telemetry events with optional filtering."""
    rows = task_service.get_mission_events(
        limit=max(1, min(limit, 1000)),
        session_id=(session_id or "").strip() or None,
        event_name=(name or "").strip().lower() or None,
    )
    return {"events": rows, "total": len(rows)}
