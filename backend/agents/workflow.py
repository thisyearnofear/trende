import asyncio
import json
import datetime
import os
import uuid
from typing import Any, Optional

from langgraph.graph import END, StateGraph

from backend.agents.state import GraphState
from backend.database.vector_store import vector_store
from backend.integrations.connectors.twitter import TwitterConnector
from backend.services.ai_service import ai_service
from shared.models import QueryStatus


async def planner_node(state: GraphState) -> GraphState:
    state["status"] = QueryStatus.PLANNING
    state["logs"].append(f"🧠 INITIALIZING: Crafting a strategic research blueprint for '{state['topic']}'...")

    # RAG: Check historical context
    try:
        historical_matches = vector_store.query_historical_context(state["topic"], n_results=3)
        historical_context = ""
        if historical_matches:
            state["logs"].append(f"📚 MEMORY BANK: Retrieved {len(historical_matches)} relevant historical trends for cross-referencing.")
            historical_context = "\n".join([f"- {m['content']}" for m in historical_matches])
        else:
            state["logs"].append(f"🔍 EXPLORATION MODE: No prior data found. Venturing into uncharted territory...")
    except Exception as e:
        print(f"RAG failed: {e}")
        state["logs"].append(f"⚠️  MEMORY OFFLINE: Historical context unavailable. Proceeding with fresh discovery.")
        historical_context = ""

    prompt = f"""
    The user wants to find trends about: {state["topic"]}
    Requested platforms: {", ".join(state["platforms"])}

    Historical Context (Past reports):
    {historical_context if historical_context else "No historical data found."}

    Generate a research plan in JSON format.
    You MUST include search queries for each of the requested platforms.
    Available platforms: twitter, linkedin, news, newsapi, tiktok, youtube, web, gdelt, wikimedia, hackernews, stackexchange, coingecko, tinyfish.
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
    response = await ai_service.get_response(
        prompt, system_prompt="You are an expert trend researcher."
    )

    def normalize_platform(value: str) -> str:
        v = (value or "").strip().lower()
        alias = {
            "news": "newsapi",
            "hn": "hackernews",
            "se": "stackexchange",
        }
        return alias.get(v, v)

    requested = [normalize_platform(p) for p in (state.get("platforms") or [])]
    requested_set = set(requested)

    try:
        # Simple extraction logic (could be more robust with regex)
        plan_json = response[response.find("{") : response.rfind("}") + 1]
        plan = json.loads(plan_json)
        state["plan"] = plan
        raw_queries = plan.get("search_queries", []) or []
        cleaned_queries = []

        for sq in raw_queries:
            platform = normalize_platform(str(sq.get("platform", "")))
            query = (sq.get("query") or state["topic"]).strip()
            if not platform or platform not in requested_set:
                continue
            cleaned_queries.append({"platform": platform, "query": query})

        # Guarantee coverage for every requested platform.
        covered = {sq["platform"] for sq in cleaned_queries}
        for platform in requested:
            if platform not in covered:
                cleaned_queries.append({"platform": platform, "query": state["topic"]})

        state["search_queries"] = cleaned_queries
        state["logs"].append(
            f"🎯 STRATEGY FORMULATED: Created {len(state['search_queries'])} precision-targeted queries for optimal coverage."
        )
    except Exception as e:
        state["logs"].append(f"⚠️  PLAN ADJUSTMENT: Failed to parse research plan, falling back to general queries. Error: {e}")
        # Fallback query
        state["search_queries"] = [
            {"platform": p, "query": state["topic"]} for p in state["platforms"]
        ]

    return state


async def researcher_node(state: GraphState) -> GraphState:
    state["status"] = QueryStatus.RESEARCHING
    deduped_queries: list[dict[str, str]] = []
    seen = set()
    for sq in state["search_queries"]:
        platform = (sq.get("platform") or "").strip().lower()
        query = (sq.get("query") or "").strip()
        key = (platform, query.lower())
        if not platform or not query or key in seen:
            continue
        seen.add(key)
        deduped_queries.append({"platform": platform, "query": query})
    if len(deduped_queries) != len(state["search_queries"]):
        state["logs"].append(
            f"♻️ REQUEST DEDUPE: Collapsed {len(state['search_queries']) - len(deduped_queries)} duplicate platform-query jobs."
        )
    state["search_queries"] = deduped_queries

    platforms = list(set(sq["platform"] for sq in state["search_queries"]))
    platform_names = ', '.join(platforms).upper()
    state["logs"].append(f"📡 MISSION: Scanning the digital cosmos for signals from {platform_names}...")

    # Initialize connectors
    from backend.integrations.connectors.linkedin import LinkedInConnector
    from backend.integrations.connectors.newsapi import NewsConnector
    from backend.integrations.connectors.tabstack import TabstackConnector
    from backend.integrations.connectors.tiktok import TikTokConnector
    from backend.integrations.connectors.youtube import YouTubeConnector
    from backend.integrations.connectors.gdelt import GDELTConnector
    from backend.integrations.connectors.wikimedia import WikimediaConnector
    from backend.integrations.connectors.hackernews import HackerNewsConnector
    from backend.integrations.connectors.stackexchange import StackExchangeConnector
    from backend.integrations.connectors.coingecko import CoinGeckoConnector
    from backend.integrations.connectors.tinyfish import TinyFishConnector

    twitter = TwitterConnector()
    linkedin = LinkedInConnector()
    news = NewsConnector()
    tabstack = TabstackConnector()
    tinyfish = TinyFishConnector()
    tiktok = TikTokConnector()
    youtube = YouTubeConnector()
    gdelt = GDELTConnector()
    wikimedia = WikimediaConnector()
    hackernews = HackerNewsConnector()
    stackexchange = StackExchangeConnector()
    coingecko = CoinGeckoConnector()

    tasks = []
    task_platforms = []
    for sq in state["search_queries"]:
        platform = sq["platform"]
        query = sq["query"]
        task_platforms.append(platform)
        state["logs"].append(f"🤖 AGENT >> Establishing quantum link to {platform.upper()} for: '{query}'")

        if platform == "twitter":
            tasks.append(twitter.search(query, limit=5))
        elif platform == "linkedin":
            tasks.append(linkedin.search(query, limit=5))
        elif platform in ["news", "newsapi"]:
            tasks.append(news.search(query, limit=5))
        elif platform == "web":
            tasks.append(tabstack.search(query, limit=5))
        elif platform == "tiktok":
            tasks.append(tiktok.search(query, limit=5))
        elif platform == "youtube":
            tasks.append(youtube.search(query, limit=5))
        elif platform == "gdelt":
            tasks.append(gdelt.search(query, limit=5))
        elif platform == "wikimedia":
            tasks.append(wikimedia.search(query, limit=5))
        elif platform in ["hackernews", "hn"]:
            tasks.append(hackernews.search(query, limit=5))
        elif platform in ["stackexchange", "se"]:
            tasks.append(stackexchange.search(query, limit=5))
        elif platform == "coingecko":
            tasks.append(coingecko.search(query, limit=5))
        elif platform == "tinyfish":
            tasks.append(tinyfish.search(query, limit=5))
        else:
            # Fallback for unknown platforms
            state["logs"].append(f"⚠️  Warning: Platform {platform} not natively supported. Attempting web fallback.")
            tasks.append(tabstack.search(query, limit=5))

    if tasks:
        state["logs"].append(f"🔄 Gathering intelligence from {len(tasks)} sources simultaneously...")
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_items = []
        for i, result in enumerate(results):
            platform = task_platforms[i] if i < len(task_platforms) else "unknown"
            if isinstance(result, Exception):
                state["logs"].append(f"❌ ERROR: Platform {platform.upper()} failed: {str(result)}")
            elif not result:
                state["logs"].append(f"⚠️  EMPTY: No data found on {platform.upper()}. This could be due to rate limits or narrow search.")
            else:
                state["logs"].append(f"✅ SUCCESS: Harvested {len(result)} items from {platform.upper()}")
                all_items.extend(result)
        
        state["raw_findings"] = all_items
        if all_items:
            state["logs"].append(
                f"📊 AGGREGATION COMPLETE: Total signals acquired: {len(all_items)}. Commencing neural validation..."
            )
        else:
            state["logs"].append("🚨 CRITICAL: No data harvested from any source. Synthesis will be based on limited context.")
    else:
        state["logs"].append("😴 No search tasks were generated. Nothing to harvest.")

    return state


async def validator_node(state: GraphState) -> GraphState:
    state["logs"].append("🔍 TRUTH ENGINE: Cross-verifying and validating research findings...")

    if not state.get("raw_findings"):
        state["logs"].append("😴 No data to validate. Proceeding with empty dataset.")
        state["filtered_findings"] = []
        state["confidence_score"] = 0.0
        return state

    # Construct context for validation
    findings_context = "\n".join(
        [f"SOURCE [{f.platform}] @{f.author}: {f.content[:200]}" for f in state["raw_findings"]]
    )

    prompt = f"""
    You are a Fact-Checking Agent. Review these research findings for the topic: {state["topic"]}

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
    response = await ai_service.get_response(
        prompt, system_prompt="You are a strict data validator."
    )
    try:
        val_json = response[response.find("{") : response.rfind("}") + 1]
        data = json.loads(val_json)

        state["confidence_score"] = data.get("confidence_score", 0.5)
        valid_indices = data.get("valid_indices", [])
        state["validation_results"] = data.get("validation_logs", [])

        # Filter findings
        state["filtered_findings"] = [
            state["raw_findings"][i] for i in valid_indices if i < len(state["raw_findings"])
        ]
        state["logs"].append(
            f"✅ VERIFICATION COMPLETE: Confidence level: {state['confidence_score']:.2f}. Curated {len(state['filtered_findings'])} high-quality insights."
        )
    except Exception as e:
        state["logs"].append(f"⚠️  VALIDATION ERROR: Parsing failed: {e}. Using all raw findings as fallback.")
        state["filtered_findings"] = state["raw_findings"]
        state["confidence_score"] = 0.5

    return state


