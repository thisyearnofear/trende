"""
SynthData API Connector - Enhanced Integration

Provides probabilistic price forecasts, volatility metrics, option pricing,
liquidation analysis, and prediction market comparisons powered by Bittensor Subnet 50.
"""

import asyncio
import datetime
import os
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import httpx

from backend.integrations.base import AbstractPlatformConnector
from backend.utils.rate_limit import rate_limiter
from backend.utils.request_cache import build_cache_key, request_cache
from shared.config import get_settings
from shared.models import PlatformType, TrendItem


class SynthDataAssetInsight(TrendItem):
    """Extended TrendItem with SynthData-specific financial insights."""
    
    # Price prediction data
    prediction_percentiles: Optional[Dict[str, Any]] = None
    price_forecast_7d: Optional[Dict[str, float]] = None  # p10, p25, p50, p75, p90
    price_forecast_30d: Optional[Dict[str, float]] = None
    
    # Volatility metrics
    volatility_forecast: Optional[Dict[str, Any]] = None
    realized_volatility: Optional[float] = None
    implied_volatility: Optional[float] = None
    
    # Option pricing
    option_prices: Optional[Dict[str, Any]] = None  # calls/puts by strike
    
    # Risk metrics
    liquidation_probability: Optional[float] = None
    risk_level: Optional[str] = None  # low, medium, high, extreme
    
    # LP optimization
    lp_optimal_range: Optional[Dict[str, Any]] = None
    impermanent_loss_estimate: Optional[float] = None
    
    # Prediction market comparison
    polymarket_comparison: Optional[Dict[str, Any]] = None
    
    # Asset metadata
    asset_symbol: Optional[str] = None
    asset_type: Optional[str] = None  # crypto, equity, commodity
    current_price: Optional[float] = None


