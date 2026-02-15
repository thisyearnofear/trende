import time
import asyncio
from typing import Dict, Any, Optional
from collections import deque

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

class RateLimiter:
    def __init__(self):
        # Platform-specific buckets
        self.buckets = {
            "twitter": TokenBucket(rate=0.5, capacity=15), # 1 request every 2 seconds, burst to 15
            "newsapi": TokenBucket(rate=0.1, capacity=5),  # 1 request every 10 seconds, burst to 5
            "linkedin": TokenBucket(rate=1.0, capacity=10),
        }

    async def check_rate_limit(self, platform: str) -> bool:
        bucket = self.buckets.get(platform)
        if not bucket:
            return True # No limit defined
        return await bucket.consume()

    async def wait_for_slot(self, platform: str, timeout: int = 30):
        """Blocks until a slot is available or timeout is reached."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if await self.check_rate_limit(platform):
                return True
            await asyncio.sleep(1) # Wait and retry
        return False

rate_limiter = RateLimiter()
