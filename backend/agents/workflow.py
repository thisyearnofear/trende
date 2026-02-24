import asyncio
import json
import datetime
import os
import uuid
from typing import Any, Awaitable, Callable, Optional

from langgraph.graph import END, StateGraph

from backend.agents.state import GraphState
from backend.database.vector_store import vector_store
from backend.integrations.connectors.twitter import TwitterConnector
from backend.services.ai_service import ai_service
from shared.models import QueryStatus


def _normalize_text(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _finding_dedupe_key(item: Any) -> tuple[str, str]:
    platform = _normalize_text(str(getattr(item, "platform", "") or ""))
    url = _normalize_text(str(getattr(item, "url", "") or ""))
    title = _normalize_text(str(getattr(item, "title", "") or ""))
    content = _normalize_text(str(getattr(item, "content", "") or ""))[:180]
    # Prefer URL identity; fall back to title/content signature.
    identity = url or f"{title}|{content}"
    return (platform, identity)


def _timestamp_rank(item: Any) -> float:
    ts = getattr(item, "timestamp", None)
    if ts is None:
        return 0.0
    if isinstance(ts, datetime.datetime):
        return ts.timestamp()
    if isinstance(ts, str):
        try:
            return datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0.0
    return 0.0


def _select_validator_sample(findings: list[Any], limit: int) -> list[Any]:
    if len(findings) <= limit:
        return findings

    # Bias toward recency, then keep cross-platform diversity in the sample.
    ordered = sorted(findings, key=_timestamp_rank, reverse=True)
    by_platform: dict[str, list[Any]] = {}
    for item in ordered:
        platform = _normalize_text(str(getattr(item, "platform", "") or "unknown"))
        by_platform.setdefault(platform, []).append(item)

    sample: list[Any] = []
    while len(sample) < limit:
        progressed = False
        for platform in list(by_platform.keys()):
            bucket = by_platform.get(platform) or []
            if not bucket:
                continue
            sample.append(bucket.pop(0))
            progressed = True
            if len(sample) >= limit:
                break
        if not progressed:
            break

    return sample


async def _generate_follow_up_directions(
    topic: str, validation_logs: list[str], findings: list[Any]
) -> list[str]:
    if not validation_logs and not findings:
        return []

    sample_lines = [
        f"- [{getattr(f, 'platform', 'unknown')}] {str(getattr(f, 'title', '') or getattr(f, 'content', ''))[:160]}"
        for f in findings[:8]
    ]
    log_lines = [f"- {line}" for line in validation_logs[:8]]
    prompt = f"""
You are a research planner. The current pass on "{topic}" has low confidence.

Validation notes:
{chr(10).join(log_lines) if log_lines else "- No explicit validation logs"}

Evidence snapshot:
{chr(10).join(sample_lines) if sample_lines else "- No evidence snapshot available"}

Return ONLY JSON:
{{
  "follow_up_directions": [
    "Short, concrete direction with a verifiable target",
    "Another direction focused on contradictory or missing evidence",
    "Another direction focused on recency/time-window verification"
  ]
}}
"""
    try:
        response = await ai_service.get_response(
            prompt,
            system_prompt="You produce concise, high-signal follow-up research directions.",
        )
        parsed = response[response.find("{") : response.rfind("}") + 1]
        data = json.loads(parsed)
        directions = data.get("follow_up_directions", [])
        if isinstance(directions, list):
            cleaned = [str(d).strip() for d in directions if str(d).strip()]
            return cleaned[:3]
    except Exception:
        pass

    # Deterministic fallback if follow-up generation fails.
    fallback: list[str] = []
    for line in validation_logs[:3]:
        base = str(line).strip()
        if not base:
            continue
        fallback.append(f"Resolve this evidence gap with fresh primary sources: {base}")
    if not fallback:
        fallback = [
            "Verify contradictory claims using two independent, recent primary sources.",
            "Collect one quantitative datapoint (volume, usage, or growth) to validate momentum.",
            "Prioritize sources published in the last 7 days and compare narrative consistency.",
        ]
    return fallback[:3]


async def planner_node(state: GraphState) -> GraphState:
    state["status"] = QueryStatus.PLANNING
    depth = state.get("current_depth", 0)
    
    if depth > 0 and state.get("follow_up_directions"):
        state["logs"].append(f"🔄 DEEP DIVE (Depth {depth}): Refining research based on previous findings...")
        follow_up_context = "\n".join([f"- {d}" for d in state["follow_up_directions"]])
        prompt_prefix = f"This is a follow-up research task at depth {depth}. Focus specifically on these areas that need more clarity:\n{follow_up_context}"
    else:
        state["logs"].append(f"🧠 INITIALIZING: Crafting a strategic research blueprint for '{state['topic']}'...")
        prompt_prefix = "This is the initial research phase."

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
    {prompt_prefix}
    
    The user wants to find trends about: {state["topic"]}
    Requested platforms: {", ".join(state["platforms"])}

    Historical Context (Past reports):
    {historical_context if historical_context else "No historical data found."}

    Generate a research plan in JSON format.
    You MUST include search queries for each of the requested platforms.
    Available platforms: twitter, linkedin, news, newsapi, tiktok, youtube, web, gdelt, wikimedia, hackernews, stackexchange, coingecko, tinyfish, chainlink, firecrawl, synthdata.
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
        
        # Increment depth for tracking
        state["current_depth"] = depth + 1
        # Clear follow-up directions after use
        state["follow_up_directions"] = []
        
    except Exception as e:
        state["logs"].append(f"⚠️  PLAN ADJUSTMENT: Failed to parse research plan, falling back to general queries. Error: {e}")
        # Fallback query
        state["search_queries"] = [
            {"platform": p, "query": state["topic"]} for p in state["platforms"]
        ]
        state["current_depth"] = depth + 1

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
    from backend.integrations.connectors.chainlink import ChainlinkConnector
    from backend.integrations.connectors.firecrawl import FirecrawlConnector
    from backend.integrations.connectors.synthdata import SynthDataConnector

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
    chainlink = ChainlinkConnector()
    firecrawl = FirecrawlConnector()
    synthdata = SynthDataConnector()

    tasks = []
    default_timeout = max(8, int(os.getenv("RESEARCH_PLATFORM_TIMEOUT_SECS", "45")))
    web_timeout = max(default_timeout, int(os.getenv("RESEARCH_WEB_TIMEOUT_SECS", "75")))
    tinyfish_timeout = max(web_timeout, int(os.getenv("RESEARCH_TINYFISH_TIMEOUT_SECS", "120")))
    retries = max(1, int(os.getenv("RESEARCH_CONNECTOR_RETRIES", "2")))
    retry_backoff = max(0.2, float(os.getenv("RESEARCH_CONNECTOR_BACKOFF_SECS", "0.8")))

    async def execute_connector(
        label: str,
        run: Callable[[], Awaitable[list[dict[str, Any]] | list[Any]]],
        timeout_secs: int,
    ) -> tuple[list[Any], Optional[str]]:
        last_error: Optional[str] = None
        for attempt in range(1, retries + 1):
            try:
                result = await asyncio.wait_for(run(), timeout=timeout_secs)
                return (result or []), None
            except asyncio.TimeoutError:
                last_error = f"{label} timed out after {timeout_secs}s"
            except Exception as e:
                last_error = f"{label} error: {e}"

            if attempt < retries:
                sleep_secs = retry_backoff * attempt
                state["logs"].append(
                    f"↻ RETRY {attempt}/{retries - 1}: {label.upper()} failed, retrying in {sleep_secs:.1f}s..."
                )
                await asyncio.sleep(sleep_secs)
        return [], last_error

    def build_chain(platform: str, query: str) -> list[tuple[str, Callable[[], Awaitable[list[Any]]], int]]:
        if platform == "twitter":
            return [("twitter", lambda: twitter.search(query, limit=5), default_timeout)]
        if platform == "linkedin":
            return [("linkedin", lambda: linkedin.search(query, limit=5), default_timeout)]
        if platform in ["news", "newsapi"]:
            chain = [
                ("newsapi", lambda: news.search(query, limit=5), default_timeout),
            ]
            if firecrawl.api_key:
                chain.append(("firecrawl", lambda: firecrawl.search(f"{query} latest news", limit=5), web_timeout))
            return chain
        if platform == "web":
            chain = [
                ("tabstack", lambda: tabstack.search(query, limit=5), web_timeout),
            ]
            if firecrawl.api_key:
                chain.append(("firecrawl", lambda: firecrawl.search(query, limit=5), web_timeout))
            if tinyfish.api_key:
                chain.append(("tinyfish", lambda: tinyfish.search(query, limit=5), tinyfish_timeout))
            return chain
        if platform == "tiktok":
            return [("tiktok", lambda: tiktok.search(query, limit=5), default_timeout)]
        if platform == "youtube":
            return [("youtube", lambda: youtube.search(query, limit=5), default_timeout)]
        if platform == "gdelt":
            return [("gdelt", lambda: gdelt.search(query, limit=5), default_timeout)]
        if platform == "wikimedia":
            return [("wikimedia", lambda: wikimedia.search(query, limit=5), default_timeout)]
        if platform in ["hackernews", "hn"]:
            return [("hackernews", lambda: hackernews.search(query, limit=5), default_timeout)]
        if platform in ["stackexchange", "se"]:
            return [("stackexchange", lambda: stackexchange.search(query, limit=5), default_timeout)]
        if platform == "coingecko":
            chain = [("coingecko", lambda: coingecko.search(query, limit=5), default_timeout)]
            if synthdata.api_key:
                chain.append(("synthdata", lambda: synthdata.search(query, limit=5), default_timeout))
            return chain
        if platform == "tinyfish":
            return [("tinyfish", lambda: tinyfish.search(query, limit=5), tinyfish_timeout)]
        if platform == "chainlink":
            return [("chainlink", lambda: chainlink.search(query, limit=1), default_timeout)]
        if platform == "firecrawl":
            return [("firecrawl", lambda: firecrawl.search(query, limit=5), default_timeout)]
        if platform == "synthdata":
            return [("synthdata", lambda: synthdata.search(query, limit=5), default_timeout)]
        return [("tabstack", lambda: tabstack.search(query, limit=5), default_timeout)]

    async def search_with_fallback(platform: str, query: str) -> dict[str, Any]:
        state["logs"].append(f"🤖 AGENT >> Establishing quantum link to {platform.upper()} for: '{query}'")
        chain = build_chain(platform, query)
        last_error: Optional[str] = None
        for idx, (label, runner, timeout_secs) in enumerate(chain):
            if idx > 0:
                state["logs"].append(
                    f"🛟 FALLBACK ROUTE: {platform.upper()} primary route yielded no signal. Trying {label.upper()}..."
                )
            items, err = await execute_connector(label, runner, timeout_secs)
            if items:
                return {
                    "requested_platform": platform,
                    "source": label,
                    "items": items,
                    "fallback_used": idx > 0,
                }
            last_error = err or last_error
        return {
            "requested_platform": platform,
            "source": chain[-1][0] if chain else None,
            "items": [],
            "fallback_used": False,
            "error": last_error,
        }

    for sq in state["search_queries"]:
        platform = sq["platform"]
        query = sq["query"]
        tasks.append(search_with_fallback(platform, query))

    if tasks:
        state["logs"].append(f"🔄 Gathering intelligence from {len(tasks)} sources simultaneously...")
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_items = []
        for result in results:
            if isinstance(result, Exception):
                state["logs"].append(f"❌ ERROR: Search job failed: {str(result)}")
                continue
            platform = str(result.get("requested_platform", "unknown")).upper()
            source = str(result.get("source", "")).upper() if result.get("source") else ""
            items = result.get("items") or []
            if not items:
                err = result.get("error")
                if err:
                    state["logs"].append(f"❌ ERROR: Platform {platform} failed: {err}")
                else:
                    state["logs"].append(f"⚠️  EMPTY: No data found on {platform}. This could be due to rate limits or narrow search.")
                continue
            if result.get("fallback_used"):
                state["logs"].append(
                    f"🛟 FALLBACK RECOVERY: {platform} recovered via {source}; harvested {len(items)} items."
                )
            else:
                state["logs"].append(f"✅ SUCCESS: Harvested {len(items)} items from {platform}")
            all_items.extend(items)
        
        if "raw_findings" not in state or not state["raw_findings"]:
            state["raw_findings"] = []

        existing_keys = {_finding_dedupe_key(item) for item in state["raw_findings"]}
        deduped_new_items = []
        dropped_duplicates = 0
        for item in all_items:
            key = _finding_dedupe_key(item)
            if key in existing_keys:
                dropped_duplicates += 1
                continue
            existing_keys.add(key)
            deduped_new_items.append(item)

        state["raw_findings"].extend(deduped_new_items)
        if all_items:
            state["logs"].append(
                f"📊 AGGREGATION COMPLETE: Total signals acquired: {len(all_items)}; added {len(deduped_new_items)} net-new. Commencing neural validation..."
            )
            if dropped_duplicates:
                state["logs"].append(
                    f"♻️ FINDING DEDUPE: Dropped {dropped_duplicates} duplicate signals across iterative passes."
                )
        else:
            state["logs"].append("🚨 CRITICAL: No data harvested from any source. Synthesis will be based on limited context.")

        min_findings_required = max(3, int(os.getenv("MIN_FINDINGS_PER_RUN", "8")))
        current_count = len(state["raw_findings"])
        if current_count < min_findings_required:
            state["logs"].append(
                f"🧱 QUALITY FLOOR: Captured {current_count}/{min_findings_required} findings. Running compulsory backfill routes..."
            )
            backfill_chain: list[tuple[str, Callable[[], Awaitable[list[Any]]], int]] = [
                ("newsapi_backfill", lambda: news.search(state["topic"], limit=6), default_timeout),
                ("tabstack_backfill", lambda: tabstack.search(state["topic"], limit=6), web_timeout),
                ("hackernews_backfill", lambda: hackernews.search(state["topic"], limit=6), default_timeout),
                ("stackexchange_backfill", lambda: stackexchange.search(state["topic"], limit=6), default_timeout),
            ]
            if firecrawl.api_key:
                backfill_chain.append(("firecrawl_backfill", lambda: firecrawl.search(state["topic"], limit=6), web_timeout))
            if coingecko.api_key:
                backfill_chain.append(("coingecko_backfill", lambda: coingecko.search(state["topic"], limit=4), default_timeout))

            for label, runner, timeout_secs in backfill_chain:
                if len(state["raw_findings"]) >= min_findings_required:
                    break
                items, err = await execute_connector(label, runner, timeout_secs)
                if not items:
                    if err:
                        state["logs"].append(f"⚠️ BACKFILL MISS: {label} failed: {err}")
                    continue
                added = 0
                for item in items:
                    key = _finding_dedupe_key(item)
                    if key in existing_keys:
                        continue
                    existing_keys.add(key)
                    state["raw_findings"].append(item)
                    added += 1
                if added > 0:
                    state["logs"].append(
                        f"✅ BACKFILL SUCCESS: {label} added {added} new findings ({len(state['raw_findings'])}/{min_findings_required})."
                    )

            if len(state["raw_findings"]) < min_findings_required:
                state["logs"].append(
                    f"⚠️ QUALITY FLOOR NOT MET: Run completed with {len(state['raw_findings'])} findings after backfill."
                )
            else:
                state["logs"].append(
                    f"🎯 QUALITY FLOOR MET: Run reached {len(state['raw_findings'])} findings before validation."
                )
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

    validation_limit = max(12, int(os.getenv("VALIDATOR_CONTEXT_MAX_FINDINGS", "40")))
    findings_for_validation = _select_validator_sample(
        state["raw_findings"], limit=validation_limit
    )
    if len(findings_for_validation) < len(state["raw_findings"]):
        state["logs"].append(
            f"🧮 VALIDATOR WINDOW: Evaluating {len(findings_for_validation)}/{len(state['raw_findings'])} findings (diverse recency sample)."
        )

    # Construct context for validation
    findings_context = "\n".join(
        [f"SOURCE [{f.platform}] @{f.author}: {f.content[:200]}" for f in findings_for_validation]
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
            findings_for_validation[i] for i in valid_indices if i < len(findings_for_validation)
        ]
        if not state["filtered_findings"]:
            # Graceful fallback to avoid empty synthesis due to indexing/schema drift.
            state["filtered_findings"] = findings_for_validation[: min(10, len(findings_for_validation))]
        state["logs"].append(
            f"✅ VERIFICATION COMPLETE: Confidence level: {state['confidence_score']:.2f}. Curated {len(state['filtered_findings'])} high-quality insights."
        )
        
        # Decide if we need follow-up research
        if state["confidence_score"] < 0.7 and state["current_depth"] < state.get("max_depth", 1):
            state["follow_up_directions"] = await _generate_follow_up_directions(
                state["topic"],
                state.get("validation_results", []),
                state["filtered_findings"] or findings_for_validation,
            )
            state["logs"].append(f"🔁 SIGNAL GAP DETECTED: Intelligence confidence is low. Triggering autonomous follow-up research...")
        else:
            state["follow_up_directions"] = []
            
    except Exception as e:
        state["logs"].append(f"⚠️  VALIDATION ERROR: Parsing failed: {e}. Using all raw findings as fallback.")
        state["filtered_findings"] = state["raw_findings"]
        state["confidence_score"] = 0.5
        state["follow_up_directions"] = []

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
        10,
        int(os.getenv("ENRICH_PER_SOURCE_TIMEOUT_SECS", "75")),
    )
    enrich_total_budget = max(
        enrich_per_source_timeout,
        int(os.getenv("ENRICH_TOTAL_BUDGET_SECS", "240")),
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

    def should_continue_research(state: GraphState):
        if state.get("follow_up_directions") and state.get("current_depth", 0) < state.get("max_depth", 1):
            return "planner"
        return "analyzer"

    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "researcher")
    workflow.add_edge("researcher", "validator")
    workflow.add_conditional_edges(
        "validator",
        should_continue_research,
        {
            "planner": "planner",
            "analyzer": "analyzer"
        }
    )
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
        "current_depth": 0,
        "max_depth": 2 if "tinyfish" in (platforms or []) or "web" in (platforms or []) else 1,
        "follow_up_directions": [],
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
        "current_depth": 0,
        "max_depth": 1,
        "follow_up_directions": [],
        "error": None,
    }
    
    final_state = initial_state
    async for output in workflow.astream(initial_state):
        for _, state_update in output.items():
            final_state.update(state_update)
            
    return final_state
