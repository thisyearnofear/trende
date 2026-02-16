import datetime
from typing import List, Optional
from urllib.parse import quote_plus

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from shared.models import PlatformType, TrendItem


class GDELTConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.GDELT.value

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        max_records = max(1, min(limit, 50))
        url = (
            "https://api.gdeltproject.org/api/v2/doc/doc"
            f"?query={quote_plus(query)}&mode=ArtList&format=json"
            f"&maxrecords={max_records}&sort=DateDesc"
        )

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url)
            if response.status_code != 200:
                raise Exception(f"GDELT error: {response.status_code} {response.text}")

            data = response.json()
            articles = data.get("articles", []) or []
            items: List[TrendItem] = []
            for art in articles[:limit]:
                ts_raw = art.get("seendate", "")
                timestamp = datetime.datetime.now(datetime.timezone.utc)
                if ts_raw and len(ts_raw) == 14:
                    try:
                        timestamp = datetime.datetime.strptime(
                            ts_raw, "%Y%m%d%H%M%S"
                        ).replace(tzinfo=datetime.timezone.utc)
                    except Exception:
                        pass

                url_value = art.get("url", "")
                domain = art.get("domain", "GDELT")
                items.append(
                    TrendItem(
                        id=url_value or f"gdelt_{timestamp.timestamp()}",
                        platform=self.platform,
                        title=art.get("title", "GDELT Article"),
                        content=art.get("snippet", "") or art.get("title", ""),
                        author=domain,
                        author_handle=domain,
                        url=url_value,
                        timestamp=timestamp,
                        metrics={},
                        raw_data=art,
                    )
                )
            return items
        except Exception as e:
            print(f"GDELT search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None

