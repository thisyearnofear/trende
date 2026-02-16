import datetime
from typing import List, Optional
from urllib.parse import quote_plus

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from shared.models import PlatformType, TrendItem


class HackerNewsConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.HACKERNEWS.value

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        per_page = max(1, min(limit, 50))
        url = (
            "https://hn.algolia.com/api/v1/search"
            f"?query={quote_plus(query)}&tags=story&hitsPerPage={per_page}"
        )

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url)
            if response.status_code != 200:
                raise Exception(f"Hacker News error: {response.status_code} {response.text}")

            hits = response.json().get("hits", []) or []
            items: List[TrendItem] = []
            for hit in hits[:limit]:
                created_at = hit.get("created_at")
                timestamp = datetime.datetime.now(datetime.timezone.utc)
                if created_at:
                    try:
                        timestamp = datetime.datetime.fromisoformat(
                            created_at.replace("Z", "+00:00")
                        )
                    except Exception:
                        pass

                object_id = str(hit.get("objectID", "unknown"))
                url_value = (
                    hit.get("url")
                    or f"https://news.ycombinator.com/item?id={object_id}"
                )
                author = hit.get("author", "Hacker News")
                items.append(
                    TrendItem(
                        id=f"hn_{object_id}",
                        platform=self.platform,
                        title=hit.get("title") or "Hacker News Story",
                        content=hit.get("story_text", "") or hit.get("title", ""),
                        author=author,
                        author_handle=author,
                        url=url_value,
                        timestamp=timestamp,
                        metrics={
                            "likes": int(hit.get("points") or 0),
                            "comments": int(hit.get("num_comments") or 0),
                        },
                        raw_data=hit,
                    )
                )
            return items
        except Exception as e:
            print(f"Hacker News search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None

