import os
import datetime
from typing import List, Optional
from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from backend.services.aisa_service import aisa_service
from backend.utils.rate_limit import rate_limiter

class YouTubeConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.YOUTUBE.value

    def __init__(self):
        self.aisa_key = os.getenv('AISA_API_KEY')

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Search YouTube videos using AIsa (Video Content Discovery)."""
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        if not self.aisa_key:
            return []

        try:
            # Multi-source bridging: Search YouTube via web discovery
            search_query = f"{query} site:youtube.com"
            results = await aisa_service.web_search(search_query, limit)
            
            if not results:
                return []

            items = []
            for res in results:
                items.append(TrendItem(
                    id=res.get('url', f"youtube_{datetime.datetime.now(datetime.timezone.utc).timestamp()}"),
                    platform=self.platform,
                    title=res.get('title', 'YouTube Video'),
                    content=res.get('snippet', '') or res.get('content', ''),
                    author="YouTube Creator",
                    author_handle="youtube",
                    url=res.get('url', ''),
                    timestamp=datetime.datetime.now(datetime.timezone.utc),
                    metrics={}, 
                    raw_data=res
                ))
            return items
        except Exception as e:
            print(f"YouTube search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
