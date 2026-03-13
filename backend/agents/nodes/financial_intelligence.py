"""
Financial Intelligence Node

Integrates SynthData probabilistic forecasts into the research workflow.
Provides quantitative risk metrics, price forecasts, and prediction market
comparisons to enrich trend analysis with financial intelligence.
"""

import asyncio
import datetime
from typing import Any, Dict, List, Optional

from backend.agents.state import GraphState
from backend.integrations.connectors.synthdata import SynthDataConnector
from backend.services.ai_service import ai_service
from shared.models import QueryStatus


def _append_synthdata_route_telemetry(
    state: GraphState,
    asset: str,
    endpoint_status: Dict[str, Dict[str, Any]],
) -> None:
    routes = list(state.get("source_routes") or [])
    for endpoint, status_payload in endpoint_status.items():
        ok = bool(status_payload.get("ok"))
        error = status_payload.get("error")
        route_status = "ok" if ok else ("error" if error else "empty")
        routes.append(
            {
                "requested_platform": "synthdata",
                "resolved_source": f"synthdata:{asset}:{endpoint}",
                "fallback_used": False,
                "item_count": 1 if ok else 0,
                "status": route_status,
                "error": str(error) if error else None,
            }
        )
    state["source_routes"] = routes


async def financial_intelligence_node(state: GraphState) -> GraphState:
    """
    Enrich research with probabilistic financial forecasts from SynthData.
    
    This node:
    1. Detects financial assets mentioned in the topic
    2. Fetches probabilistic price forecasts
    3. Calculates risk metrics
    4. Compares with prediction markets if relevant
    5. Adds structured financial intelligence to the state
    """
    state["logs"].append("📊 FINANCIAL INTELLIGENCE: Scanning for quantitative market signals...")
    
    synthdata = SynthDataConnector()
    if not synthdata.api_key:
        state["logs"].append("⚠️  SYNTHDATA: API key not configured, skipping financial intelligence.")
        state["financial_intelligence"] = None
        return state
    
    topic = state.get("topic", "")
    
    # Detect assets in topic
    detected_assets = synthdata._detect_assets(topic)
    
    # Also check raw findings for asset mentions
    findings = state.get("raw_findings", [])
    for finding in findings:
        if finding.platform == "coingecko":
            # Extract asset from CoinGecko findings
            content = f"{finding.title} {finding.content}".lower()
            for alias, symbol in synthdata.asset_aliases.items():
                if alias in content:
                    asset_type = "crypto" if symbol in synthdata.supported_crypto else "equity"
                    if (symbol, asset_type) not in detected_assets:
                        detected_assets.append((symbol, asset_type))
    
    if not detected_assets:
        state["logs"].append("📊 FINANCIAL INTELLIGENCE: No tradable assets detected in research topic.")
        state["financial_intelligence"] = None
        return state
    
    state["logs"].append(f"📊 FINANCIAL INTELLIGENCE: Detected assets: {[a[0] for a in detected_assets]}")
    
    # Determine what data to fetch based on topic context
    topic_lower = topic.lower()
    include_options = any(word in topic_lower for word in ["option", "call", "put", "strike", "derivative"])
    include_liquidation = any(word in topic_lower for word in ["liquidation", "leverage", "long", "short", "perp", "future", "margin"])
    include_polymarket = any(word in topic_lower for word in ["prediction", "bet", "odds", "outcome", "event", "election"])
    include_lp = any(word in topic_lower for word in ["yield", "lp", "liquidity", "pool", "uniswap"])
    
    # Fetch comprehensive insights for all detected assets
    asset_insights: List[Dict[str, Any]] = []
    polymarket_data: Optional[Dict[str, Any]] = None
    lp_data: List[Dict[str, Any]] = []
    
    # Fetch asset data in parallel
    asset_tasks = [
        synthdata.get_comprehensive_asset_insight(
            asset=asset,
            include_options=include_options,
            include_liquidation=include_liquidation,
            leverage=_extract_leverage(topic)
        )
        for asset, _ in detected_assets
    ]
    
    # Optionally fetch Polymarket comparison
    polymarket_task = None
    if include_polymarket:
        polymarket_task = synthdata.get_polymarket_comparison(topic)

    # Optionally fetch LP optimization (limited to common pools for detected assets)
    lp_tasks = []
    if include_lp:
        for asset, _ in detected_assets:
            if asset in ["BTC", "ETH", "SOL"]:
                lp_tasks.append(synthdata.get_lp_optimization(f"{asset}-USDC"))
    
    # Execute all tasks in one gather to avoid serial waits.
    try:
        gather_tasks = list(asset_tasks)
        if polymarket_task:
            gather_tasks.append(polymarket_task)
        if lp_tasks:
            gather_tasks.extend(lp_tasks)
            
        gathered = await asyncio.gather(*gather_tasks, return_exceptions=True)
        
        results = gathered[: len(asset_tasks)]
        
        idx = len(asset_tasks)
        if polymarket_task:
            maybe_polymarket = gathered[idx]
            if isinstance(maybe_polymarket, Exception):
                state["logs"].append(f"⚠️  SYNTHDATA: Failed to fetch Polymarket comparison: {maybe_polymarket}")
            else:
                polymarket_data = maybe_polymarket
            idx += 1
            
        if lp_tasks:
            lp_results = gathered[idx:]
            for res in lp_results:
                if res and not isinstance(res, Exception):
                    lp_data.append(res)
    except Exception as e:
        state["logs"].append(f"⚠️  SYNTHDATA: Error fetching financial data: {e}")
        state["financial_intelligence"] = None
        return state
    
    # Process results
    for i, result in enumerate(results):
        asset, asset_type = detected_assets[i]
        if isinstance(result, Exception):
            state["logs"].append(f"⚠️  SYNTHDATA: Failed to fetch data for {asset}: {result}")
            continue
        
        if result:
            raw_data = getattr(result, "raw_data", {}) or {}
            endpoint_status = raw_data.get("endpoint_status") if isinstance(raw_data, dict) else None
            if isinstance(endpoint_status, dict):
                _append_synthdata_route_telemetry(state, asset, endpoint_status)
            asset_insights.append({
                "symbol": asset,
                "type": asset_type,
                "current_price": result.current_price,
                "forecast_7d": result.price_forecast_7d,
                "forecast_30d": result.price_forecast_30d,
                "risk_level": result.risk_level,
                "volatility": {
                    "realized": result.realized_volatility,
                    "implied": result.implied_volatility,
                },
                "liquidation_probability": result.liquidation_probability,
                "option_prices": result.option_prices,
                "timestamp": result.timestamp.isoformat() if result.timestamp else None,
            })
    
    if not asset_insights:
        state["logs"].append("📊 FINANCIAL INTELLIGENCE: No quantitative data available for detected assets.")
        state["financial_intelligence"] = None
        return state
    
    # Generate AI synthesis of financial intelligence
    financial_summary = await _synthesize_financial_intelligence(
        topic=topic,
        asset_insights=asset_insights,
        polymarket_data=polymarket_data,
        lp_data=lp_data,
        social_findings=findings
    )
    
    # Calculate aggregate risk metrics
    aggregate_metrics = _calculate_aggregate_metrics(asset_insights)
    
    # Store in state
    state["financial_intelligence"] = {
        "assets": asset_insights,
        "summary": financial_summary,
        "aggregate_metrics": aggregate_metrics,
        "polymarket_comparison": polymarket_data,
        "lp_optimization": lp_data,
        "data_source": "SynthData (Bittensor Subnet 50)",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    
    state["logs"].append(
        f"📊 FINANCIAL INTELLIGENCE: Enriched with probabilistic forecasts for {len(asset_insights)} assets. "
        f"Aggregate risk: {aggregate_metrics.get('overall_risk', 'unknown')}."
    )
    
    return state


def _extract_leverage(topic: str) -> float:
    """Extract leverage from topic if mentioned."""
    import re
    match = re.search(r'(\d+)x\s+(?:leverage|long|short)', topic.lower())
    if match:
        return float(match.group(1))
    return 10.0  # Default


async def _synthesize_financial_intelligence(
    topic: str,
    asset_insights: List[Dict[str, Any]],
    polymarket_data: Optional[Dict[str, Any]],
    lp_data: List[Dict[str, Any]] = None,
    social_findings: List[Any] = None
) -> str:
    """
    Use AI to synthesize financial data into actionable intelligence.
    Includes divergence detection between social sentiment and ML forecasts.
    """
    # Build context for AI
    context_parts = []
    for insight in asset_insights:
        symbol = insight["symbol"]
        current = insight.get("current_price")
        forecast_7d = insight.get("forecast_7d", {})
        risk = insight.get("risk_level")
        
        part = f"""
Asset: {symbol}
Current Price: ${current:,.2f}""" if current else f"Asset: {symbol}"
        
        if forecast_7d.get("p50"):
            part += f"""
7-Day Forecast (Median): ${forecast_7d['p50']:,.2f}
Range (10th-90th percentile): ${forecast_7d.get('p10', 0):,.2f} - ${forecast_7d.get('p90', 0):,.2f}"""
        
        if risk:
            part += f"\nRisk Level: {risk.upper()}"
        
        vol = insight.get("volatility", {})
        if vol.get("realized"):
            part += f"\nRealized Volatility: {vol['realized']:.1%}"
        
        if insight.get("liquidation_probability"):
            part += f"\nLiquidation Probability (10x): {insight['liquidation_probability']:.1%}"
        
        context_parts.append(part)
    
    if polymarket_data:
        context_parts.append(f"""
Prediction Market Data (Polymarket vs SynthData):
{polymarket_data}
""")

    if lp_data:
        context_parts.append(f"""
DeFi LP Optimization (Uniswap V3):
{lp_data}
""")

    if social_findings:
        social_context = "\n".join([
            f"- {f.title}: {f.content[:200]}..." 
            for f in social_findings[:5]
        ])
        context_parts.append(f"""
Social Sentiment & News Findings:
{social_context}
""")
    
    joined_context = "\n---\n".join(context_parts)

    prompt = f"""
You are a high-stakes financial intelligence analyst. Synthesize the following quantitative
and qualitative data into a "Verifiable Alpha" summary for: "{topic}"

Financial & Social Data:
{joined_context}

Provide a brief, high-impact synthesis (3-5 sentences) that:
1. **Divergence Alert**: Specifically identify any "Risk Divergence" where social sentiment (bullish/bearish) conflicts with SynthData's probabilistic ML forecasts.
2. **Arbitrage Opportunity**: If Polymarket data is present, highlight any pricing discrepancies where SynthData forecasts suggest the market is mispriced.
3. **Actionable DeFi Alpha**: If LP data is present, provide the optimal range for capital efficiency.
4. **Summary**: State the "Ensemble Verdict" — the combined signal from all sources.

Keep it factual, professional, and highlight the technical edge provided by the Bittensor Subnet 50 ensemble.
"""
    
    try:
        summary = await ai_service.get_response(
            prompt,
            system_prompt="You are a quantitative financial analyst specializing in probabilistic forecasting and arbitrage detection.",
            provider="auto"
        )
        return summary.strip()
    except Exception as e:
        print(f"Financial synthesis failed: {e}")
        return "Financial data available but synthesis failed."


def _calculate_aggregate_metrics(asset_insights: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate aggregate risk and forecast metrics across all assets."""
    if not asset_insights:
        return {}
    
    # Risk level aggregation
    risk_levels = [a.get("risk_level") for a in asset_insights if a.get("risk_level")]
    risk_priority = ["extreme", "high", "medium", "low", "unknown"]
    overall_risk = "unknown"
    for level in risk_priority:
        if level in risk_levels:
            overall_risk = level
            break
    
    # Volatility aggregation
    volatilities = []
    for insight in asset_insights:
        vol = insight.get("volatility", {})
        if vol.get("realized"):
            volatilities.append(vol["realized"])
        elif vol.get("implied"):
            volatilities.append(vol["implied"])
    
    avg_volatility = sum(volatilities) / len(volatilities) if volatilities else None
    
    # Forecast direction (bullish/bearish/neutral)
    directions = []
    for insight in asset_insights:
        current = insight.get("current_price")
        forecast = insight.get("forecast_7d", {}).get("p50")
        if current and forecast:
            change = (forecast - current) / current
            if change > 0.05:
                directions.append("bullish")
            elif change < -0.05:
                directions.append("bearish")
            else:
                directions.append("neutral")
    
    # Count directions
    direction_counts = {}
    for d in directions:
        direction_counts[d] = direction_counts.get(d, 0) + 1
    
    overall_direction = "neutral"
    if direction_counts:
        overall_direction = max(direction_counts, key=direction_counts.get)
    
    return {
        "overall_risk": overall_risk,
        "average_volatility": avg_volatility,
        "forecast_direction": overall_direction,
        "direction_breakdown": direction_counts,
        "asset_count": len(asset_insights),
        "high_risk_assets": sum(1 for r in risk_levels if r in ["high", "extreme"]),
    }


async def enhance_consensus_with_financial_data(
    state: GraphState,
    consensus_bundle: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Enhance consensus bundle with financial intelligence.
    
    This is called by the analyzer_node to incorporate SynthData
    into the consensus report.
    """
    financial = state.get("financial_intelligence")
    if not financial:
        return consensus_bundle
    
    # Add financial context to consensus data
    consensus_bundle["financial_intelligence"] = {
        "assets": financial.get("assets", []),
        "aggregate_metrics": financial.get("aggregate_metrics", {}),
        "summary": financial.get("summary", ""),
        "lp_optimization": financial.get("lp_optimization", []),
    }
    
    # If consensus report exists, append financial appendix
    report = consensus_bundle.get("consensus_report", "")
    if report and financial.get("summary"):
        lp_summary = ""
        if financial.get("lp_optimization"):
            lp_summary = "\n### LP Optimization (Uniswap V3)\n"
            for lp in financial.get("lp_optimization", []):
                pool = lp.get("pool", "Unknown")
                lower = lp.get("lower_bound")
                upper = lp.get("upper_bound")
                prob = lp.get("probability_in_range")
                lp_summary += f"- **{pool}**: Range ${lower:,.2f} - ${upper:,.2f} (Prob: {prob:.1%})\n"

        financial_section = f"""

---

## Financial Intelligence Appendix
*Powered by SynthData (Bittensor Subnet 50)*

{financial["summary"]}
{lp_summary}
### Key Metrics
- **Overall Risk Level**: {financial.get("aggregate_metrics", {}).get("overall_risk", "unknown").upper()}
- **Forecast Direction**: {financial.get("aggregate_metrics", {}).get("forecast_direction", "neutral").upper()}
- **Assets Analyzed**: {len(financial.get("assets", []))}

*Note: Price forecasts represent probabilistic predictions (10th-90th percentile ranges) 
from an ensemble of 200+ ML models, not deterministic predictions.*
"""
        consensus_bundle["consensus_report"] = report + financial_section
    
    return consensus_bundle
