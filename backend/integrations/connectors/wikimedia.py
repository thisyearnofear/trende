import datetime
import json
import re
from typing import List, Optional
from urllib.parse import quote_plus

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from shared.models import PlatformType, TrendItem


class WikimediaConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.WIKIMEDIA.value

    def _matches_query(self, query: str, text: str) -> bool:
        tokens = [t.lower() for t in re.split(r"\W+", query) if len(t) > 2]
        if not tokens:
            return False
        hay = (text or "").lower()
        return any(token in hay for token in tokens)

    async def _search_eventstream(self, query: str, limit: int) -> List[TrendItem]:
        stream_url = "https://stream.wikimedia.org/v2/stream/recentchange"
        items: List[TrendItem] = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            async with client.stream("GET", stream_url) as response:
                if response.status_code != 200:
                    return []

                event_count = 0
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    event_count += 1
                    if event_count > 200:
                        break

                    try:
                        payload = json.loads(line[6:])
                    except Exception:
                        continue

                    title = payload.get("title", "")
                    comment = payload.get("comment", "") or ""
                    text_blob = f"{title} {comment}"
                    if not self._matches_query(query, text_blob):
                        continue

                    wiki_url = payload.get("meta", {}).get("uri")
                    if not wiki_url and title:
                        wiki_url = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"

                    ts = payload.get("timestamp")
                    timestamp = datetime.datetime.now(datetime.timezone.utc)
                    if ts:
                        try:
                            timestamp = datetime.datetime.fromtimestamp(
                                int(ts), tz=datetime.timezone.utc
                            )
                        except Exception:
                            pass

                    user = payload.get("user", "Wikimedia")
                    items.append(
                        TrendItem(
                            id=str(payload.get("id", f"wm_{timestamp.timestamp()}")),
                            platform=self.platform,
                            title=title or "Wikimedia Recent Change",
                            content=comment or "Recent change event",
                            author=user,
                            author_handle=user,
                            url=wiki_url or "",
                            timestamp=timestamp,
                            metrics={},
                            raw_data=payload,
                        )
                    )
                    if len(items) >= limit:
                        break

        return items

    async def _fallback_title_search(self, query: str, limit: int) -> List[TrendItem]:
        search_url = (
            "https://en.wikipedia.org/w/rest.php/v1/search/title"
            f"?q={quote_plus(query)}&limit={max(1, min(limit, 50))}"
        )
        items: List[TrendItem] = []
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(search_url)
        if response.status_code != 200:
            return []

        pages = response.json().get("pages", []) or []
        for page in pages[:limit]:
            title = page.get("title", "Wikipedia Page")
            key = page.get("key", title.replace(" ", "_"))
            excerpt = page.get("excerpt", "") or page.get("description", "")
            items.append(
                TrendItem(
                    id=f"wm_page_{key}",
                    platform=self.platform,
                    title=title,
                    content=excerpt,
                    author="Wikipedia",
                    author_handle="wikipedia",
                    url=f"https://en.wikipedia.org/wiki/{key}",
                    timestamp=datetime.datetime.now(datetime.timezone.utc),
                    metrics={},
                    raw_data=page,
                )
            )
        return items

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        try:
            items = await self._search_eventstream(query, limit)
            if items:
                return items
        except Exception as e:
            print(f"Wikimedia EventStreams search failed: {e}")

        try:
            return await self._fallback_title_search(query, limit)
        except Exception as e:
            print(f"Wikimedia fallback search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None

