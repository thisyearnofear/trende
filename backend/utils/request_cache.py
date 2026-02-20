import asyncio
import copy
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


class RequestCache:
    """
    Lightweight async TTL cache with in-flight de-duplication.
    Prevents duplicate upstream API calls when concurrent requests share a key.
    """

    def __init__(self) -> None:
        self._entries: Dict[str, _CacheEntry] = {}
        self._inflight: Dict[str, asyncio.Lock] = {}
        self._guard = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self._guard:
            entry = self._entries.get(key)
            if not entry:
                return None
            if entry.expires_at <= time.time():
                self._entries.pop(key, None)
                return None
            return copy.deepcopy(entry.value)

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return
        async with self._guard:
            self._entries[key] = _CacheEntry(
                value=copy.deepcopy(value),
                expires_at=time.time() + ttl_seconds,
            )

    async def get_lock(self, key: str) -> asyncio.Lock:
        async with self._guard:
            lock = self._inflight.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._inflight[key] = lock
            return lock

    async def clear_inflight(self, key: str) -> None:
        async with self._guard:
            lock = self._inflight.get(key)
            if lock and not lock.locked():
                self._inflight.pop(key, None)


request_cache = RequestCache()


def build_cache_key(prefix: str, **parts: Any) -> str:
    normalized = []
    for k in sorted(parts.keys()):
        v = parts[k]
        if isinstance(v, str):
            normalized.append(f"{k}={v.strip().lower()}")
        else:
            normalized.append(f"{k}={v}")
    return f"{prefix}::" + "|".join(normalized)
