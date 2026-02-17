from typing import Any

from backend.agents.state import GraphState
from backend.services.ai_service import ai_service
from backend.integrations.connectors.paragraph import ParagraphConnector, parse_markdown_title

async def editorial_node(state: GraphState) -> GraphState:
    """
    Transforms the raw trend report into a polished editorial draft.
    """
    state["logs"].append("✍️ EDITORIAL: Crafting a publish-ready article...")
    
    report = (state.get("final_report_md") or "").strip()
    if not report:
        state["logs"].append("⚠️ EDITORIAL: No report found to process.")
        return state

    # 1. Draft Generation
    prompt = f"""
    You are an expert Editor-in-Chief for a cutting-edge tech publication.
    Transform the following Trend Report into a high-engagement, innovative article.
    
    Target Audience: Tech-savvy early adopters, investors, and futurists.
    Tone: Analytical, confident, forward-looking.
    Format: Markdown with clear headers.
    
    Trend Report:
    {report[:12000]}
    
    Requirements:
    - Create a catchy, click-worthy Title (H1).
    - Write a compelling Introduction (hook).
    - Organize the insights into 3-4 key themes.
    - Include a "What This Means for You" section.
    - Add a "References" section at the end (keep source links).
    - Keep it under 1000 words.
    
    Output strictly as Markdown.
    """
    
    try:
        draft = await ai_service.get_response(
            prompt,
            system_prompt="You are a professional editor."
        )
        state["editorial_draft"] = str(draft or "").strip()
        state["logs"].append("✅ EDITORIAL: Draft created successfully.")
        
    except Exception as e:
        state["logs"].append(f"❌ EDITORIAL ERROR: Failed to generate draft: {e}")

    return state

async def publish_node(state: GraphState) -> GraphState:
    """
    Attempts to publish the draft to Paragraph if credentials exist.
    """
    draft = state.get("editorial_draft")
    api_key = state.get("paragraph_api_key")
    
    if not draft:
        return state
        
    if not api_key:
        state["logs"].append("ℹ️ PUBLISH: No Paragraph API Key found. Skipping auto-publish.")
        state["publish_status"] = "DRAFT_ONLY"
        return state

    state["logs"].append("🚀 PUBLISHING: Promoting draft to Paragraph...")
    
    connector = ParagraphConnector(api_key=api_key)
    
    try:
        title, content = parse_markdown_title(draft)
        result = await connector.create_post(title=title, content=content)
        
        state["publish_status"] = "SUCCESS"
        state["published_url"] = result.get("url")
        if state["published_url"]:
            state["logs"].append(f"✅ PUBLISHED: Draft available at {state['published_url']}")
        else:
            state["logs"].append("✅ PUBLISHED: Draft created. Paragraph did not return a direct URL.")
        
    except Exception as e:
        state["logs"].append(f"❌ PUBLISH ERROR: {str(e)[:280]}")
        state["publish_status"] = "FAILED"

    return state
