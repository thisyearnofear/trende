"""
User-related routes for rate limiting and user info.
"""

from typing import Any

from fastapi import APIRouter, Header, Request

from backend.utils.rate_limit import user_rate_limiter


router = APIRouter(prefix="/api/user", tags=["user"])


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/rate-limit")
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
