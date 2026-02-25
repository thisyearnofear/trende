import datetime
from typing import Any, List, Optional

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from backend.utils.request_cache import build_cache_key, request_cache
from backend.utils.url_quality import is_low_signal_search_url
from shared.config import get_settings
from shared.models import PlatformType, TrendItem


class FirecrawlConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.FIRECRAWL.value

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.firecrawl_api_key
        self.base_url = "https://api.firecrawl.dev/v1"

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not self.api_key:
            return []

        cache_key = build_cache_key("firecrawl.search", query=query, limit=limit)
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

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "x-api-key": self.api_key,
                "Content-Type": "application/json",
            }
            payload = {
                "query": query,
                "limit": max(1, min(limit, 10)),
                "scrapeOptions": {"formats": ["markdown"]},
            }
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(f"{self.base_url}/search", json=payload, headers=headers)
                if response.status_code != 200:
                    return []
                data = response.json()
                raw_items = data.get("data") or data.get("results") or []
                items: List[TrendItem] = []
                for idx, row in enumerate(raw_items[:limit]):
                    if not isinstance(row, dict):
                        continue
                    url = str(row.get("url") or row.get("source") or "").strip()
                    if not url:
                        continue
                    if is_low_signal_search_url(url):
                        continue
                    title = str(row.get("title") or "Web Result").strip()
                    snippet = str(row.get("description") or row.get("snippet") or row.get("markdown") or "").strip()
                    items.append(
                        TrendItem(
                            id=url or f"firecrawl_{idx}",
                            platform=self.platform,
                            title=title or "Web Result",
                            content=snippet or title or query,
                            author="Firecrawl",
                            author_handle="firecrawl",
                            url=url,
                            timestamp=datetime.datetime.now(datetime.timezone.utc),
                            metrics={},
                            raw_data=row,
                        )
                    )
                if items:
                    await request_cache.set(cache_key, items, self.settings.cache_ttl_seconds)
                return items
            except Exception as e:
                print(f"Firecrawl search failed: {e}")
                return []
            finally:
                await request_cache.clear_inflight(cache_key)

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
