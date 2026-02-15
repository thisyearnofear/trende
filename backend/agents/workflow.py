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
    
    Generate a research plan in JSON format.
    You MUST include search queries for each of the requested platforms.
    Available platforms: twitter, linkedin, news, tiktok, youtube, web.
    If the user asked for a specific platform, prioritize it.
    
    JSON format:
    {{
        "focus_areas": ["area1", "area2"],
        "search_queries": [
            {{"platform": "twitter", "query": "query string"}},
            {{"platform": "tiktok", "query": "trending hashtags for topic"}}
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
    from backend.integrations.connectors.tiktok import TikTokConnector
    from backend.integrations.connectors.youtube import YouTubeConnector
    
    twitter = TwitterConnector()
    linkedin = LinkedInConnector()
    news = NewsConnector()
    tabstack = TabstackConnector()
    tiktok = TikTokConnector()
    youtube = YouTubeConnector()
    
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
        elif sq['platform'] == 'tiktok':
            tasks.append(tiktok.search(sq['query'], limit=5))
        elif sq['platform'] == 'youtube':
            tasks.append(youtube.search(sq['query'], limit=5))
            
    if tasks:
        results = await asyncio.gather(*tasks)
        # Flatten results
        all_items = [item for sublist in results for item in sublist]
        state['raw_findings'] = all_items
        state['logs'].append(f"Found {len(all_items)} raw items across platforms.")
    else:
        state['logs'].append("No search tasks were generated.")
        
    return state

async def validator_node(state: GraphState) -> GraphState:
    state['logs'].append("Validating research findings...")
    
    if not state['raw_findings']:
        state['filtered_findings'] = []
        state['confidence_score'] = 0.0
        return state

    # Construct context for validation
    findings_context = "\n".join([
        f"SOURCE [{f.platform}] @{f.author}: {f.content[:200]}"
        for f in state['raw_findings']
    ])

    prompt = f"""
    You are a Fact-Checking Agent. Review these research findings for the topic: {state['topic']}
    
    Findings:
    {findings_context}
    
    TASKS:
    1. Identify any contradictory information.
    2. Score the reliability of each source (High/Medium/Low).
    3. Filter out clearly platform-spam or irrelevant content.
    4. Provide an overall confidence score (0.0 to 1.0).
    5. Return a list of indices representing valid sources.

    Output as JSON:
    {{
        "confidence_score": 0.85,
        "valid_indices": [0, 2, 3],
        "validation_logs": ["Source 1 flagged for low reliability", "Source 2 confirmed by multiple platforms"]
    }}
    """
    
    response = await ai_service.get_response(prompt, system_prompt="You are a strict data validator.")
    try:
        val_json = response[response.find("{"):response.rfind("}")+1]
        data = json.loads(val_json)
        
        state['confidence_score'] = data.get('confidence_score', 0.5)
        valid_indices = data.get('valid_indices', [])
        state['validation_results'] = data.get('validation_logs', [])
        
        # Filter findings
        state['filtered_findings'] = [state['raw_findings'][i] for i in valid_indices if i < len(state['raw_findings'])]
        state['logs'].append(f"Validation complete. Confidence: {state['confidence_score']}. Filtered to {len(state['filtered_findings'])} reliable items.")
    except Exception as e:
        state['logs'].append(f"Validation parsing failed: {e}. Using all raw findings as fallback.")
        state['filtered_findings'] = state['raw_findings']
        state['confidence_score'] = 0.5
        
    return state

async def analyzer_node(state: GraphState) -> GraphState:
    state['status'] = QueryStatus.ANALYZING
    state['logs'].append("Synthesizing findings into a final report...")
    
    findings_to_use = state['filtered_findings'] or state['raw_findings']
    
    # Deep Enrichment: If we have Tabstack, enrich the top 3 most relevant-looking items
    from backend.integrations.connectors.tabstack import TabstackConnector
    tabstack = TabstackConnector()
    
    enriched_context = []
    # Sort by metrics (e.g. likes/retweets) or just take first few
    to_enrich = [f for f in findings_to_use if f.url and len(f.content) < 500][:3]
    
    if to_enrich and tabstack.api_key:
        state['logs'].append(f"Enriching {len(to_enrich)} findings with full-text extraction...")
        for item in to_enrich:
            full_text = await tabstack.extract_content(item.url)
            if full_text:
                enriched_context.append(f"### FULL SOURCE: {item.title}\nURL: {item.url}\n\n{full_text[:3000]}") # Cap at 3k chars
    
    context = "\n\n".join([
        f"[{item.platform}] @{item.author}: {item.content}"
        for item in findings_to_use
    ])
    
    if enriched_context:
        context = "--- DEEP ENRICHMENT DATA ---\n" + "\n\n".join(enriched_context) + "\n\n--- RAW FINDINGS ---\n" + context
    
    prompt = f"""
    Analyze the following research findings for the topic: {state['topic']}
    Overall Research Confidence: {state.get('confidence_score', 'N/A')}
    
    Findings:
    {context}
    
    Task: Create a detailed, UNBIASED Trend Report in Markdown.
    Include:
    - Executive Summary
    - Platform-specific insights
    - Impact Score (1-10)
    - Relevance Score (1-10)
    - Confidence Analysis (based on the provided research confidence)
    - Bias Mitigation: Briefly explain how multi-model consensus was used to ensure neutrality.
    
    Output format:
    # Trend Report: {state['topic']}
    ... (Markdown Content) ...
    """
    
    # Use Consensus Engine to reduce single-model bias and capture verifiability metadata
    consensus_bundle = await ai_service.get_consensus_bundle(
        prompt,
        system_prompt="You are a professional, neutral trend analyst.",
    )
    report = str(consensus_bundle.get("consensus_report", ""))
    state['final_report_md'] = report
    state['summary'] = report[:500] + "..." if report else "No report generated."
    state['consensus_data'] = {
        "providers": consensus_bundle.get("providers", []),
        "agreement_score": consensus_bundle.get("agreement_score", 0.0),
        "main_divergence": consensus_bundle.get("main_divergence", ""),
        "provider_outputs": consensus_bundle.get("provider_outputs", []),
        "synthesis_model": consensus_bundle.get("synthesis_model", "unknown"),
    }
    state['attestation_data'] = consensus_bundle.get("attestation", None)
    state['logs'].append(
        f"Consensus generated from {len(state['consensus_data'].get('providers', []))} model outputs."
    )
    
    # Persist findings to Vector Store for future RAG
    try:
        vector_store.add_findings(findings_to_use, state['query_id'])
        state['logs'].append("Findings persisted to vector store for historical correlation.")
    except Exception as e:
        state['logs'].append(f"Warning: Failed to persist to vector store: {e}")

    state['status'] = QueryStatus.COMPLETED
    state['logs'].append("Trend report generation complete.")
    
    return state

def create_workflow():
    from backend.agents.nodes.architect import architect_node
    
    workflow = StateGraph(GraphState)
    
    workflow.add_node("planner", planner_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("validator", validator_node)
    workflow.add_node("analyzer", analyzer_node)
    workflow.add_node("architect", architect_node)
    
    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "researcher")
    workflow.add_edge("researcher", "validator")
    workflow.add_edge("validator", "analyzer")
    workflow.add_edge("analyzer", "architect")
    workflow.add_edge("architect", END)
    
    return workflow.compile()
