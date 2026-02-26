"""
Public Research Commons routes for browsing completed research.
"""

from typing import Any

from fastapi import APIRouter, Query

from backend.database.repository import Repository


router = APIRouter(prefix="/api/commons", tags=["commons"])
repo = Repository()


@router.get("")
async def get_public_commons(
    limit: int = Query(50, ge=1, le=100),
    sponsor: str | None = None,
) -> dict[str, Any]:
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
