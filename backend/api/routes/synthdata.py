"""
SynthData routes for financial forecasting and market data.
"""

from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.api.models import SynthDataForecastRequest
from backend.integrations.connectors.synthdata import SynthDataConnector


router = APIRouter(prefix="/api/synthdata", tags=["synthdata"])


@router.get("/assets")
async def list_synthdata_assets() -> dict[str, Any]:
    """List all supported assets for SynthData forecasting."""
    connector = SynthDataConnector()
    return {
        "crypto": list(connector.supported_crypto),
        "equities": list(connector.supported_equities),
        "aliases": connector.asset_aliases,
    }


@router.post("/forecast")
async def get_synthdata_forecast(request: SynthDataForecastRequest) -> dict[str, Any]:
    """
    Get probabilistic price forecast for an asset.

    Returns comprehensive financial intelligence including:
    - Price forecasts (7d and 30d) with percentile ranges
    - Volatility metrics
    - Risk assessment
    - Optional: Option pricing, liquidation analysis
    """
    connector = SynthDataConnector()
    if not connector.api_key:
        return JSONResponse(
            status_code=503,
            content={"error": "SynthData API not configured"}
        )

    # Normalize asset symbol/alias first (case-insensitive), then uppercase symbol.
    asset_input = (request.asset or "").strip()
    alias_key = asset_input.lower()
    if alias_key in connector.asset_aliases:
        asset = connector.asset_aliases[alias_key]
    else:
        asset = asset_input.upper()

    if asset not in connector.supported_crypto and asset not in connector.supported_equities:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Asset '{request.asset}' not supported",
                "supported_assets": list(connector.supported_crypto | connector.supported_equities)
            }
        )

    insight = await connector.get_comprehensive_asset_insight(
        asset=asset,
        include_options=request.include_options,
        include_liquidation=request.include_liquidation,
        leverage=request.leverage
    )

    if not insight:
        return JSONResponse(
            status_code=404,
            content={"error": f"No forecast data available for {asset}"}
        )

    return {
        "asset": asset,
        "asset_type": insight.asset_type,
        "current_price": insight.current_price,
        "forecast_7d": insight.price_forecast_7d,
        "forecast_30d": insight.price_forecast_30d,
        "risk_level": insight.risk_level,
        "volatility": {
            "realized": insight.realized_volatility,
            "implied": insight.implied_volatility,
        },
        "liquidation_probability": insight.liquidation_probability,
        "option_prices": insight.option_prices,
        "timestamp": insight.timestamp.isoformat() if insight.timestamp else None,
        "data_source": "SynthData (Bittensor Subnet 50)",
    }


@router.get("/polymarket/events")
async def get_polymarket_events() -> dict[str, Any]:
    """Get available Polymarket events for comparison."""
    connector = SynthDataConnector()
    if not connector.api_key:
        return JSONResponse(
            status_code=503,
            content={"error": "SynthData API not configured"}
        )

    events = await connector.get_polymarket_events()
    return {"events": events or []}
