import os
import httpx
from typing import List, Optional
from datetime import datetime
from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from shared.config import get_settings
from backend.utils.rate_limit import rate_limiter

class NewsConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.NEWSAPI.value

    def __init__(self):
        self.settings = get_settings()
        self.news_api_key = self.settings.newsapi_key

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Search news articles using NewsAPI.org."""
        # Apply Rate Limiting
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        if not self.news_api_key:
            print("Warning: NEWSAPI_KEY not set")
            return []

        try:
            async with httpx.AsyncClient() as client:
                url = f"https://newsapi.org/v2/everything?q={query}&pageSize={limit}&apiKey={self.news_api_key}"
                response = await client.get(url)
                
                if response.status_code != 200:
                    print(f"NewsAPI error: {response.status_code}")
                    # TODO: Trigger Tavily fallback here if needed
                    return []

                data = response.json()
                articles = data.get('articles', [])
                items = []

                for art in articles:
                    items.append(TrendItem(
                        id=art.get('url', 'unknown'),
                        platform=self.platform,
                        title=art.get('title', 'Unknown News'),
                        content=art.get('description', '') or art.get('content', ''),
                        author=art.get('author', 'Unknown Source'),
                        author_handle=art.get('source', {}).get('name'),
                        url=art.get('url', ''),
                        timestamp=datetime.fromisoformat(art.get('publishedAt').replace('Z', '+00:00')) if art.get('publishedAt') else datetime.now(),
                        metrics={}, # News doesn't always have easy metrics
                        raw_data=art
                    ))
                return items
        except Exception as e:
            print(f"News search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
