import httpx
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
from urllib.parse import quote_plus
from backend.integrations.base import AbstractPlatformConnector
from backend.utils.request_cache import build_cache_key, request_cache
from shared.models import TrendItem, PlatformType
from shared.config import get_settings
from backend.utils.rate_limit import rate_limiter

class TinyFishConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.TINYFISH.value

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.tinyfish_api_key
        self.base_url = "https://agent.tinyfish.ai/v1"

    async def search(self, query: str, limit: int = 5) -> List[TrendItem]:
        """Perform deep web research via TinyFish agent."""
        if not self.api_key:
            return []

        cache_key = build_cache_key("tinyfish.search", query=query, limit=limit)
        cached = await request_cache.get(cache_key)
        if cached is not None:
            return cached

        lock = await request_cache.get_lock(cache_key)
        async with lock:
            cached_after_lock = await request_cache.get(cache_key)
            if cached_after_lock is not None:
                return cached_after_lock

        # TinyFish is premium, we use it for deep discovery
            if not await rate_limiter.wait_for_slot("tinyfish"):
                # Fallback to web if tinyfish is limited?
                # For now, let's just return empty and let the workflow handle it.
                return []

            headers = {
                "X-API-Key": self.api_key,
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            }
            
            # Construct a goal-based research prompt for the TinyFish web agent
            search_url = f"https://duckduckgo.com/?q={quote_plus(query)}"
            payload = {
                "url": search_url,
                "goal": (
                    f"Identify emerging signals, sentiment, and key findings for the topic: '{query}'. "
                    "Open relevant primary sources (docs, posts, research pages) and return concise findings with source URLs."
                ),
                "browser_profile": "stealth",  # Use stealth for better compatibility
                "proxy_config": {"enabled": False},
            }

            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream("POST", f"{self.base_url}/automation/run-sse", headers=headers, json=payload) as response:
                        if response.status_code != 200:
                            body = await response.aread()
                            preview = body.decode("utf-8", errors="ignore")[:300]
                            print(f"TinyFish search failed with status {response.status_code}: {preview}")
                            return []
                        
                        final_result = await self._parse_sse_response(response)
                        items = self._to_trend_items(query, final_result, limit)
                        if items:
                            await request_cache.set(cache_key, items, self.settings.cache_ttl_seconds * 2)
                        return items
            except Exception as e:
                print(f"TinyFish search exception: {e}")
                return []
            finally:
                await request_cache.clear_inflight(cache_key)

    async def extract_content(self, url: str, goal: Optional[str] = None) -> Optional[str]:
        """Extracts deep content from a specific URL using TinyFish's agentic reasoning."""
        if not self.api_key:
            return None

        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }
        
        payload = {
            "url": url,
            "goal": goal or "Extract the main content, key data points, and any relevant metrics from this page in Markdown format.",
            "browser_profile": "stealth",
            "proxy_config": {"enabled": False},
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", f"{self.base_url}/automation/run-sse", headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        return None
                    return await self._parse_sse_response(response)
        except Exception as e:
            print(f"TinyFish extraction failed for {url}: {e}")
        return None

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        # URL extraction is the primary use case for details
        return None

    async def _parse_sse_response(self, response: httpx.Response) -> str:
        """Parse SSE stream from TinyFish."""
        full_content = ""
        async for line in response.aiter_lines():
            if not line or not line.startswith("data:"):
                continue
            
            raw_payload = line[len("data:"):].strip()
            if raw_payload == "[DONE]":
                break
            
            try:
                data = json.loads(raw_payload)
                # TinyFish SSE usually sends events with types: log, result, error, complete
                if data.get("type") == "COMPLETE":
                    # Look for resultJson or result text
                    result = data.get("resultJson") or data.get("result")
                    if result:
                        if isinstance(result, (dict, list)):
                            return json.dumps(result, indent=2)
                        return str(result)
                elif data.get("type") == "CONTENT":
                     # Some streams might provide partial content
                     content = data.get("content", "")
                     full_content += content
            except Exception:
                continue
        
        return full_content

    def _to_trend_items(self, query: str, result_text: str, limit: int) -> List[TrendItem]:
        if not result_text:
            return []

        now = datetime.now(timezone.utc)
        
        # Create a primary item for the overall research
        items = [
            TrendItem(
                id=f"tinyfish_{now.timestamp()}",
                platform=self.platform,
                title=f"Autonomous Research: {query}",
                content=result_text,
                author="TinyFish Agent",
                author_handle="tinyfish",
                url="https://agent.tinyfish.ai",
                timestamp=now,
                metrics={"agentic_depth": 1},
                raw_data={"raw_result": result_text},
            )
        ]
        
        # If the result text looks like JSON, we could try to parse and split into multiple items
        # But for now, keeping it simple as one high-fidelity finding.
        
        return items
