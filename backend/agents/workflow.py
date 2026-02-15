from shared.models import QueryStatus, PlatformType, TrendItem
from backend.agents.state import GraphState
from langgraph.graph import StateGraph, END
from backend.services.ai_service import ai_service
import json
import asyncio
from typing import List
from backend.integrations.connectors.twitter import TwitterConnector
from backend.database.vector_store import vector_store

async def planner_node(state: GraphState) -> GraphState:
    state['status'] = QueryStatus.PLANNING
    state['logs'].append(f"Planning research for topic: {state['topic']}")
    
    # RAG: Check historical context
    historical_matches = vector_store.query_historical_context(state['topic'], n_results=3)
    historical_context = ""
    if historical_matches:
        state['logs'].append(f"Found {len(historical_matches)} relevant historical trends.")
        historical_context = "\n".join([f"- {m['content']}" for m in historical_matches])
    
    prompt = f"""
    The user wants to find trends about: {state['topic']}
    Requested platforms: {', '.join(state['platforms'])}
    
    Historical Context (Past reports):
    {historical_context if historical_context else "No historical data found."}
    
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
    from backend.integrations.connectors.linkedin import LinkedInConnector
    from backend.integrations.connectors.newsapi import NewsConnector
    from backend.integrations.connectors.tabstack import TabstackConnector
    
    twitter = TwitterConnector()
    linkedin = LinkedInConnector()
    news = NewsConnector()
    tabstack = TabstackConnector()
    
    tasks = []
    for sq in state['search_queries']:
        if sq['platform'] == 'twitter':
            tasks.append(twitter.search(sq['query'], limit=5))
        elif sq['platform'] == 'linkedin':
            tasks.append(linkedin.search(sq['query'], limit=5))
        elif sq['platform'] in ['news', 'newsapi']:
            tasks.append(news.search(sq['query'], limit=5))
        elif sq['platform'] == 'web':
            tasks.append(tabstack.search(sq['query'], limit=5))
            
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
    
    # Deep Enrichment: If we have Tabstack, enrich the top 3 most relevant-looking items
    from backend.integrations.connectors.tabstack import TabstackConnector
    tabstack = TabstackConnector()
    
    enriched_context = []
    # Sort by metrics (e.g. likes/retweets) or just take first few
    to_enrich = [f for f in state['raw_findings'] if f.url and len(f.content) < 500][:3]
    
    if to_enrich and tabstack.api_key:
        state['logs'].append(f"Enriching {len(to_enrich)} findings with full-text extraction...")
        for item in to_enrich:
            full_text = await tabstack.extract_content(item.url)
            if full_text:
                enriched_context.append(f"### FULL SOURCE: {item.title}\nURL: {item.url}\n\n{full_text[:3000]}") # Cap at 3k chars
    
    context = "\n\n".join([
        f"[{item.platform}] @{item.author}: {item.content}"
        for item in state['raw_findings']
    ])
    
    if enriched_context:
        context = "--- DEEP ENRICHMENT DATA ---\n" + "\n\n".join(enriched_context) + "\n\n--- RAW FINDINGS ---\n" + context
    
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
    
    # Persist findings to Vector Store for future RAG
    try:
        vector_store.add_findings(state['raw_findings'], state['query_id'])
        state['logs'].append("Findings persisted to vector store for historical correlation.")
    except Exception as e:
        state['logs'].append(f"Warning: Failed to persist to vector store: {e}")

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
