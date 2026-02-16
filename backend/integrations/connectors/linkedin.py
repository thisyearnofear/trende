import os
import asyncio
import datetime
from typing import List, Optional
from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from shared.config import get_settings
from backend.utils.rate_limit import rate_limiter
from backend.services.aisa_service import aisa_service

class LinkedInConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.LINKEDIN.value

    def __init__(self):
        self.aisa_key = os.getenv('AISA_API_KEY')

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Search LinkedIn posts using AIsa (Social Researcher pattern)."""
        # Apply Rate Limiting
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        if not self.aisa_key:
            return []

        try:
            # We use AIsa's Web Search to find LinkedIn posts specifically
            tavily_query = f"{query} site:linkedin.com/posts"
            results = await aisa_service.web_search(tavily_query, limit)
            
            if not results:
                return []

            items = []
            for res in results:
                url = res.get('url', '')
                author = "LinkedIn User"
                if '/in/' in url:
                    author = url.split('/in/')[1].split('/')[0]

                items.append(TrendItem(
                    id=url,
                    platform=self.platform,
                    title=res.get('title', 'LinkedIn Post'),
                    content=res.get('snippet', '') or res.get('content', ''),
                    author=author,
                    author_handle=author,
                    url=url,
                    timestamp=datetime.datetime.now(datetime.timezone.utc),
                    metrics={}, 
                    raw_data=res
                ))
            return items
            
        except Exception as e:
            print(f"LinkedIn (AIsa) search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
