import json
from typing import Dict, Any
from backend.agents.state import GraphState
from backend.services.ai_service import ai_service

async def architect_node(state: GraphState) -> GraphState:
    """
    The Architect node takes the final research and synthesizes it into a 
    'Meme Page Payload'—a structured format for launching a token or providing a news brief.
    """
    state['logs'].append("Architecting final payload...")
    
    if not state.get('final_report_md'):
        state['logs'].append("Skipping Architect: No research report found.")
        return state

    consensus = state.get('consensus_data', {})
    pillars = consensus.get('pillars', [])
    anomalies = consensus.get('anomalies', [])
    agreement = consensus.get('agreement_score', 0.5)

    # Determine mode: Default to NEWS if technical/heavy agreement, MEME if social/viral
    suggested_mode = "NEWS" if agreement > 0.4 else "MEME"
    
    prompt = f"""
    You are a Strategic Architect for the Monad economy.
    Based on the following research and consensus data, create a high-conviction structured payload.
    
    Research Report:
    {state['final_report_md']}
    
    Consensus Data:
    - Pillars (Verified Facts): {pillars}
    - Anomalies (Fringe/Alpha): {anomalies}
    - Agreement Score: {agreement}
    
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
        "intelligence_summary": "Neutral, multi-model consensus brief focused on the {len(pillars)} verified pillars.",
        "thesis": [
            "Conviction point 1...",
            "Conviction point 2..."
        ],
        "consensus_metrics": {{
            "model_agreement": {agreement},
            "main_divergence": "{consensus.get('main_divergence', '')}"
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
        # Extract JSON
        json_str = response[response.find("{"):response.rfind("}")+1]
        meme_data = json.loads(json_str)
        
        # Add metadata and carry over consensus fields if missing
        meme_data["generated_at"] = state['created_at']
        meme_data["confidence_score"] = state['confidence_score']
        
        if "pillars" not in meme_data:
            meme_data["pillars"] = pillars
        if "anomalies" not in meme_data:
            meme_data["anomalies"] = anomalies
            
        state['meme_page_data'] = meme_data
        state['logs'].append(f"Payload Architected: [{meme_data['type']}] {meme_data['token']['name']}")
        
    except Exception as e:
        state['logs'].append(f"Architect node failed: {e}")
        state['meme_page_data'] = None
        
    return state
