import os
from typing import List, Optional
from datetime import datetime
from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from backend.services.aisa_service import aisa_service
from backend.utils.rate_limit import rate_limiter

class TikTokConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.TIKTOK.value

    def __init__(self):
        self.aisa_key = os.getenv('AISA_API_KEY')

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Search TikTok trends using AIsa (Social Discovery pattern)."""
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        if not self.aisa_key:
            return []

        try:
            # Multi-source bridging: Search TikTok via web discovery
            search_query = f"{query} site:tiktok.com"
            results = await aisa_service.web_search(search_query, limit)
            
            if not results:
                return []

            items = []
            for res in results:
                items.append(TrendItem(
                    id=res.get('url', f"tiktok_{datetime.now().timestamp()}"),
                    platform=self.platform,
                    title=res.get('title', 'TikTok Trend'),
                    content=res.get('snippet', '') or res.get('content', ''),
                    author="TikTok Creator",
                    author_handle="tiktok",
                    url=res.get('url', ''),
                    timestamp=datetime.now(),
                    metrics={}, 
                    raw_data=res
                ))
            return items
        except Exception as e:
            print(f"TikTok search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
