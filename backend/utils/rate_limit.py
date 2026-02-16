import time
import asyncio
from typing import Dict, Any, Optional, Tuple
from collections import deque
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
import os


@dataclass
class UserRateLimitInfo:
    """Rate limit info for a user (wallet or IP)."""
    identifier: str
    tier: str  # 'anonymous', 'connected', 'premium'
    remaining: int
    limit: int
    reset_at: datetime
    
    def to_headers(self) -> Dict[str, str]:
        return {
            "X-RateLimit-Remaining": str(self.remaining),
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Reset": self.reset_at.isoformat(),
            "X-RateLimit-Tier": self.tier,
        }


class TokenBucket:
    def __init__(self, rate: float, capacity: float):
        self.rate = rate # Tokens per second
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self._lock = asyncio.Lock()

    async def consume(self, amount: int = 1) -> bool:
        async with self._lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_update = now
            
            if self.tokens >= amount:
                self.tokens -= amount
                return True
            return False


@dataclass
class DailyUsage:
    """Tracks daily usage for a user."""
    count: int = 0
    reset_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ) + timedelta(days=1))
    
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) >= self.reset_at
    
    def reset_if_expired(self):
        if self.is_expired():
            self.count = 0
            self.reset_at = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            ) + timedelta(days=1)


class UserRateLimiter:
    """Rate limiter with tiered access based on wallet connection."""
    
    def __init__(self):
        self._usage: Dict[str, DailyUsage] = {}
        self._lock = asyncio.Lock()
        
        # Load limits from env or use defaults
        self.free_limit = int(os.getenv("FREE_TIER_DAILY_LIMIT", "3"))
        self.connected_limit = int(os.getenv("CONNECTED_TIER_DAILY_LIMIT", "10"))
    
    def _get_tier(self, wallet_address: Optional[str], has_premium: bool = False) -> Tuple[str, int]:
        """Determine user's tier and daily limit."""
        if has_premium:
            return "premium", float('inf')
        if wallet_address:
            return "connected", self.connected_limit
        return "anonymous", self.free_limit
    
    def _get_identifier(self, wallet_address: Optional[str], ip_address: str) -> str:
        """Get unique identifier for rate limiting."""
        # Prefer wallet address, fall back to IP
        return wallet_address.lower() if wallet_address else f"ip:{ip_address}"
    
    async def check_and_consume(
        self,
        wallet_address: Optional[str],
        ip_address: str,
        has_premium: bool = False
    ) -> Tuple[bool, UserRateLimitInfo]:
        """
        Check if user can make a request and consume a token if so.
        Returns (allowed, rate_limit_info).
        """
        async with self._lock:
            tier, limit = self._get_tier(wallet_address, has_premium)
            identifier = self._get_identifier(wallet_address, ip_address)
            
            # Get or create usage record
            if identifier not in self._usage:
                self._usage[identifier] = DailyUsage()
            
            usage = self._usage[identifier]
            usage.reset_if_expired()
            
            # Premium users have unlimited access
            if tier == "premium":
                usage.count += 1
                return True, UserRateLimitInfo(
                    identifier=identifier,
                    tier=tier,
                    remaining=float('inf'),
                    limit=float('inf'),
                    reset_at=usage.reset_at,
                )
            
            remaining = max(0, limit - usage.count)
            info = UserRateLimitInfo(
                identifier=identifier,
                tier=tier,
                remaining=remaining,
                limit=limit,
                reset_at=usage.reset_at,
            )
            
            if usage.count >= limit:
                return False, info
            
            usage.count += 1
            info.remaining = max(0, limit - usage.count)
            return True, info
    
    async def get_info(
        self,
        wallet_address: Optional[str],
        ip_address: str,
        has_premium: bool = False
    ) -> UserRateLimitInfo:
        """Get rate limit info without consuming a token."""
        async with self._lock:
            tier, limit = self._get_tier(wallet_address, has_premium)
            identifier = self._get_identifier(wallet_address, ip_address)
            
            if identifier not in self._usage:
                self._usage[identifier] = DailyUsage()
            
            usage = self._usage[identifier]
            usage.reset_if_expired()
            
            remaining = float('inf') if tier == "premium" else max(0, limit - usage.count)
            
            return UserRateLimitInfo(
                identifier=identifier,
                tier=tier,
                remaining=remaining,
                limit=limit if tier != "premium" else float('inf'),
                reset_at=usage.reset_at,
            )


class RateLimiter:
    def __init__(self):
        # Platform-specific buckets (for external API rate limiting)
        self.buckets = {
            "twitter": TokenBucket(rate=0.5, capacity=15),
            "newsapi": TokenBucket(rate=0.1, capacity=5),
            "linkedin": TokenBucket(rate=1.0, capacity=10),
        }

    async def check_rate_limit(self, platform: str) -> bool:
        bucket = self.buckets.get(platform)
        if not bucket:
            return True
        return await bucket.consume()

    async def wait_for_slot(self, platform: str, timeout: int = 30):
        """Blocks until a slot is available or timeout is reached."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if await self.check_rate_limit(platform):
                return True
            await asyncio.sleep(1)
        return False


# Global instances
rate_limiter = RateLimiter()
user_rate_limiter = UserRateLimiter()