async def analyzer_node(state: GraphState) -> GraphState:
    state["status"] = QueryStatus.ANALYZING
    models = state.get("models") or ["venice", "aisa"]
    state["logs"].append(f"🔮 CONSENSUS FORGE: Activating neural networks {', '.join(models)} for synthesis...")
    state["logs"].append("🧠 Synthesizing raw signals into actionable intelligence...")

    findings_to_use = state["filtered_findings"] or state["raw_findings"]

    # Deep Enrichment: Use TinyFish if available, fallback to Tabstack
    from backend.integrations.connectors.tabstack import TabstackConnector
    from backend.integrations.connectors.tinyfish import TinyFishConnector

    tabstack = TabstackConnector()
    tinyfish = TinyFishConnector()

    enriched_context = []
    enrich_per_source_timeout = max(
        5,
        int(os.getenv("ENRICH_PER_SOURCE_TIMEOUT_SECS", "20")),
    )
    enrich_total_budget = max(
        enrich_per_source_timeout,
        int(os.getenv("ENRICH_TOTAL_BUDGET_SECS", "45")),
    )
    enrich_started_at = datetime.datetime.now(datetime.timezone.utc)
    # Sort by metrics (e.g. likes/retweets) or just take first few
    to_enrich = [f for f in findings_to_use if f.url and len(f.content) < 500][:3]

    if to_enrich:
        state["logs"].append(f"🔬 DEEP DIVE: Enriching {len(to_enrich)} key findings with agentic full-text analysis...")
        for item in to_enrich:
            elapsed = (
                datetime.datetime.now(datetime.timezone.utc) - enrich_started_at
            ).total_seconds()
            if elapsed >= enrich_total_budget:
                state["logs"].append("⏱️ ENRICHMENT BUDGET REACHED: Continuing with collected context to keep the run responsive.")
                break
            full_text = None
            if tinyfish.api_key:
                try:
                    full_text = await asyncio.wait_for(
                        tinyfish.extract_content(item.url),
                        timeout=enrich_per_source_timeout,
                    )
                except asyncio.TimeoutError:
                    state["logs"].append(
                        f"⏱️ TinyFish timeout ({enrich_per_source_timeout}s) for {item.url}. Falling back."
                    )
            
            if not full_text and tabstack.api_key:
                try:
                    full_text = await asyncio.wait_for(
                        tabstack.extract_content(item.url),
                        timeout=enrich_per_source_timeout,
                    )
                except asyncio.TimeoutError:
                    state["logs"].append(
                        f"⏱️ Tabstack extraction timeout ({enrich_per_source_timeout}s) for {item.url}."
                    )
            
            if full_text:
                enriched_context.append(
                    f"### FULL SOURCE: {item.title}\nURL: {item.url}\n\n{full_text[:3000]}"
                )  # Cap at 3k chars

    context = "\n\n".join(
        [f"[{item.platform}] @{item.author}: {item.content}" for item in findings_to_use]
    )

    if enriched_context:
        context = (
            "--- DEEP ENRICHMENT DATA ---\n"
            + "\n\n".join(enriched_context)
            + "\n\n--- RAW FINDINGS ---\n"
            + context
        )

    prompt = f"""
    Analyze the following research findings for the topic: {state["topic"]}
    Overall Research Confidence: {state.get("confidence_score", "N/A")}

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
    # Trend Report: {state["topic"]}
    ... (Markdown Content) ...
    """

    # Use Consensus Engine with user-selected models
    state["logs"].append(f"🤝 CONSOLIDATING WISDOM: Consulting {len(models)} AI oracles for consensus...")
    consensus_bundle = await ai_service.get_consensus_bundle(
        prompt,
        system_prompt="You are a professional, neutral trend analyst.",
        providers=state.get("models"),
    )
    report = str(consensus_bundle.get("consensus_report", ""))
    state["final_report_md"] = report
    state["summary"] = report[:500] + "..." if report else "No report generated."
    state["consensus_data"] = {
        "providers": consensus_bundle.get("providers", []),
        "provider_errors": consensus_bundle.get("provider_errors", []),
        "warnings": consensus_bundle.get("warnings", []),
        "diversity_level": consensus_bundle.get("diversity_level", "low"),
        "agreement_score": consensus_bundle.get("agreement_score", 0.0),
        "main_divergence": consensus_bundle.get("main_divergence", ""),
        "pillars": consensus_bundle.get("pillars", []),
        "anomalies": consensus_bundle.get("anomalies", []),
        "provider_outputs": consensus_bundle.get("provider_outputs", []),
        "synthesis_model": consensus_bundle.get("synthesis_model", "unknown"),
    }
    raw_attest = consensus_bundle.get("attestation")
    state["attestation_data"] = (
        raw_attest if isinstance(raw_attest, dict) else None
    )  # Ensure dict type
    state["logs"].append(
        f"🤝 SYNTHESIS COMPLETE: Generated consensus from {len(state['consensus_data'].get('providers', []))} AI models."
    )

    # Persist findings to Vector Store for future RAG
    try:
        vector_store.add_findings(findings_to_use, state["query_id"])
        state["logs"].append("💾 MEMORY ARCHIVED: Findings stored for future intelligence correlation.")
    except Exception as e:
        state["logs"].append(f"⚠️  STORAGE ISSUE: Failed to persist to vector store: {e}")

    state["status"] = QueryStatus.COMPLETED
    state["logs"].append("🏆 MISSION ACCOMPLISHED: Intelligence synthesis complete. Preparing attestation signature.")

    return state


