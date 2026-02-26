"""
Agent actions routes for submitting and tracking actions.
"""

import json
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, Response

from backend.api.models import ActionSubmitRequest
from backend.api.services import TaskService


router = APIRouter(prefix="/api/actions", tags=["actions"])
task_service = TaskService()


@router.post("/submit", response_model=None)
async def submit_action(
    request: ActionSubmitRequest,
    background_tasks: BackgroundTasks,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> dict[str, Any] | Response:
    """Submit a new agent action."""
    if request.idempotency_key:
        existing = task_service.get_action_by_idempotency_key(request.idempotency_key)
        if existing:
            return {"action": existing, "idempotent": True}

    action_id = str(uuid.uuid4())
    created = task_service.create_action(
        action_id=action_id,
        action_type=request.action_type,
        task_id=request.task_id,
        caller_address=x_wallet_address,
        idempotency_key=request.idempotency_key,
        input_payload=request.input,
    )
    if not created:
        return Response(status_code=500, content=json.dumps({"error": "Failed to create action"}))

    # Import here to avoid circular dependency
    from backend.api.main import run_agent_action
    background_tasks.add_task(run_agent_action, action_id)
    return {"action": created, "idempotent": False}


@router.get("/{action_id}", response_model=None)
async def get_action_status(action_id: str) -> dict[str, Any] | Response:
    """Get the status of an action."""
    action = task_service.get_action(action_id)
    if not action:
        return Response(status_code=404, content=json.dumps({"error": "Action not found"}))
    return {"action": action}
