import os
import asyncio
import datetime
import sys
import types
from types import SimpleNamespace

os.environ.setdefault("COMPOSIO_CACHE_DIR", "/tmp/composio-cache")
os.makedirs("/tmp/composio-cache", exist_ok=True)

# Test environment may not have ACP SDK installed; provide a minimal stub.
if "virtuals_acp" not in sys.modules:
    virtuals_acp = types.ModuleType("virtuals_acp")
    virtuals_acp_client = types.ModuleType("virtuals_acp.client")

    class _VirtualsACPStub:
        def __init__(self, *args, **kwargs) -> None:
            pass

    virtuals_acp_client.VirtualsACP = _VirtualsACPStub
    virtuals_acp.client = virtuals_acp_client
    sys.modules["virtuals_acp"] = virtuals_acp
    sys.modules["virtuals_acp.client"] = virtuals_acp_client

from backend.agents.nodes import financial_intelligence as fi_node
from backend.integrations.connectors.synthdata import SynthDataConnector


def test_synthdata_asset_alias_detection_is_case_insensitive() -> None:
    connector = SynthDataConnector()
    detected = connector._detect_assets("Outlook for Bitcoin, ETH and nvda this quarter")
    symbols = {symbol for symbol, _ in detected}
    assert "BTC" in symbols
    assert "ETH" in symbols
    assert "NVDA" in symbols


def test_financial_intelligence_generated_at_is_iso_and_keeps_polymarket(monkeypatch) -> None:
    class _StubConnector:
        def __init__(self) -> None:
            self.api_key = "set"
            self.supported_crypto = {"BTC"}
            self.supported_equities = set()
            self.asset_aliases = {"bitcoin": "BTC"}

        def _detect_assets(self, _: str):
            return [("BTC", "crypto")]

        async def get_comprehensive_asset_insight(self, asset: str, **_: object):
            return SimpleNamespace(
                current_price=65000.0,
                price_forecast_7d={"p10": 62000.0, "p50": 67000.0, "p90": 70000.0},
                price_forecast_30d={"p10": 59000.0, "p50": 71000.0, "p90": 78000.0},
                risk_level="medium",
                realized_volatility=0.42,
                implied_volatility=0.48,
                liquidation_probability=0.11,
                option_prices=None,
                timestamp=datetime.datetime.now(datetime.timezone.utc),
            )

        async def get_polymarket_comparison(self, _: str):
            return {"event": "btc-etf", "edge": 0.07}

    async def _stub_synthesize(**_: object) -> str:
        return "Financial synthesis."

    monkeypatch.setattr(fi_node, "SynthDataConnector", _StubConnector)
    monkeypatch.setattr(fi_node, "_synthesize_financial_intelligence", _stub_synthesize)

    state = {
        "topic": "Bitcoin prediction market outlook",
        "logs": [],
        "raw_findings": [],
        "financial_intelligence": None,
    }
    result = asyncio.run(fi_node.financial_intelligence_node(state))
    fin = result["financial_intelligence"]

    assert fin is not None
    assert fin["polymarket_comparison"]["event"] == "btc-etf"
    datetime.datetime.fromisoformat(fin["generated_at"])


def test_synthdata_comprehensive_asset_insight_builds_forecasts(monkeypatch) -> None:
    connector = SynthDataConnector()

    async def _stub_predictions(asset: str, horizon: str):
        assert asset == "BTC"
        if horizon == "7d":
            return {
                "current_price": 65000.0,
                "percentiles": {"p10": 62000.0, "p25": 64000.0, "p50": 67000.0, "p75": 69000.0, "p90": 70500.0},
            }
        return {
            "current_price": 65000.0,
            "percentiles": {"p10": 59000.0, "p25": 63000.0, "p50": 71000.0, "p75": 75000.0, "p90": 79000.0},
        }

    async def _stub_vol(asset: str):
        assert asset == "BTC"
        return {"forecast_volatility": 0.5, "realized_volatility": 0.45}

    monkeypatch.setattr(connector, "get_prediction_percentiles", _stub_predictions)
    monkeypatch.setattr(connector, "get_volatility_metrics", _stub_vol)

    insight = asyncio.run(
        connector.get_comprehensive_asset_insight(
            asset="BTC",
            include_options=False,
            include_liquidation=False,
        )
    )
    assert insight is not None
    assert insight.price_forecast_7d["p50"] == 67000.0
    assert insight.price_forecast_30d["p50"] == 71000.0
    assert insight.risk_level == "medium"
