import json
from typing import Any

from backend.agents.state import GraphState
from backend.services.ai_service import ai_service


def _extract_json_object(raw: str) -> dict[str, Any]:
    """Best-effort JSON object extraction from LLM text."""
    if not raw:
        raise ValueError("Empty architect response")

    candidate = raw.strip()

    # Strip fenced code blocks if present.
    if "```" in candidate:
        blocks = candidate.split("```")
        for block in blocks:
            cleaned = block.strip()
            if not cleaned:
                continue
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            if cleaned.startswith("{") and cleaned.endswith("}"):
                return json.loads(cleaned)

    # Fallback: scan for first valid {...} object boundaries.
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object boundaries found")

    snippet = candidate[start : end + 1]
    return json.loads(snippet)


def _build_financial_metrics(state: GraphState) -> dict[str, Any]:
    """Build financial metrics section from SynthData intelligence."""
    financial = state.get("financial_intelligence")
    if not financial:
        return {}

    metrics = financial.get("aggregate_metrics", {})
    assets = financial.get("assets", [])

    # Build asset forecasts
    asset_forecasts = []
    for asset in assets:
        forecast = {
            "symbol": asset.get("symbol"),
            "current_price": asset.get("current_price"),
            "risk_level": asset.get("risk_level"),
        }

        # Add 7-day forecast if available
        forecast_7d = asset.get("forecast_7d", {})
        if forecast_7d.get("p50"):
            current = asset.get("current_price", 0)
            median = forecast_7d.get("p50", 0)
            if current and median:
                forecast["forecast_7d"] = {
                    "median": median,
                    "change_pct": round((median - current) / current * 100, 2),
                    "range_low": forecast_7d.get("p10"),
                    "range_high": forecast_7d.get("p90"),
                }

        # Add liquidation risk if available
        if asset.get("liquidation_probability"):
            forecast["liquidation_risk_10x"] = asset.get("liquidation_probability")

        asset_forecasts.append(forecast)

    return {
        "overall_risk": metrics.get("overall_risk"),
        "forecast_direction": metrics.get("forecast_direction"),
        "average_volatility": metrics.get("average_volatility"),
        "asset_count": metrics.get("asset_count", 0),
        "high_risk_count": metrics.get("high_risk_assets", 0),
        "asset_forecasts": asset_forecasts,
        "data_source": "SynthData (Bittensor Subnet 50)",
    }


def _fallback_payload(state: GraphState, agreement: float) -> dict[str, Any]:
    consensus = state.get("consensus_data") or {}
    topic = str(state.get("topic") or "Research Report")
    summary = str(state.get("summary") or "No summary available.")

    # Include financial metrics if available
    financial_metrics = _build_financial_metrics(state)

    result: dict[str, Any] = {
        "type": "REPORT",
        "title": topic[:80],
        "intelligence_summary": summary,
        "thesis": [
            "Consensus report generated with multi-provider analysis.",
            "Use confidence and divergence signals before taking action.",
        ],
        "consensus_metrics": {
            "model_agreement": consensus.get("agreement_score", agreement),
            "confidence_score": state.get("confidence_score", 0.0),
            "consensus_depth": consensus.get("consensus_depth", "moderate"),
            "main_divergence": consensus.get("main_divergence", ""),
            "provider_count": len(consensus.get("providers", [])),
        },
        "pillars": consensus.get("pillars", []),
        "anomalies": consensus.get("anomalies", []),
        "citations": [],
    }

    # Add financial metrics if available
    if financial_metrics:
        result["financial_metrics"] = financial_metrics

    return result


