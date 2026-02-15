import os
import asyncio
from typing import List, Optional
from datetime import datetime
from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from shared.config import get_settings
from backend.utils.rate_limit import rate_limiter
from composio_langgraph import ComposioToolSet, Action

class LinkedInConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.LINKEDIN.value

    def __init__(self):
        settings = get_settings()
        self.toolset = ComposioToolSet(api_key=settings.composio_api_key)

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Search LinkedIn posts using Tavily (via Composio)."""
        # Apply Rate Limiting
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        try:
            # We use Tavily to search LinkedIn specifically as native search is restricted
            tavily_query = f"{query} site:linkedin.com/posts"
            
            # Execute search via Composio's Tavily integration
            result = self.toolset.execute_action(
                action=Action.TAVILY_SEARCH,
                params={"query": tavily_query, "search_depth": "advanced"}
            )
            
            if not result or 'results' not in result:
                return []

            items = []
            for res in result['results'][:limit]:
                url = res.get('url', '')
                author = "LinkedIn User"
                if '/in/' in url:
                    author = url.split('/in/')[1].split('/')[0]

                items.append(TrendItem(
                    id=url,
                    platform=self.platform,
                    title=res.get('title', 'LinkedIn Post'),
                    content=res.get('content', '') or res.get('snippet', ''),
                    author=author,
                    author_handle=author,
                    url=url,
                    timestamp=datetime.now(),
                    metrics={}, 
                    raw_data=res
                ))
            return items
            
        except Exception as e:
            print(f"LinkedIn (Tavily) search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None
