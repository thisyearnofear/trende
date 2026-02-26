"""
Agent-to-Agent (A2A) routes for external integrations.
"""

import json
import os
from typing import Any

from fastapi import APIRouter, Response

from backend.api.background_service import background_service
from backend.services.x402_service import X402Payment, x402_service
from shared.models import QueryStatus


router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.get("/alpha/{task_id}")
async def get_agent_alpha(
    task_id: str,
    payment: X402Payment | None = None,
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
    task = background_service.get_task(task_id)
    if not task or task.get("status") != QueryStatus.COMPLETED:
        return Response(
            status_code=404,
            content=json.dumps({"error": "Alpha not ready or task not found"}),
        )

    data = task.get("research_payload", {})
    if not data:
        return Response(
            status_code=404,
            content=json.dumps({"error": "Architect failed to generate manifest"}),
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