def create_workflow() -> Any:
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


async def run_trend_analysis(
    idea: str, 
    platforms: list[str], 
    task_id: str, 
    models: list[str] = None,
    sponsor: str = None
) -> dict[str, Any]:
    """
    Run the full trend research workflow for a given idea and platforms.
    Used by external services like ACP.
    """
    if models is None:
        models = ["venice", "aisa"]
        
    workflow = create_workflow()
    
    # Initialize state matching GraphState
    initial_state = {
        "topic": idea,
        "platforms": platforms,
        "models": models,
        "query_id": task_id,
        "status": QueryStatus.PENDING,
        "logs": ["Task initialized via ACP."],
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "raw_findings": [],
        "filtered_findings": [],
        "plan": None,
        "search_queries": [],
        "summary": None,
        "final_report_md": None,
        "relevance_score": 0.0,
        "impact_score": 0.0,
        "confidence_score": 0.0,
        "validation_results": [],
        "meme_page_data": None,
        "consensus_data": None,
        "attestation_data": None,
        "error": None,
    }

    final_state = initial_state
    async for output in workflow.astream(initial_state):
        for node_name, state_update in output.items():
            final_state.update(state_update)
    return final_state

def create_editorial_workflow() -> Any:
    from backend.agents.nodes.editorial import editorial_node, publish_node
    
    workflow = StateGraph(GraphState)
    
    workflow.add_node("editorial", editorial_node)
    workflow.add_node("publisher", publish_node)
    
    workflow.set_entry_point("editorial")
    workflow.add_edge("editorial", "publisher")
    workflow.add_edge("publisher", END)
    
    return workflow.compile()

async def run_editorial_task(
    topic: str,
    report_md: str,
    api_key: Optional[str] = None,
) -> dict[str, Any]:
    """
    Run the editorial workflow to draft and optionally publish an article.
    """
    workflow = create_editorial_workflow()
    
    initial_state = {
        "topic": topic,
        "final_report_md": report_md,
        "paragraph_api_key": api_key,
        "logs": ["Starting Editorial Agent..."],
        "editorial_draft": None,
        "publish_status": "PENDING",
        "published_url": None,
        # Initialize other required keys with dummy/empty values
        "platforms": [],
        "models": [],
        "query_id": f"editorial_{uuid.uuid4()}",
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": QueryStatus.ANALYZING,
        "search_queries": [],
        "raw_findings": [],
        "filtered_findings": [],
        "plan": None,
        "summary": None,
        "relevance_score": 0.0,
        "impact_score": 0.0,
        "confidence_score": 0.0,
        "validation_results": [],
        "meme_page_data": None,
        "consensus_data": None,
        "attestation_data": None,
        "error": None,
    }
    
    final_state = initial_state
    async for output in workflow.astream(initial_state):
        for _, state_update in output.items():
            final_state.update(state_update)
            
    return final_state
