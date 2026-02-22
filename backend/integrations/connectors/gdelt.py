import datetime
from typing import List, Optional
from urllib.parse import quote_plus

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from shared.models import PlatformType, TrendItem


class GDELTConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.GDELT.value

    async def search(self, query: str, limit: int = 10, use_oracle: bool = False) -> List[TrendItem]:
        if use_oracle:
            return await self._search_via_oracle(query, limit)
            
        if not await rate_limiter.wait_for_slot(self.platform):
            return []
        
        return await self._search_standard(query, limit)

    async def _search_standard(self, query: str, limit: int = 10) -> List[TrendItem]:
        import asyncio
        import datetime
        from urllib.parse import quote_plus
        
        max_records = max(1, min(limit, 50))
        url = (
            "https://api.gdeltproject.org/api/v2/doc/doc"
            f"?query={quote_plus(query)}&mode=ArtList&format=json"
            f"&maxrecords={max_records}&sort=DateDesc"
        )

        attempts = 3
        backoff = 2.0

        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.get(url)
                
                if response.status_code == 429:
                    print(f"GDELT rate limit (429) on attempt {attempt + 1}. Backing off {backoff}s...")
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                
                if response.status_code != 200:
                    raise Exception(f"GDELT error: {response.status_code} {response.text}")

                data = response.json()
                articles = data.get("articles", []) or []
                items: List[TrendItem] = []
                for art in articles[:limit]:
                    ts_raw = art.get("seendate", "")
                    timestamp = datetime.datetime.now(datetime.timezone.utc)
                    if ts_raw and len(ts_raw) == 14:
                        try:
                            timestamp = datetime.datetime.strptime(
                                ts_raw, "%Y%m%d%H%M%S"
                            ).replace(tzinfo=datetime.timezone.utc)
                        except Exception:
                            pass

                    url_value = art.get("url", "")
                    domain = art.get("domain", "GDELT")
                    items.append(
                        TrendItem(
                            id=url_value or f"gdelt_{timestamp.timestamp()}",
                            platform=self.platform,
                            title=art.get("title", "GDELT Article"),
                            content=art.get("snippet", "") or art.get("title", ""),
                            author=domain,
                            author_handle=domain,
                            url=url_value,
                            timestamp=timestamp,
                            metrics={},
                            raw_data=art,
                            is_verified=True,
                        )
                    )
                return items
            except Exception as e:
                print(f"GDELT search attempt {attempt + 1} failed: {e}")
                if attempt < attempts - 1:
                    await asyncio.sleep(backoff)
                    backoff *= 2
                else:
                    return []
        return []

    async def _search_via_oracle(self, query: str, limit: int = 10) -> List[TrendItem]:
        import os
        from backend.integrations.connectors.chainlink import ChainlinkConnector
        cl = ChainlinkConnector()
        # Use the specialized GDELT source script
        gdelt_source_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chainlink", "functions", "gdelt-source.js")
        
        source_code = cl.default_source
        if os.path.exists(gdelt_source_path):
            try:
                with open(gdelt_source_path, "r") as f:
                    source_code = f.read()
            except Exception as e:
                print(f"Warning: Could not read GDELT source script: {e}")
        
        # Chainlink Functions search
        cl_results = await cl.fetch_verifiable_data(query, source_code)
        
        # Wrap the result as a TrendItem
        import datetime
        timestamp = datetime.datetime.now(datetime.timezone.utc)
        tx_hash = cl_results.get("tx_hash")
        
        return [
            TrendItem(
                id=cl_results.get("request_id") or f"gdelt-oracle-{int(timestamp.timestamp())}",
                platform=self.platform,
                title=f"GDELT Oracle Search: {query}",
                content=f"Verifiable data request submitted via Chainlink Functions. Status: {cl_results.get('status')}",
                author="Chainlink DON",
                author_handle="oracle",
                url=f"https://functions.chain.link/{cl_results.get('network', 'base-sepolia')}" if not tx_hash else f"https://sepolia.arbiscan.io/tx/{tx_hash}",
                timestamp=timestamp,
                metrics={},
                raw_data=cl_results,
                is_verified=True,
            )
        ]

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None

