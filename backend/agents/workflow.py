from shared.models.models import QueryStatus, PlatformType, TrendItem
from backend.services.ai_service import ai_service
import json
import asyncio
from typing import List
from backend.integrations.connectors.twitter import TwitterConnector

async def planner_node(state: GraphState) -> GraphState:
    state['status'] = QueryStatus.PLANNING
    state['logs'].append(f"Planning research for topic: {state['topic']}")
    
    prompt = f"""
    The user wants to find trends about: {state['topic']}
    Requested platforms: {', '.join(state['platforms'])}
    
    Generate a research plan in JSON format:
    {{
        "focus_areas": ["area1", "area2"],
        "search_queries": [
            {{"platform": "twitter", "query": "query string"}},
            {{"platform": "news", "query": "query string"}}
        ]
    }}
    """
    
    response = await ai_service.get_response(prompt, system_prompt="You are an expert trend researcher.")
    try:
        # Simple extraction logic (could be more robust with regex)
        plan_json = response[response.find("{"):response.rfind("}")+1]
        plan = json.loads(plan_json)
        state['plan'] = plan
        state['search_queries'] = plan.get('search_queries', [])
        state['logs'].append(f"Research plan created with {len(state['search_queries'])} target queries.")
    except Exception as e:
        state['logs'].append(f"Failed to parse research plan: {e}")
        # Fallback query
        state['search_queries'] = [{"platform": p, "query": state['topic']} for p in state['platforms']]
        
    return state

async def researcher_node(state: GraphState) -> GraphState:
    state['status'] = QueryStatus.RESEARCHING
    state['logs'].append(f"Executing search queries...")
    
    # Initialize connectors
    twitter = TwitterConnector()
    # TODO: Add other connectors (Linkedin, News)
    
    tasks = []
    for sq in state['search_queries']:
        if sq['platform'] == 'twitter':
            tasks.append(twitter.search(sq['query'], limit=5))
        # Add news/linkedin fallback or logic here
            
    if tasks:
        results = await asyncio.gather(*tasks)
        # Flatten results
        all_items = [item for sublist in results for item in sublist]
        state['raw_findings'] = all_items
        state['logs'].append(f"Found {len(all_items)} raw items across platforms.")
    else:
        state['logs'].append("No search tasks were generated.")
        
    return state

async def analyzer_node(state: GraphState) -> GraphState:
    state['status'] = QueryStatus.ANALYZING
    state['logs'].append("Synthesizing findings into a final report...")
    
    context = "\n\n".join([
        f"[{item.platform}] @{item.author}: {item.content}"
        for item in state['raw_findings']
    ])
    
    prompt = f"""
    Analyze the following research findings for the topic: {state['topic']}
    
    Findings:
    {context}
    
    Task: Create a detailed Trend Report in Markdown.
    Include:
    - Executive Summary
    - Platform-specific insights
    - Impact Score (1-10)
    - Relevance Score (1-10)
    
    Output format:
    # Trend Report: {state['topic']}
    ... (Markdown Content) ...
    """
    
    report = await ai_service.get_response(prompt, system_prompt="You are a professional trend analyst.")
    state['final_report_md'] = report
    state['summary'] = report[:500] + "..." # Brief summary
    state['status'] = QueryStatus.COMPLETED
    state['logs'].append("Trend report generation complete.")
    
    return state

def create_workflow():
    workflow = StateGraph(GraphState)
    
    workflow.add_node("planner", planner_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("analyzer", analyzer_node)
    
    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "researcher")
    workflow.add_edge("researcher", "analyzer")
    workflow.add_edge("analyzer", END)
    
    return workflow.compile()
