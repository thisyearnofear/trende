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

class TabstackConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.WEB.value

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.tabstack_api_key
        self.base_url = "https://api.tabstack.ai/v1"

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Perform web research via Tabstack streaming endpoints."""
        if not self.api_key:
            return []

        cache_key = build_cache_key("tabstack.search", query=query, limit=limit)
        cached = await request_cache.get(cache_key)
        if cached is not None:
            return cached

        lock = await request_cache.get_lock(cache_key)
        async with lock:
            cached_after_lock = await request_cache.get(cache_key)
            if cached_after_lock is not None:
                return cached_after_lock

        # Apply Rate Limiting (Tabstack is usually generous but we protect)
            if not await rate_limiter.wait_for_slot("web"):
                return []

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            }
            timeout = httpx.Timeout(connect=10.0, read=90.0, write=30.0, pool=30.0)

            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    answer, sources = await self._search_automate(client, headers, query)
                    if not answer and not sources:
                        # Backward-compatible fallback for older Tabstack deployments.
                        answer, sources = await self._search_research(client, headers, query)
                    items = self._to_trend_items(query, answer, sources, limit)
                    if items:
                        await request_cache.set(cache_key, items, self.settings.cache_ttl_seconds)
                    return items
            except Exception as e:
                print(f"Tabstack search failed: {e}")
                return []
            finally:
                await request_cache.clear_inflight(cache_key)

    async def extract_content(self, url: str) -> Optional[str]:
        """Extracts high-quality Markdown content from any URL."""
        if not self.api_key:
            return None

        try:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    f"{self.base_url}/extract/markdown",
                    json={"url": url, "metadata": True},
                    headers=headers
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("content")
                # Backward compatibility with older endpoint shape.
                legacy = await client.post(
                    f"{self.base_url}/extract",
                    json={"url": url, "format": "markdown"},
                    headers=headers
                )
                if legacy.status_code == 200:
                    legacy_data = legacy.json()
                    return legacy_data.get("content")
        except Exception as e:
            print(f"Tabstack extraction failed for {url}: {e}")
        return None

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        # Could use extract_content here to enrich a finding
        return None

    async def _search_automate(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        query: str,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        payload = {
            "task": (
                "Research this topic on the web and summarize key findings. "
                "Include concrete source URLs where possible: "
                f"{query}"
            ),
            "url": f"https://duckduckgo.com/?q={quote_plus(query)}",
        }
        async with client.stream("POST", f"{self.base_url}/automate", headers=headers, json=payload) as response:
            if response.status_code != 200:
                return "", []
            return await self._parse_sse_response(response)

    async def _search_research(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        query: str,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        async with client.stream(
            "POST",
            f"{self.base_url}/research",
            headers=headers,
            json={"query": query, "mode": "fast"},
        ) as response:
            if response.status_code != 200:
                return "", []
            return await self._parse_sse_response(response)

    async def _parse_sse_response(
        self,
        response: httpx.Response,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        final_answer = ""
        sources: List[Dict[str, Any]] = []
        seen_urls = set()
        current_event = ""

        async for line in response.aiter_lines():
            if not line:
                continue
            if line.startswith("event:"):
                current_event = line[len("event:"):].strip()
                continue
            if not line.startswith("data:"):
                continue

            raw_payload = line[len("data:"):].strip()
            if not raw_payload or raw_payload == "[DONE]":
                continue

            try:
                data = json.loads(raw_payload)
            except Exception:
                continue

            event_type = current_event or str(data.get("type", "")).strip()
            final_answer = self._extract_final_answer(event_type, data, final_answer)
            self._collect_sources(data, sources, seen_urls)

        return final_answer, sources

    def _extract_final_answer(
        self,
        event_type: str,
        data: Dict[str, Any],
        current_answer: str,
    ) -> str:
        if event_type in {"task:completed", "complete"}:
            return (
                data.get("finalAnswer")
                or data.get("result", {}).get("finalAnswer")
                or current_answer
            )

        if data.get("type") == "answer":
            return data.get("content", current_answer)

        for key in ("finalAnswer", "answer", "content", "summary", "message"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        return current_answer

    def _collect_sources(
        self,
        data: Dict[str, Any],
        sources: List[Dict[str, Any]],
        seen_urls: set,
    ) -> None:
        candidates: List[Dict[str, Any]] = []

        if isinstance(data.get("sources"), list):
            candidates.extend([s for s in data["sources"] if isinstance(s, dict)])
        if isinstance(data.get("result"), dict):
            result_sources = data["result"].get("sources")
            if isinstance(result_sources, list):
                candidates.extend([s for s in result_sources if isinstance(s, dict)])

        def walk(value: Any) -> None:
            if isinstance(value, dict):
                url = value.get("url") or value.get("href") or value.get("link")
                if isinstance(url, str) and url.startswith("http"):
                    candidates.append(value)
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(data)

        for src in candidates:
            normalized = self._normalize_source(src)
            url = normalized.get("url", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            sources.append(normalized)

    def _normalize_source(self, source: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "url": source.get("url") or source.get("href") or source.get("link") or "",
            "title": source.get("title") or source.get("name") or "Web Source",
            "snippet": source.get("snippet") or source.get("summary") or source.get("description") or "",
            "publisher": source.get("publisher") or source.get("source") or "Web",
            "raw": source,
        }

    def _to_trend_items(
        self,
        query: str,
        final_answer: str,
        sources: List[Dict[str, Any]],
        limit: int,
    ) -> List[TrendItem]:
        if not final_answer and not sources:
            return []

        now = datetime.now(timezone.utc)
        items = [
            TrendItem(
                id=f"tabstack_{now.timestamp()}",
                platform=self.platform,
                title=f"Web Research for: {query}",
                content=final_answer or f"Collected {len(sources)} web sources for this query.",
                author="Tabstack AI",
                author_handle="tabstack",
                url=sources[0].get("url", "") if sources else "",
                timestamp=now,
                metrics={"depth": 10, "sources": len(sources)},
                raw_data={"sources": sources},
            )
        ]

        for src in sources[: max(limit - 1, 0)]:
            url = src.get("url", "")
            items.append(
                TrendItem(
                    id=url or f"tabstack_source_{len(items)}_{now.timestamp()}",
                    platform=self.platform,
                    title=src.get("title", "Web Source"),
                    content=src.get("snippet", ""),
                    author=src.get("publisher", "Web"),
                    author_handle="web",
                    url=url,
                    timestamp=now,
                    metrics={},
                    raw_data=src,
                )
            )

        return items
