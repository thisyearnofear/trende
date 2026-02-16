import datetime
from typing import List, Optional
from urllib.parse import quote_plus

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from shared.config import get_settings
from shared.models import PlatformType, TrendItem


class CoinGeckoConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.COINGECKO.value

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.coingecko_api_key
        self.base_url = "https://api.coingecko.com/api/v3"

    def _headers(self) -> dict:
        headers = {}
        if self.api_key:
            # Works for demo/pro keys depending on account tier.
            headers["x-cg-demo-api-key"] = self.api_key
        return headers

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not await rate_limiter.wait_for_slot(self.platform):
            return []

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                search_resp = await client.get(
                    f"{self.base_url}/search?query={quote_plus(query)}",
                    headers=self._headers(),
                )
                if search_resp.status_code != 200:
                    raise Exception(
                        f"CoinGecko search error: {search_resp.status_code} {search_resp.text}"
                    )

                coins = (search_resp.json().get("coins") or [])[: max(1, min(limit, 20))]
                if not coins:
                    return []

                ids = ",".join(
                    [coin.get("id") for coin in coins if coin.get("id")]
                )
                markets_resp = await client.get(
                    (
                        f"{self.base_url}/coins/markets?vs_currency=usd"
                        f"&ids={quote_plus(ids)}&price_change_percentage=24h"
                    ),
                    headers=self._headers(),
                )
                markets_by_id = {}
                if markets_resp.status_code == 200:
                    markets = markets_resp.json() or []
                    markets_by_id = {m.get("id"): m for m in markets if m.get("id")}

            now = datetime.datetime.now(datetime.timezone.utc)
            items: List[TrendItem] = []
            for coin in coins[:limit]:
                coin_id = coin.get("id", "")
                market = markets_by_id.get(coin_id, {})
                symbol = (coin.get("symbol") or "").upper()
                name = coin.get("name", "Unknown Coin")
                rank = coin.get("market_cap_rank", "n/a")
                price = market.get("current_price")
                move_24h = market.get("price_change_percentage_24h")
                content_parts = [f"CoinGecko listing for {name} ({symbol})"]
                if price is not None:
                    content_parts.append(f"Price: ${price}")
                if move_24h is not None:
                    content_parts.append(f"24h: {move_24h:.2f}%")
                content_parts.append(f"Rank: {rank}")

                items.append(
                    TrendItem(
                        id=f"cg_{coin_id or symbol or name}",
                        platform=self.platform,
                        title=f"{name} ({symbol})",
                        content=" | ".join(content_parts),
                        author="CoinGecko",
                        author_handle="coingecko",
                        url=f"https://www.coingecko.com/en/coins/{coin_id}" if coin_id else "",
                        timestamp=now,
                        metrics={
                            "likes": int(market.get("market_cap_rank") or 0),
                            "views": int(market.get("total_volume") or 0),
                        },
                        raw_data={"coin": coin, "market": market},
                    )
                )
            return items
        except Exception as e:
            print(f"CoinGecko search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        return None