class SynthDataConnector(AbstractPlatformConnector):
    """
    SynthData API connector providing probabilistic financial forecasts.
    
    Powered by Bittensor Subnet 50 - 200+ ML models competing to generate
    the most accurate ensemble predictions.
    """
    
    @property
    def platform(self) -> str:
        return PlatformType.SYNTHDATA.value

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.synthdata_api_key
        self.base_url = "https://api.synthdata.co"
        
        # Supported assets mapping
        self.supported_crypto = {"BTC", "ETH", "SOL"}
        self.supported_equities = {"SPY", "NVDA", "GOOGL", "TSLA", "AAPL"}
        self.asset_aliases = {
            "bitcoin": "BTC", "btc": "BTC",
            "ethereum": "ETH", "eth": "ETH",
            "solana": "SOL", "sol": "SOL",
            "s&p 500": "SPY", "sp500": "SPY", "spy": "SPY",
            "nvidia": "NVDA", "nvda": "NVDA",
            "google": "GOOGL", "googl": "GOOGL", "alphabet": "GOOGL",
            "tesla": "TSLA", "tsla": "TSLA",
            "apple": "AAPL", "aapl": "AAPL",
        }

    def _get_headers(self) -> Dict[str, str]:
        """Get API headers with authentication."""
        return {"Authorization": f"Apikey {self.api_key}"}

    def _detect_assets(self, query: str) -> List[Tuple[str, str]]:
        """
        Detect mentioned assets in query.
        
        Returns list of (asset_symbol, asset_type) tuples.
        """
        query_lower = query.lower()
        detected = []
        
        for alias, symbol in self.asset_aliases.items():
            if alias in query_lower:
                asset_type = "crypto" if symbol in self.supported_crypto else "equity"
                if (symbol, asset_type) not in detected:
                    detected.append((symbol, asset_type))
        
        return detected

    async def _make_request(
        self, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None,
        cache_key: Optional[str] = None,
        cache_ttl: int = 300,
        timeout_secs: float = 25.0,
        retries: int = 2,
        backoff_secs: float = 0.8,
    ) -> Optional[Dict[str, Any]]:
        """
        Make cached API request to SynthData.
        
        Args:
            endpoint: API endpoint path (e.g., "/insights/prediction-percentiles")
            params: Query parameters
            cache_key: Optional custom cache key
            cache_ttl: Cache TTL in seconds
            
        Returns:
            Parsed JSON response or None on error
        """
        if not self.api_key:
            return None
            
        # Build cache key
        if cache_key is None:
            cache_key = build_cache_key(f"synthdata.{endpoint}", **(params or {}))
        
        # Check cache
        cached = await request_cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Rate limiting
        if not await rate_limiter.wait_for_slot(self.platform):
            return None
        
        lock = await request_cache.get_lock(cache_key)
        async with lock:
            # Double-check cache after acquiring lock
            cached_after_lock = await request_cache.get(cache_key)
            if cached_after_lock is not None:
                return cached_after_lock
            
            try:
                attempts = max(1, retries)
                last_error: Optional[str] = None
                for attempt in range(1, attempts + 1):
                    try:
                        url = f"{self.base_url}{endpoint}"
                        async with httpx.AsyncClient(timeout=timeout_secs) as client:
                            response = await client.get(
                                url,
                                headers=self._get_headers(),
                                params=params
                            )

                        if response.status_code == 200:
                            data = response.json()
                            await request_cache.set(cache_key, data, cache_ttl)
                            return data

                        last_error = f"HTTP {response.status_code}: {response.text}"
                        # Retry only on transient API statuses.
                        retryable = response.status_code in {408, 409, 425, 429, 500, 502, 503, 504}
                        if (not retryable) or attempt >= attempts:
                            break
                    except Exception as e:
                        last_error = str(e)
                        if attempt >= attempts:
                            break

                    await asyncio.sleep(backoff_secs * attempt)

                if last_error:
                    print(f"SynthData request failed for {endpoint}: {last_error}")
                return None
            finally:
                await request_cache.clear_inflight(cache_key)

    async def get_prediction_percentiles(
        self, 
        asset: str, 
        horizon: str = "7d"
    ) -> Optional[Dict[str, Any]]:
        """
        Get probabilistic price forecasts with full distribution.
        
        Args:
            asset: Asset symbol (BTC, ETH, SOL, etc.)
            horizon: Forecast horizon ("7d", "30d")
            
        Returns:
            Prediction percentiles including p10, p25, p50, p75, p90
        """
        data = await self._make_request(
            "/insights/prediction-percentiles",
            params={"asset": asset, "horizon": horizon},
            cache_ttl=600,  # 10 min cache for predictions
            timeout_secs=float(os.getenv("SYNTHDATA_PREDICTION_TIMEOUT_SECS", "25")),
            retries=max(1, int(os.getenv("SYNTHDATA_PREDICTION_RETRIES", "2"))),
            backoff_secs=float(os.getenv("SYNTHDATA_RETRY_BACKOFF_SECS", "0.8")),
        )
        return data

    async def get_volatility_metrics(self, asset: str) -> Optional[Dict[str, Any]]:
        """
        Get forward-looking and realized volatility metrics.
        
        Args:
            asset: Asset symbol
            
        Returns:
            Volatility metrics including forecast and historical context
        """
        return await self._make_request(
            "/insights/volatility",
            params={"asset": asset},
            cache_ttl=600,
            timeout_secs=float(os.getenv("SYNTHDATA_VOLATILITY_TIMEOUT_SECS", "25")),
            retries=max(1, int(os.getenv("SYNTHDATA_VOLATILITY_RETRIES", "2"))),
            backoff_secs=float(os.getenv("SYNTHDATA_RETRY_BACKOFF_SECS", "0.8")),
        )

    async def get_option_pricing(
        self, 
        asset: str, 
        strikes: Optional[List[float]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get theoretical option prices derived from ensemble forecasts.
        
        Args:
            asset: Asset symbol
            strikes: Optional list of strike prices (defaults to around current price)
            
        Returns:
            Call and put prices for specified strikes
        """
        params = {"asset": asset}
        if strikes:
            params["strikes"] = ",".join(map(str, strikes))
            
        return await self._make_request(
            "/insights/option-pricing",
            params=params,
            cache_ttl=300,
            timeout_secs=float(os.getenv("SYNTHDATA_OPTIONS_TIMEOUT_SECS", "30")),
            retries=max(1, int(os.getenv("SYNTHDATA_OPTIONS_RETRIES", "2"))),
            backoff_secs=float(os.getenv("SYNTHDATA_RETRY_BACKOFF_SECS", "0.8")),
        )

    async def get_liquidation_analysis(
        self, 
        asset: str,
        leverage: float = 10.0,
        position_type: str = "long"
    ) -> Optional[Dict[str, Any]]:
        """
        Get liquidation probability analysis for leveraged positions.
        
        Args:
            asset: Asset symbol
            leverage: Leverage multiplier (e.g., 10 for 10x)
            position_type: "long" or "short"
            
        Returns:
            Liquidation probability and dynamic stop-loss levels
        """
        return await self._make_request(
            "/insights/liquidation",
            params={
                "asset": asset,
                "leverage": leverage,
                "position_type": position_type
            },
            cache_ttl=300,
            timeout_secs=float(os.getenv("SYNTHDATA_LIQUIDATION_TIMEOUT_SECS", "30")),
            retries=max(1, int(os.getenv("SYNTHDATA_LIQUIDATION_RETRIES", "2"))),
            backoff_secs=float(os.getenv("SYNTHDATA_RETRY_BACKOFF_SECS", "0.8")),
        )

    async def get_lp_optimization(
        self, 
        pool: str,
        range_width: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get optimal liquidity provider ranges for Uniswap V3.
        
        Args:
            pool: Pool identifier (e.g., "ETH-USDC")
            range_width: Desired range width percentage
            
        Returns:
            Optimal LP bounds, IL estimates, probability of staying in range
        """
        params = {"pool": pool}
        if range_width:
            params["range_width"] = range_width
            
        return await self._make_request(
            "/insights/lp-bounds",
            params=params,
            cache_ttl=600,
            timeout_secs=float(os.getenv("SYNTHDATA_LP_TIMEOUT_SECS", "30")),
            retries=max(1, int(os.getenv("SYNTHDATA_LP_RETRIES", "2"))),
            backoff_secs=float(os.getenv("SYNTHDATA_RETRY_BACKOFF_SECS", "0.8")),
        )

    async def get_polymarket_comparison(self, event: str) -> Optional[Dict[str, Any]]:
        """
        Get comparison between SynthData forecasts and Polymarket odds.
        
        Args:
            event: Event identifier or description
            
        Returns:
            Cross-market arbitrage opportunities and comparison data
        """
        return await self._make_request(
            "/insights/polymarket/comparison",
            params={"event": event},
            cache_ttl=300,
            timeout_secs=float(os.getenv("SYNTHDATA_POLYMARKET_TIMEOUT_SECS", "20")),
            retries=max(1, int(os.getenv("SYNTHDATA_POLYMARKET_RETRIES", "2"))),
            backoff_secs=float(os.getenv("SYNTHDATA_RETRY_BACKOFF_SECS", "0.8")),
        )

    async def get_polymarket_events(self) -> Optional[List[Dict[str, Any]]]:
        """Get available Polymarket events for comparison."""
        data = await self._make_request(
            "/insights/polymarket/events",
            cache_ttl=300,
            timeout_secs=float(os.getenv("SYNTHDATA_POLYMARKET_TIMEOUT_SECS", "20")),
            retries=max(1, int(os.getenv("SYNTHDATA_POLYMARKET_RETRIES", "2"))),
            backoff_secs=float(os.getenv("SYNTHDATA_RETRY_BACKOFF_SECS", "0.8")),
        )
        return data.get("events") if data else None

    async def get_comprehensive_asset_insight(
        self, 
        asset: str,
        include_options: bool = False,
        include_liquidation: bool = False,
        leverage: float = 10.0
    ) -> Optional[SynthDataAssetInsight]:
        """
        Get comprehensive insight for an asset combining multiple endpoints.
        
        This is the primary method for rich financial intelligence.
        
        Args:
            asset: Asset symbol
            include_options: Whether to fetch option pricing
            include_liquidation: Whether to fetch liquidation analysis
            leverage: Leverage for liquidation analysis
            
        Returns:
            SynthDataAssetInsight with all available data
        """
        # Fetch core data in parallel
        predictions_7d, predictions_30d, volatility = await asyncio.gather(
            self.get_prediction_percentiles(asset, "7d"),
            self.get_prediction_percentiles(asset, "30d"),
            self.get_volatility_metrics(asset),
            return_exceptions=True
        )
        
        # Fetch optional data
        options_data = None
        liquidation_data = None
        endpoint_status: Dict[str, Dict[str, Any]] = {
            "prediction_7d": {"ok": False, "error": None},
            "prediction_30d": {"ok": False, "error": None},
            "volatility": {"ok": False, "error": None},
        }
        
        if include_options:
            try:
                options_data = await self.get_option_pricing(asset)
                endpoint_status["options"] = {"ok": options_data is not None, "error": None if options_data is not None else "empty response"}
            except Exception:
                endpoint_status["options"] = {"ok": False, "error": "request failed"}
                
        if include_liquidation:
            try:
                liquidation_data = await self.get_liquidation_analysis(asset, leverage)
                endpoint_status["liquidation"] = {"ok": liquidation_data is not None, "error": None if liquidation_data is not None else "empty response"}
            except Exception:
                endpoint_status["liquidation"] = {"ok": False, "error": "request failed"}
        
        # Extract current price and forecast percentiles
        current_price = None
        forecast_7d = None
        forecast_30d = None
        
        if predictions_7d and not isinstance(predictions_7d, Exception):
            current_price = predictions_7d.get("current_price")
            percentiles = predictions_7d.get("percentiles", {})
            forecast_7d = {
                "p10": percentiles.get("p10"),
                "p25": percentiles.get("p25"),
                "p50": percentiles.get("p50"),
                "p75": percentiles.get("p75"),
                "p90": percentiles.get("p90"),
            }
            endpoint_status["prediction_7d"] = {"ok": True, "error": None}
        elif isinstance(predictions_7d, Exception):
            endpoint_status["prediction_7d"] = {"ok": False, "error": str(predictions_7d)}
        else:
            endpoint_status["prediction_7d"] = {"ok": False, "error": "empty response"}
        
        if predictions_30d and not isinstance(predictions_30d, Exception):
            percentiles = predictions_30d.get("percentiles", {})
            forecast_30d = {
                "p10": percentiles.get("p10"),
                "p25": percentiles.get("p25"),
                "p50": percentiles.get("p50"),
                "p75": percentiles.get("p75"),
                "p90": percentiles.get("p90"),
            }
            endpoint_status["prediction_30d"] = {"ok": True, "error": None}
        elif isinstance(predictions_30d, Exception):
            endpoint_status["prediction_30d"] = {"ok": False, "error": str(predictions_30d)}
        else:
            endpoint_status["prediction_30d"] = {"ok": False, "error": "empty response"}
        
        # Build insight object
        asset_type = "crypto" if asset in self.supported_crypto else "equity"
        
        # Determine risk level based on volatility
        risk_level = "unknown"
        vol_value = None
        if volatility and not isinstance(volatility, Exception):
            vol_value = volatility.get("forecast_volatility") or volatility.get("realized_volatility")
            if vol_value:
                if vol_value < 0.3:
                    risk_level = "low"
                elif vol_value < 0.6:
                    risk_level = "medium"
                elif vol_value < 1.0:
                    risk_level = "high"
                else:
                    risk_level = "extreme"
            endpoint_status["volatility"] = {"ok": True, "error": None}
        elif isinstance(volatility, Exception):
            endpoint_status["volatility"] = {"ok": False, "error": str(volatility)}
        else:
            endpoint_status["volatility"] = {"ok": False, "error": "empty response"}
        
        # Build content summary
        content_parts = [f"Probabilistic forecast for {asset} powered by Bittensor Subnet 50."]
        
        if forecast_7d and forecast_7d.get("p50"):
            content_parts.append(
                f"7-day median forecast: ${forecast_7d['p50']:,.2f} "
                f"(range: ${forecast_7d.get('p10', 0):,.2f} - ${forecast_7d.get('p90', 0):,.2f})"
            )
        
        if vol_value:
            content_parts.append(f"Volatility forecast: {vol_value:.1%}")
            
        if liquidation_data and not isinstance(liquidation_data, Exception):
            liq_prob = liquidation_data.get("liquidation_probability")
            if liq_prob:
                content_parts.append(f"Liquidation probability ({leverage}x): {liq_prob:.1%}")
        
        content = "\n".join(content_parts)
        
        insight = SynthDataAssetInsight(
            id=f"synthdata_{asset}_{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')}",
            platform=self.platform,
            title=f"{asset} Probabilistic Forecast",
            content=content,
            author="SynthData",
            author_handle="synthdata",
            url=f"https://docs.synthdata.co/?asset={asset}",
            timestamp=datetime.datetime.now(datetime.timezone.utc),
            asset_symbol=asset,
            asset_type=asset_type,
            current_price=current_price,
            price_forecast_7d=forecast_7d,
            price_forecast_30d=forecast_30d,
            volatility_forecast=volatility if not isinstance(volatility, Exception) else None,
            realized_volatility=volatility.get("realized_volatility") if volatility and not isinstance(volatility, Exception) else None,
            implied_volatility=volatility.get("implied_volatility") if volatility and not isinstance(volatility, Exception) else None,
            option_prices=options_data if not isinstance(options_data, Exception) else None,
            liquidation_probability=liquidation_data.get("liquidation_probability") if liquidation_data and not isinstance(liquidation_data, Exception) else None,
            risk_level=risk_level,
            raw_data={
                "predictions_7d": predictions_7d if not isinstance(predictions_7d, Exception) else None,
                "predictions_30d": predictions_30d if not isinstance(predictions_30d, Exception) else None,
                "volatility": volatility if not isinstance(volatility, Exception) else None,
                "options": options_data if not isinstance(options_data, Exception) else None,
                "liquidation": liquidation_data if not isinstance(liquidation_data, Exception) else None,
                "endpoint_status": endpoint_status,
            }
        )
        
        return insight

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """
        Search for financial insights based on query.
        
        Automatically detects assets in the query and returns comprehensive
        probabilistic forecasts for each detected asset.
        
        Args:
            query: Search query (may contain asset names/symbols)
            limit: Maximum number of results
            
        Returns:
            List of TrendItem objects with financial insights
        """
        if not self.api_key:
            return []
        
        # Detect assets in query
        detected_assets = self._detect_assets(query)
        
        # If no specific assets detected, try generic search
        if not detected_assets:
            return await self._generic_search(query, limit)
        
        # Determine what additional data to fetch based on query context
        query_lower = query.lower()
        include_options = any(word in query_lower for word in ["option", "call", "put", "strike"])
        include_liquidation = any(word in query_lower for word in ["liquidation", "leverage", "long", "short", "perp", "future"])
        
        # Extract leverage if mentioned
        leverage = 10.0
        import re
        leverage_match = re.search(r'(\d+)x\s+(?:leverage|long|short)', query_lower)
        if leverage_match:
            leverage = float(leverage_match.group(1))
        
        # Fetch comprehensive insights for detected assets
        items: List[TrendItem] = []
        for asset, asset_type in detected_assets[:limit]:
            try:
                insight = await self.get_comprehensive_asset_insight(
                    asset=asset,
                    include_options=include_options,
                    include_liquidation=include_liquidation,
                    leverage=leverage
                )
                if insight:
                    items.append(insight)
            except Exception as e:
                print(f"Failed to fetch SynthData insight for {asset}: {e}")
                continue
        
        return items

    async def _generic_search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """
        Fallback generic search when no specific assets detected.
        
        Tries to find relevant market insights via search endpoint.
        """
        cache_key = build_cache_key("synthdata.search", query=query, limit=limit)
        cached = await request_cache.get(cache_key)
        if cached is not None:
            return cached

        lock = await request_cache.get_lock(cache_key)
        async with lock:
            cached_after_lock = await request_cache.get(cache_key)
            if cached_after_lock is not None:
                return cached_after_lock

            if not await rate_limiter.wait_for_slot(self.platform):
                return []

            headers = {"Authorization": f"Apikey {self.api_key}"}
            endpoint_candidates = [
                f"{self.base_url}/insights?query={quote_plus(query)}&limit={max(1, min(limit, 10))}",
                f"{self.base_url}/insights/search?query={quote_plus(query)}&limit={max(1, min(limit, 10))}",
            ]

            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    payload: dict[str, Any] | None = None
                    for endpoint in endpoint_candidates:
                        response = await client.get(endpoint, headers=headers)
                        if response.status_code == 200:
                            try:
                                parsed = response.json()
                            except ValueError:
                                body_preview = (response.text or "")[:120].replace("\n", " ")
                                print(
                                    f"SynthData non-JSON response at {endpoint}: "
                                    f"{response.headers.get('content-type', 'unknown')} {body_preview}"
                                )
                                continue
                            if isinstance(parsed, dict):
                                payload = parsed
                                break
                if not payload:
                    return []

                raw_items = (
                    payload.get("data")
                    or payload.get("results")
                    or payload.get("insights")
                    or []
                )
                items: List[TrendItem] = []
                for idx, row in enumerate(raw_items[:limit]):
                    if not isinstance(row, dict):
                        continue
                    url = str(row.get("url") or row.get("source_url") or row.get("link") or "").strip()
                    title = str(row.get("title") or row.get("headline") or "Market Insight").strip()
                    content = str(
                        row.get("summary")
                        or row.get("description")
                        or row.get("insight")
                        or row.get("content")
                        or ""
                    ).strip()
                    if not url:
                        url = f"https://docs.synthdata.co/?q={quote_plus(query)}"
                    items.append(
                        TrendItem(
                            id=str(row.get("id") or row.get("symbol") or f"synthdata_{idx}"),
                            platform=self.platform,
                            title=title or "Market Insight",
                            content=content or title or query,
                            author=str(row.get("source") or "SynthData"),
                            author_handle="synthdata",
                            url=url,
                            timestamp=datetime.datetime.now(datetime.timezone.utc),
                            metrics={},
                            raw_data=row,
                        )
                    )
                if items:
                    await request_cache.set(cache_key, items, self.settings.cache_ttl_seconds)
                return items
            except Exception as e:
                print(f"SynthData search failed: {e}")
                return []
            finally:
                await request_cache.clear_inflight(cache_key)

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        """Fetch secondary details for a specific item."""
        # SynthData doesn't support individual item fetching
        return None

    # Convenience methods for direct API access
    
    async def get_asset_forecast_summary(self, asset: str) -> Dict[str, Any]:
        """
        Get a human-readable forecast summary for an asset.
        
        Returns structured data suitable for display or LLM consumption.
        """
        insight = await self.get_comprehensive_asset_insight(asset)
        
        if not insight:
            return {
                "asset": asset,
                "error": "No data available",
                "available": False
            }
        
        # Calculate upside/downside from current price
        current = insight.current_price or 0
        forecast_7d = insight.price_forecast_7d or {}
        
        upside_7d = None
        downside_7d = None
        if current and forecast_7d.get("p50"):
            upside_7d = (forecast_7d["p90"] - current) / current if forecast_7d.get("p90") else None
            downside_7d = (forecast_7d["p10"] - current) / current if forecast_7d.get("p10") else None
        
        return {
            "asset": asset,
            "asset_type": insight.asset_type,
            "available": True,
            "current_price": insight.current_price,
            "risk_level": insight.risk_level,
            "forecast_7d": {
                "median": forecast_7d.get("p50"),
                "range_low": forecast_7d.get("p10"),
                "range_high": forecast_7d.get("p90"),
                "upside_potential": upside_7d,
                "downside_risk": downside_7d,
            },
            "forecast_30d": {
                "median": insight.price_forecast_30d.get("p50") if insight.price_forecast_30d else None,
                "range_low": insight.price_forecast_30d.get("p10") if insight.price_forecast_30d else None,
                "range_high": insight.price_forecast_30d.get("p90") if insight.price_forecast_30d else None,
            },
            "volatility": {
                "realized": insight.realized_volatility,
                "implied": insight.implied_volatility,
            },
            "liquidation_probability": insight.liquidation_probability,
            "data_source": "SynthData (Bittensor Subnet 50)",
            "timestamp": insight.timestamp.isoformat(),
        }
