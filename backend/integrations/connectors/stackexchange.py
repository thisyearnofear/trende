import datetime
from typing import List, Optional
from urllib.parse import quote_plus

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from shared.models import PlatformType, TrendItem


class StackExchangeConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.STACKEXCHANGE.value

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        page_size = max(1, min(limit, 50))
        url = (
            "https://api.stackexchange.com/2.3/search/advanced"
            f"?order=desc&sort=relevance&q={quote_plus(query)}"
            f"&site=stackoverflow&pagesize={page_size}"
        )

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url)
            if response.status_code != 200:
                raise Exception(
                    f"StackExchange error: {response.status_code} {response.text}"
                )

            questions = response.json().get("items", []) or []
            items: List[TrendItem] = []
            for q in questions[:limit]:
                created = q.get("creation_date")
                timestamp = datetime.datetime.now(datetime.timezone.utc)
                if created:
                    try:
                        timestamp = datetime.datetime.fromtimestamp(
                            int(created), tz=datetime.timezone.utc
                        )
                    except Exception:
                        pass

                owner = q.get("owner", {}) or {}
                author = owner.get("display_name", "StackExchange User")
                url_value = q.get("link", "")
                qid = str(q.get("question_id", "unknown"))
                tags = ", ".join(q.get("tags", [])[:4])
                items.append(
                    TrendItem(
                        id=f"se_{qid}",
                        platform=self.platform,
                        title=q.get("title", "StackExchange Question"),
                        content=f"Tags: {tags}" if tags else q.get("title", ""),
                        author=author,
                        author_handle=author,
                        url=url_value,
                        timestamp=timestamp,
                        metrics={
                            "likes": int(q.get("score") or 0),
                            "comments": int(q.get("answer_count") or 0),
                            "views": int(q.get("view_count") or 0),
                        },
                        raw_data=q,
                    )
                )
            return items
        except Exception as e:
            print(f"StackExchange search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None

