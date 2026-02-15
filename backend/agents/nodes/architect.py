import json
from typing import Dict, Any
from backend.agents.state import GraphState
from backend.services.ai_service import ai_service

async def architect_node(state: GraphState) -> GraphState:
    """
    The Architect node takes the final research and synthesizes it into a 
    'Meme Page Payload'—a structured format for launching a token on nad.fun.
    """
    state['logs'].append("Architecting Meme Page and Token Thesis...")
    
    if not state.get('final_report_md'):
        state['logs'].append("Skipping Architect: No research report found.")
        return state

    prompt = f"""
    You are a Meme Architect and Token Strategist. 
    Based on the following research report, create a high-conviction Token Thesis and Meme Page layout.
    
    Research Report:
    {state['final_report_md']}
    
    Confidence Score: {state.get('confidence_score', 0)}
    Relevant Citations: {len(state.get('filtered_findings', []))}
    
    TASK:
    Generate a JSON payload. The payload should be one of two types based on the content:
    TYPE A: 'Meme Page' (for viral trends/memes) - focus on tickers, memes, and community gravity.
    TYPE B: 'Intelligence Brief' (for technical/news topics) - focus on facts, consensus, and unbiased data.
    
    Output strictly as JSON:
    {{
        "type": "MEME" | "NEWS",
        "token": {{
            "name": "Trend Name",
            "ticker": "TICKER",
            "description": "Short bio"
        }},
        "intelligence_summary": "Neutral, multi-model consensus brief (for TYPE B)",
        "thesis": [
            "Reason 1...",
            "Reason 2...",
            "Reason 3..."
        ],
        "consensus_metrics": {{
            "model_agreement": 0.9,
            "main_divergence": "Conflict point if any"
        }},
        "citations": [
            {{"source": "Source Name", "url": "url", "quote": "quote link"}},
            ...
        ],
        "brand": {{
            "aesthetic": "style",
            "primary_color": "hex"
        }}
    }}
    """
    
    try:
        response = await ai_service.get_response(prompt, system_prompt="You are a master of attention and community conviction.")
        # Extract JSON
        json_str = response[response.find("{"):response.rfind("}")+1]
        meme_data = json.loads(json_str)
        
        # Add metadata
        meme_data["generated_at"] = state['created_at']
        meme_data["confidence_score"] = state['confidence_score']
        
        state['meme_page_data'] = meme_data
        state['logs'].append(f"Meme Page Architected: ${meme_data['token']['ticker']} - {meme_data['token']['name']}")
        
    except Exception as e:
        state['logs'].append(f"Architect node failed: {e}")
        state['meme_page_data'] = None
        
    return state
