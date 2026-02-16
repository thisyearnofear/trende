import os
import httpx
import datetime
from typing import List, Optional
from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from shared.config import get_settings
from backend.utils.rate_limit import rate_limiter

from backend.services.aisa_service import aisa_service

class NewsConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.NEWSAPI.value

    def __init__(self):
        self.settings = get_settings()
        self.aisa_key = os.getenv('AISA_API_KEY')
        self.news_api_key = self.settings.newsapi_key

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Search news articles using AIsa first, fallback to NewsAPI.org."""
        # Apply Rate Limiting
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        # 1. Try AIsa first
        if self.aisa_key:
            results = await aisa_service.web_search(query, limit)
            if results:
                print(f"[News] AIsa returned {len(results)} results")
                items = []
                for res in results:
                    items.append(TrendItem(
                        id=res.get('url', 'unknown'),
                        platform=self.platform,
                        title=res.get('title', 'Unknown News'),
                        content=res.get('snippet', '') or res.get('content', ''),
                        author=res.get('source', 'Web'),
                        author_handle=res.get('source', 'Web'),
                        url=res.get('url', ''),
                        timestamp=datetime.datetime.now(datetime.timezone.utc),
                        metrics={},
                        raw_data=res
                    ))
                return items
            else:
                print(f"[News] AIsa returned no results, falling back to NewsAPI")

        # 2. Fallback to NewsAPI
        if not self.news_api_key:
            print("Warning: Neither AISA_API_KEY nor NEWSAPI_KEY set for News")
            return []

        try:
            async with httpx.AsyncClient() as client:
                url = f"https://newsapi.org/v2/everything?q={query}&pageSize={limit}&apiKey={self.news_api_key}"
                response = await client.get(url)
                
                if response.status_code != 200:
                    print(f"NewsAPI error: {response.status_code}")
                    return []

                data = response.json()
                articles = data.get('articles', [])
                items = []

                for art in articles:
                    # Parse timestamp safely
                    published_at = art.get('publishedAt')
                    if published_at:
                        try:
                            timestamp = datetime.datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                        except Exception:
                            timestamp = datetime.datetime.now(datetime.timezone.utc)
                    else:
                        timestamp = datetime.datetime.now(datetime.timezone.utc)
                    
                    items.append(TrendItem(
                        id=art.get('url', 'unknown'),
                        platform=self.platform,
                        title=art.get('title', 'Unknown News'),
                        content=art.get('description', '') or art.get('content', ''),
                        author=art.get('author') or art.get('source', {}).get('name') or "Unknown Source",
                        author_handle=art.get('source', {}).get('name') or "News",
                        url=art.get('url', ''),
                        timestamp=timestamp,
                        metrics={},
                        raw_data=art
                    ))
                return items
        except Exception as e:
            print(f"News search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
