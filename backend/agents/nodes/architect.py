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


def _fallback_meme_data(state: GraphState, agreement: float) -> dict[str, Any]:
    consensus = state.get("consensus_data") or {}
    topic = str(state.get("topic") or "Trend Insight")
    summary = str(state.get("summary") or "No summary available.")
    suggested_mode = "NEWS" if agreement > 0.4 else "MEME"
    ticker = "".join(ch for ch in topic.upper() if ch.isalnum())[:6] or "ALPHA"

    return {
        "type": suggested_mode,
        "token": {
            "name": topic[:60],
            "ticker": ticker,
            "description": summary[:220],
        },
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
        "brand": {
            "aesthetic": "Institutional",
            "primary_color": "#06b6d4",
        },
    }

async def architect_node(state: GraphState) -> GraphState:
    """
    The Architect node takes the final research and synthesizes it into a 
    'Meme Page Payload'—a structured format for launching a token or providing a news brief.
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

    # Determine mode: Default to NEWS if technical/heavy agreement, MEME if social/viral
    suggested_mode = "NEWS" if agreement > 0.4 else "MEME"

    prompt = f"""
    You are a Strategic Architect for the Monad economy.
    Based on the following research and enhanced consensus data, create a high-conviction structured payload.

    Research Report:
    {state["final_report_md"]}

    Enhanced Consensus Data:
    - Pillars (Verified Facts): {pillars}
    - Anomalies (Fringe/Alpha): {anomalies}
    - Agreement Score: {agreement}
    - Confidence Score: {confidence}
    - Consensus Depth: {consensus_depth}
    - Main Divergence: {consensus.get("main_divergence", "None detected")}

    TASK:
    Generate a JSON payload for the Forge UI.
    If the topic is viral/community-centric, use MODE: "MEME".
    If the topic is technical/news-centric, use MODE: "NEWS".

    Output strictly as JSON:
    {{
        "type": "MEME" or "NEWS",
        "token": {{
            "name": "Human-friendly Trend Name",
            "ticker": "TICKER",
            "description": "2-sentence punchy summary"
        }},
        "intelligence_summary": "Neutral, multi-model consensus brief focused on the {len(pillars)} verified pillars with {consensus_depth} depth analysis.",
        "thesis": [
            "Conviction point 1...",
            "Conviction point 2..."
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
        "brand": {{
            "aesthetic": "e.g., Cyberpunk, Institutional, Minimalist",
            "primary_color": "vibrant hex color"
        }}
    }}
    """
    
    try:
        response = await ai_service.get_response(
            prompt,
            system_prompt="You are a master of synthesis and structured intelligence."
        )

        meme_data = _extract_json_object(response)
        if not isinstance(meme_data, dict):
            raise ValueError("Architect payload is not a JSON object")

        # Add metadata and carry over consensus fields if missing.
        meme_data["generated_at"] = state["created_at"]
        meme_data["confidence_score"] = state["confidence_score"]

        if "type" not in meme_data:
            meme_data["type"] = suggested_mode
        if not isinstance(meme_data.get("token"), dict):
            meme_data["token"] = _fallback_meme_data(state, agreement)["token"]
        else:
            meme_data["token"].setdefault("name", str(state.get("topic") or "Trend Insight"))
            meme_data["token"].setdefault("ticker", "ALPHA")
            meme_data["token"].setdefault(
                "description",
                str(state.get("summary") or "No summary available."),
            )
        if "intelligence_summary" not in meme_data:
            meme_data["intelligence_summary"] = str(state.get("summary") or "No summary available.")
        if "thesis" not in meme_data or not isinstance(meme_data.get("thesis"), list):
            meme_data["thesis"] = _fallback_meme_data(state, agreement)["thesis"]
        if "consensus_metrics" not in meme_data or not isinstance(meme_data.get("consensus_metrics"), dict):
            meme_data["consensus_metrics"] = _fallback_meme_data(state, agreement)["consensus_metrics"]
        if "brand" not in meme_data or not isinstance(meme_data.get("brand"), dict):
            meme_data["brand"] = _fallback_meme_data(state, agreement)["brand"]

        if "pillars" not in meme_data:
            meme_data["pillars"] = pillars
        if "anomalies" not in meme_data:
            meme_data["anomalies"] = anomalies

        state["meme_page_data"] = meme_data
        state["logs"].append(
            f"Payload Architected: [{meme_data['type']}] {meme_data['token']['name']}"
        )

    except Exception as e:
        state["logs"].append(f"Architect node failed: {e}")
        state["meme_page_data"] = _fallback_meme_data(state, agreement)
        state["logs"].append("Architect fallback payload generated.")

    return state
