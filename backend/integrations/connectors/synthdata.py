import datetime
from typing import Any, List, Optional
from urllib.parse import quote_plus

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from backend.utils.request_cache import build_cache_key, request_cache
from shared.config import get_settings
from shared.models import PlatformType, TrendItem


class SynthDataConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.SYNTHDATA.value

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.synthdata_api_key
        self.base_url = "https://api.synthdata.co"

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not self.api_key:
            return []

        cache_key = build_cache_key("synthdata.search", query=query, limit=limit)
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

            headers = {"Authorization": f"Apikey {self.api_key}"}
            endpoint_candidates = [
                f"{self.base_url}/insights?query={quote_plus(query)}&limit={max(1, min(limit, 10))}",
                f"{self.base_url}/insights/search?query={quote_plus(query)}&limit={max(1, min(limit, 10))}",
            ]

            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    payload: dict[str, Any] | None = None
                    for endpoint in endpoint_candidates:
                        response = await client.get(endpoint, headers=headers)
                        if response.status_code == 200:
                            payload = response.json()
                            break
                if not payload:
                    return []

                raw_items = (
                    payload.get("data")
                    or payload.get("results")
                    or payload.get("insights")
                    or []
                )
                items: List[TrendItem] = []
                for idx, row in enumerate(raw_items[:limit]):
                    if not isinstance(row, dict):
                        continue
                    url = str(row.get("url") or row.get("source_url") or row.get("link") or "").strip()
                    title = str(row.get("title") or row.get("headline") or "Market Insight").strip()
                    content = str(
                        row.get("summary")
                        or row.get("description")
                        or row.get("insight")
                        or row.get("content")
                        or ""
                    ).strip()
                    if not url:
                        url = f"https://docs.synthdata.co/?q={quote_plus(query)}"
                    items.append(
                        TrendItem(
                            id=str(row.get("id") or row.get("symbol") or f"synthdata_{idx}"),
                            platform=self.platform,
                            title=title or "Market Insight",
                            content=content or title or query,
                            author=str(row.get("source") or "SynthData"),
                            author_handle="synthdata",
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
                print(f"SynthData search failed: {e}")
                return []
            finally:
                await request_cache.clear_inflight(cache_key)

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None

