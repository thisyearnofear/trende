import os
import httpx
import json
import datetime
from typing import List, Optional, Dict, Any
from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from shared.config import get_settings
from backend.utils.rate_limit import rate_limiter

class TabstackConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.WEB.value

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.tabstack_api_key
        self.base_url = "https://api.tabstack.ai"

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Performs a deep research search using Tabstack's Research endpoint."""
        if not self.api_key:
            return []

        # Apply Rate Limiting (Tabstack is usually generous but we protect)
        if not await rate_limiter.wait_for_slot("web"):
            return []

        try:
            # Note: The /research endpoint streams SSE. 
            # For a 'connector' pattern, we'll collect the final result.
            # In a more advanced version, we might stream this directly to the frontend.
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                # Since research is streaming, we handle it as a stream
                async with client.stream("POST", f"{self.base_url}/research", 
                                       json={"query": query, "mode": "fast"}, 
                                       headers=headers, timeout=60.0) as response:
                    
                    final_answer = ""
                    sources = []
                    
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        
                        try:
                            data = json.loads(line[6:])
                            if data.get("type") == "answer":
                                final_answer = data.get("content", "")
                            elif data.get("type") == "sources":
                                sources = data.get("sources", [])
                        except Exception:
                            continue
                    
                    if not final_answer and not sources:
                        return []

                    # Convert the research summary into a lead TrendItem
                    items = [
                        TrendItem(
                            id=f"tabstack_{datetime.datetime.now(datetime.timezone.utc).timestamp()}",
                            platform=self.platform,
                            title=f"Deep Research for: {query}",
                            content=final_answer,
                            author="Tabstack AI",
                            author_handle="tabstack",
                            url=sources[0].get('url', '') if sources else "",
                            timestamp=datetime.datetime.now(datetime.timezone.utc),
                            metrics={"depth": 10},
                            raw_data={"sources": sources}
                        )
                    ]
                    
                    # Also include the top sources as individual items
                    for src in sources[:limit-1]:
                        items.append(TrendItem(
                            id=src.get('url', ''),
                            platform=self.platform,
                            title=src.get('title', 'Historical Source'),
                            content=src.get('snippet', ''),
                            author="Web",
                            url=src.get('url', ''),
                            timestamp=datetime.datetime.now(datetime.timezone.utc),
                            metrics={},
                            raw_data=src
                        ))
                    
                    return items
                    
        except Exception as e:
            print(f"Tabstack search failed: {e}")
            return []

    async def extract_content(self, url: str) -> Optional[str]:
        """Extracts high-quality Markdown content from any URL."""
        if not self.api_key:
            return None
            
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                response = await client.post(
                    f"{self.base_url}/extract",
                    json={"url": url, "format": "markdown"},
                    headers=headers
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("content")
        except Exception as e:
            print(f"Tabstack extraction failed for {url}: {e}")
        return None

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        # Could use extract_content here to enrich a finding
        return None