async def architect_node(state: GraphState) -> GraphState:
    """
    The Architect node synthesizes research into a structured payload
    with thesis, citations, consensus metrics, and optional financial data.
    """
    state["logs"].append("Architecting final payload...")

    if not state.get("final_report_md"):
        state["logs"].append("Skipping Architect: No research report found.")
        return state

    consensus = state.get("consensus_data", {})
    pillars = consensus.get("pillars", [])
    anomalies = consensus.get("anomalies", [])
    agreement = consensus.get("agreement_score", 0.5)
    confidence = consensus.get("confidence_score", 0.7)
    consensus_depth = consensus.get("consensus_depth", "moderate")

    # Build financial context for prompt
    financial = state.get("financial_intelligence")
    financial_context = ""
    if financial and financial.get("assets"):
        assets_summary = []
        for asset in financial["assets"]:
            symbol = asset.get("symbol")
            current = asset.get("current_price")
            forecast = asset.get("forecast_7d", {})
            risk = asset.get("risk_level")

            summary = f"- {symbol}:"
            if current:
                summary += f" Current ${current:,.2f}"
            if forecast.get("p50"):
                summary += f", 7d forecast ${forecast['p50']:,.2f}"
            if risk:
                summary += f", Risk: {risk.upper()}"
            assets_summary.append(summary)

        financial_context = f"""
Financial Intelligence (SynthData):
{chr(10).join(assets_summary)}
Overall Risk: {financial.get("aggregate_metrics", {}).get("overall_risk", "unknown").upper()}
Forecast Direction: {financial.get("aggregate_metrics", {}).get("forecast_direction", "neutral").upper()}
"""

    prompt = f"""
    You are an expert research analyst synthesizing findings into a structured intelligence payload.
    Based on the following research and consensus data, create a high-conviction structured summary.

    Research Report:
    {state["final_report_md"]}

    Consensus Data:
    - Pillars (Verified Facts): {pillars}
    - Anomalies (Fringe/Emerging): {anomalies}
    - Agreement Score: {agreement}
    - Confidence Score: {confidence}
    - Consensus Depth: {consensus_depth}
    - Main Divergence: {consensus.get("main_divergence", "None detected")}
    {financial_context}

    TASK:
    Generate a JSON payload summarizing this research for downstream consumers.

    IMPORTANT: If financial intelligence is provided above, incorporate the risk levels and
    forecast direction into your conviction points and thesis. The financial metrics should
    inform the "financial_metrics" field in the output.

    Output strictly as JSON:
    {{
        "type": "REPORT",
        "title": "Concise research title",
        "intelligence_summary": "Neutral, multi-model consensus brief focused on the {len(pillars)} verified pillars with {consensus_depth} depth analysis.",
        "thesis": [
            "Key finding 1...",
            "Key finding 2..."
        ],
        "consensus_metrics": {{
            "model_agreement": {agreement},
            "confidence_score": {confidence},
            "consensus_depth": "{consensus_depth}",
            "main_divergence": "{consensus.get("main_divergence", "")}",
            "provider_count": {len(consensus.get("providers", []))}
        }},
        "pillars": {pillars},
        "anomalies": {anomalies},
        "citations": [
            {{"source": "Source Name", "url": "url", "quote": "key snippet"}}
        ],
        "financial_metrics": {{
            "overall_risk": "low|medium|high|extreme",
            "forecast_direction": "bullish|bearish|neutral",
            "asset_forecasts": []
        }}
    }}
    """

    try:
        response = await ai_service.get_response(
            prompt,
            system_prompt="You are a master of synthesis and structured intelligence."
        )

        payload = _extract_json_object(response)
        if not isinstance(payload, dict):
            raise ValueError("Architect payload is not a JSON object")

        # Add metadata and carry over consensus fields if missing.
        payload["generated_at"] = state["created_at"]
        payload["confidence_score"] = state["confidence_score"]

        if "type" not in payload:
            payload["type"] = "REPORT"
        # Ensure title is set
        payload.setdefault("title", str(state.get("topic") or "Research Report")[:80])

        if "intelligence_summary" not in payload:
            payload["intelligence_summary"] = str(state.get("summary") or "No summary available.")
        if "thesis" not in payload or not isinstance(payload.get("thesis"), list):
            payload["thesis"] = _fallback_payload(state, agreement)["thesis"]
        if "consensus_metrics" not in payload or not isinstance(payload.get("consensus_metrics"), dict):
            payload["consensus_metrics"] = _fallback_payload(state, agreement)["consensus_metrics"]

        if "pillars" not in payload:
            payload["pillars"] = pillars
        if "anomalies" not in payload:
            payload["anomalies"] = anomalies

        state["research_payload"] = payload
        state["logs"].append(
            f"Payload Architected: {payload.get('title', 'Research Report')}"
        )

    except Exception as e:
        state["logs"].append(f"Architect node failed: {e}")
        state["research_payload"] = _fallback_payload(state, agreement)
        state["logs"].append("Architect fallback payload generated.")

    return state
