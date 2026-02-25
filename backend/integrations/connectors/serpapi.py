import datetime
import os
from typing import Any, Dict, List, Optional

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from backend.utils.request_cache import build_cache_key, request_cache
from backend.utils.url_quality import is_low_signal_search_url
from shared.config import get_settings
from shared.models import PlatformType, TrendItem


class SerpApiConnector(AbstractPlatformConnector):
    """
    Structured search discovery connector.
    Returns organic result candidates while filtering low-signal SERP wrappers.
    """

    @property
    def platform(self) -> str:
        return PlatformType.WEB.value

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.serpapi_api_key
        self.base_url = "https://serpapi.com/search.json"

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not self.api_key:
            return []

        cache_key = build_cache_key("serpapi.search", query=query, limit=limit)
        cached = await request_cache.get(cache_key)
        if cached is not None:
            return cached

        lock = await request_cache.get_lock(cache_key)
        async with lock:
            cached_after_lock = await request_cache.get(cache_key)
            if cached_after_lock is not None:
                return cached_after_lock

            if not await rate_limiter.wait_for_slot(self.platform):
                return []

            params = {
                "engine": "google",
                "q": query,
                "hl": "en",
                "gl": "us",
                "num": max(1, min(limit * 2, 20)),  # pull extra then filter
                "api_key": self.api_key,
            }
            try:
                timeout_secs = float(os.getenv("SERPAPI_TIMEOUT_SECS", "20"))
                async with httpx.AsyncClient(timeout=timeout_secs) as client:
                    response = await client.get(self.base_url, params=params)
                if response.status_code != 200:
                    return []
                data = response.json()
                organic = data.get("organic_results") or []
                items: List[TrendItem] = []
                now = datetime.datetime.now(datetime.timezone.utc)
                for idx, row in enumerate(organic):
                    if len(items) >= limit:
                        break
                    if not isinstance(row, dict):
                        continue
                    url = str(row.get("link") or row.get("url") or "").strip()
                    if not url or is_low_signal_search_url(url):
                        continue
                    items.append(
                        TrendItem(
                            id=url or f"serpapi_{idx}",
                            platform=PlatformType.WEB.value,
                            title=str(row.get("title") or "Web Result").strip(),
                            content=str(row.get("snippet") or row.get("rich_snippet") or "").strip(),
                            author=str(row.get("source") or "SerpApi"),
                            author_handle="serpapi",
                            url=url,
                            timestamp=now,
                            metrics={
                                "position": row.get("position"),
                            },
                            raw_data=row,
                        )
                    )
                if items:
                    await request_cache.set(cache_key, items, self.settings.cache_ttl_seconds)
                return items
            except Exception as e:
                print(f"SerpApi search failed: {e}")
                return []
            finally:
                await request_cache.clear_inflight(cache_key)

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
