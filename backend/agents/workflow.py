import asyncio
import json
import datetime
import os
import uuid
import re
from typing import Any, Awaitable, Callable, Optional

from langgraph.graph import END, StateGraph

from backend.agents.state import GraphState
from backend.database.vector_store import vector_store
from backend.integrations.connectors.twitter import TwitterConnector
from backend.services.ai_service import ai_service
from backend.agents.nodes.financial_intelligence import (
    financial_intelligence_node,
    enhance_consensus_with_financial_data,
)
from shared.models import QueryStatus

DEFAULT_AUGMENTATION = {
    "firecrawl": "auto",
    "synthdata": "auto",
}


def _resolve_augmentation(state: GraphState) -> dict[str, str]:
    raw = state.get("augmentation") or {}
    resolved = DEFAULT_AUGMENTATION.copy()
    for key in ("firecrawl", "synthdata"):
        value = str(raw.get(key, resolved[key])).strip().lower()
        resolved[key] = value if value in {"auto", "on", "off"} else resolved[key]
    return resolved


def _resolve_augmentation_from_input(raw: dict[str, Any] | None) -> dict[str, str]:
    resolved = DEFAULT_AUGMENTATION.copy()
    raw = raw or {}
    for key in ("firecrawl", "synthdata"):
        value = str(raw.get(key, resolved[key])).strip().lower()
        resolved[key] = value if value in {"auto", "on", "off"} else resolved[key]
    return resolved


def _augmentation_enabled(mode: str, has_key: bool) -> bool:
    if mode == "off":
        return False
    if mode == "on":
        return has_key
    return has_key


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


_PLACEHOLDER_PATTERNS = (
    "unknown news",
    "web source",
    "collected 1 web sources for this query",
    "task failed:",
    "duckduckgo",
)
_STOPWORDS = {
    "the", "and", "or", "with", "what", "when", "where", "which", "that", "this", "from", "into",
    "about", "over", "under", "across", "at", "is", "are", "was", "were", "be", "to", "of", "for", "in",
}
_HISTORICAL_HINTS = {"history", "historical", "timeline", "since", "from", "between", "in 20", "201", "2020", "2021", "2022", "2023"}


def _topic_wants_historical(topic: str) -> bool:
    t = _normalize_text(topic)
    if any(h in t for h in _HISTORICAL_HINTS):
        return True
    # Explicit year mention implies historical intent.
    return bool(re.search(r"\b(19|20)\d{2}\b", topic or ""))


def _extract_topic_keywords(topic: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9_+-]{3,}", (topic or "").lower())
    return {t for t in tokens if t not in _STOPWORDS}


def _is_placeholder_item(item: Any) -> bool:
    title = _normalize_text(str(getattr(item, "title", "") or ""))
    content = _normalize_text(str(getattr(item, "content", "") or ""))
    combined = f"{title} {content}"
    return any(pattern in combined for pattern in _PLACEHOLDER_PATTERNS)


def _is_stale_for_topic(item: Any, topic: str, now_ts: float) -> bool:
    if _topic_wants_historical(topic):
        return False
    ts = _timestamp_rank(item)
    if ts <= 0:
        return False
    age_days = (now_ts - ts) / 86400
    return age_days > float(os.getenv("FINDING_MAX_AGE_DAYS", "540"))


def _keyword_overlap_ratio(item: Any, topic_keywords: set[str]) -> float:
    if not topic_keywords:
        return 1.0
    text = " ".join(
        [
            str(getattr(item, "title", "") or ""),
            str(getattr(item, "content", "") or ""),
            str(getattr(item, "author", "") or ""),
            str(getattr(item, "platform", "") or ""),
        ]
    ).lower()
    item_tokens = set(re.findall(r"[a-zA-Z0-9_+-]{3,}", text))
    if not item_tokens:
        return 0.0
    overlap = len(topic_keywords.intersection(item_tokens))
    return overlap / max(1, min(6, len(topic_keywords)))


def _apply_finding_quality_filters(findings: list[Any], topic: str) -> tuple[list[Any], dict[str, int]]:
    now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
    topic_keywords = _extract_topic_keywords(topic)
    min_overlap = float(os.getenv("FINDING_MIN_TOPIC_OVERLAP", "0.12"))
    stats = {"placeholder": 0, "stale": 0, "off_topic": 0}
    kept: list[Any] = []
    for item in findings:
        if _is_placeholder_item(item):
            stats["placeholder"] += 1
            continue
        if _is_stale_for_topic(item, topic, now_ts):
            stats["stale"] += 1
            continue
        if _keyword_overlap_ratio(item, topic_keywords) < min_overlap:
            stats["off_topic"] += 1
            continue
        kept.append(item)
    return kept, stats


def _count_platform_diversity(findings: list[Any]) -> int:
    platforms = {
        _normalize_text(str(getattr(item, "platform", "") or "unknown"))
        for item in findings
        if item is not None
    }
    return len({p for p in platforms if p})


def _platform_counts(findings: list[Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in findings:
        platform = _normalize_text(str(getattr(item, "platform", "") or "unknown"))
        if not platform:
            continue
        counts[platform] = counts.get(platform, 0) + 1
    return counts


def _coverage_status_counts(report_md: str) -> dict[str, int]:
    lowered = (report_md or "").lower()
    lines = [line.strip().lower() for line in (report_md or "").splitlines() if line.strip()]
    dimension_tokens = {
        "skills": ("emergent agent skills", "agent skills"),
        "protocols": ("agent commerce protocols", "commerce protocols", "protocols"),
        "primitives": ("primitives",),
        "workflows": ("agentic workflows", "workflows"),
    }
    counts = {"full": 0, "partial": 0, "missing": 0}

    for _, tokens in dimension_tokens.items():
        status = "missing"
        candidate_line = ""
        for line in lines:
            if any(token in line for token in tokens):
                candidate_line = line
                break

        # Fallback: search globally in report text if dimension is mentioned outside a row.
        if not candidate_line and any(token in lowered for token in tokens):
            candidate_line = lowered

        if candidate_line:
            if "missing" in candidate_line:
                status = "missing"
            elif "partial" in candidate_line:
                status = "partial"
            elif "full" in candidate_line:
                status = "full"
            else:
                # Mentioned without explicit status = partial confidence.
                status = "partial"

        counts[status] += 1
    return counts


def _evaluate_quality_gate(state: GraphState, report_md: str) -> dict[str, Any]:
    findings = state.get("raw_findings") or []
    consensus = state.get("consensus_data") or {}
    provider_errors = consensus.get("provider_errors") or []
    coverage = _coverage_status_counts(report_md)

    min_sources = max(4, int(os.getenv("QUALITY_MIN_SOURCES", "8")))
    min_platforms = max(2, int(os.getenv("QUALITY_MIN_PLATFORMS", "3")))
    min_models = max(2, int(os.getenv("QUALITY_MIN_MODELS", "4")))
    min_agreement = max(0.3, float(os.getenv("QUALITY_MIN_AGREEMENT", "0.60")))
    target_score = max(0.5, float(os.getenv("QUALITY_TARGET_SCORE", "0.80")))

    source_count = len(findings)
    platform_count = _count_platform_diversity(findings)
    model_count = len(consensus.get("providers") or [])
    agreement = float(consensus.get("agreement_score", 0.0) or 0.0)
    missing_coverage = int(coverage.get("missing", 0))
    partial_coverage = int(coverage.get("partial", 0))

    source_score = min(1.0, source_count / max(1, min_sources))
    platform_score = min(1.0, platform_count / max(1, min_platforms))
    model_score = min(1.0, model_count / max(1, min_models))
    agreement_score = min(1.0, agreement / max(0.01, min_agreement))
    coverage_penalty = min(1.0, (missing_coverage * 0.5) + (partial_coverage * 0.2))
    coverage_score = max(0.0, 1.0 - coverage_penalty)

    quality_score = (
        (source_score * 0.25)
        + (platform_score * 0.20)
        + (model_score * 0.20)
        + (agreement_score * 0.20)
        + (coverage_score * 0.15)
    )

    checks = {
        "sources": source_count >= min_sources,
        "platforms": platform_count >= min_platforms,
        "models": model_count >= min_models,
        "agreement": agreement >= min_agreement,
        "coverage_missing": missing_coverage == 0,
    }
    passed = all(checks.values()) and quality_score >= target_score

    return {
        "passed": passed,
        "score": round(quality_score, 3),
        "target": round(target_score, 3),
        "checks": checks,
        "metrics": {
            "source_count": source_count,
            "platform_count": platform_count,
            "model_count": model_count,
            "agreement_score": round(agreement, 3),
            "missing_coverage": missing_coverage,
            "partial_coverage": partial_coverage,
            "provider_errors": len(provider_errors),
        },
        "thresholds": {
            "min_sources": min_sources,
            "min_platforms": min_platforms,
            "min_models": min_models,
            "min_agreement": min_agreement,
        },
    }


def _build_quality_follow_up_directions(state: GraphState, quality: dict[str, Any]) -> list[str]:
    checks = quality.get("checks", {})
    metrics = quality.get("metrics", {})
    directions: list[str] = []

    if not checks.get("sources", True):
        directions.append(
            "Collect at least 4 fresh, source-backed findings focused on concrete entities, not opinion summaries."
        )
    if not checks.get("platforms", True):
        directions.append(
            "Expand to additional platforms and gather at least one corroborating signal per platform."
        )
    if not checks.get("models", True):
        directions.append(
            "Run a broader consensus pass using more model routes and capture provider-level disagreements."
        )
    if not checks.get("agreement", True):
        directions.append(
            "Resolve conflicting claims with explicit source-level evidence and quote-level specifics."
        )
    if not checks.get("coverage_missing", True):
        directions.append(
            "Fill missing Coverage Matrix dimensions with explicit full/partial/missing labels and evidence_count."
        )

    if not directions:
        directions.append(
            "Increase specificity: include named examples, quantitative datapoints, and explicit uncertainty bounds."
        )

    # Include one deterministic reminder with current metric snapshot for planner context.
    directions.append(
        "Current quality snapshot: "
        f"sources={metrics.get('source_count', 0)}, "
        f"platforms={metrics.get('platform_count', 0)}, "
        f"models={metrics.get('model_count', 0)}, "
        f"agreement={metrics.get('agreement_score', 0.0)}."
    )
    return directions[:4]


def _build_retry_platform_targets(state: GraphState, quality: dict[str, Any]) -> list[str]:
    requested = [_normalize_text(p) for p in (state.get("platforms") or []) if p]
    counts = _platform_counts(state.get("raw_findings") or [])
    checks = quality.get("checks", {})
    targets: list[str] = []

    # Primary strategy: fill missing requested platform coverage first.
    if not checks.get("platforms", True):
        missing = [p for p in requested if counts.get(p, 0) == 0]
        targets.extend(missing)

    # If source breadth is weak, prioritize lowest-yield requested platforms.
    if not checks.get("sources", True):
        ranked = sorted(requested, key=lambda p: counts.get(p, 0))
        for p in ranked[:2]:
            if p not in targets:
                targets.append(p)

    # Coverage gaps often improve with broader web/news evidence.
    if not checks.get("coverage_missing", True):
        for p in ["web", "newsapi", "hackernews", "stackexchange", "coingecko", "tinyfish", "synthdata"]:
            if p in requested and p not in targets:
                targets.append(p)

    if not targets:
        ranked = sorted(requested, key=lambda p: counts.get(p, 0))
        targets.extend(ranked[:2])

    # Keep retries focused to control spend/latency.
    max_targets = max(1, int(os.getenv("QUALITY_RETRY_MAX_PLATFORMS", "3")))
    return targets[:max_targets]


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
    retry_targets = [normalize_platform(p) for p in (state.get("retry_platforms") or [])]
    retry_mode = len(retry_targets) > 0
    planner_targets = [p for p in requested if (not retry_mode or p in set(retry_targets))]
    planner_target_set = set(planner_targets)

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
            if retry_mode and platform not in planner_target_set:
                continue
            if retry_mode and state.get("follow_up_directions"):
                focus_hint = " ".join(state["follow_up_directions"][:1])[:120]
                if focus_hint and focus_hint.lower() not in query.lower():
                    query = f"{query} {focus_hint}".strip()
            cleaned_queries.append({"platform": platform, "query": query})

        # Guarantee coverage for every planner target platform.
        covered = {sq["platform"] for sq in cleaned_queries}
        for platform in planner_targets:
            if platform not in covered:
                fallback_query = state["topic"]
                if retry_mode and state.get("follow_up_directions"):
                    fallback_query = f"{fallback_query} {state['follow_up_directions'][0][:120]}".strip()
                cleaned_queries.append({"platform": platform, "query": fallback_query})

        state["search_queries"] = cleaned_queries
        if retry_mode:
            state["logs"].append(
                f"🎯 SMART RETRY PLAN: focusing on platforms [{', '.join(planner_targets)}] to close quality gaps."
            )
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
        fallback_platforms = planner_targets if retry_mode else [normalize_platform(p) for p in state["platforms"]]
        state["search_queries"] = [{"platform": p, "query": state["topic"]} for p in fallback_platforms]
        state["current_depth"] = depth + 1

    return state


async def researcher_node(state: GraphState) -> GraphState:
    state["status"] = QueryStatus.RESEARCHING
    deduped_queries: list[dict[str, str]] = []
    seen = set()
    attempted = set(state.get("attempted_query_keys") or [])
    skipped_attempted = 0
    for sq in state["search_queries"]:
        platform = (sq.get("platform") or "").strip().lower()
        query = (sq.get("query") or "").strip()
        key = (platform, query.lower())
        if not platform or not query or key in seen:
            continue
        key_str = f"{platform}::{query.lower()}"
        if key_str in attempted:
            skipped_attempted += 1
            continue
        seen.add(key)
        deduped_queries.append({"platform": platform, "query": query})
        attempted.add(key_str)
    if len(deduped_queries) != len(state["search_queries"]):
        state["logs"].append(
            f"♻️ REQUEST DEDUPE: Collapsed {len(state['search_queries']) - len(deduped_queries)} duplicate platform-query jobs."
        )
    if skipped_attempted:
        state["logs"].append(
            f"💸 API SAVINGS: Skipped {skipped_attempted} previously attempted connector queries in this run."
        )
    state["search_queries"] = deduped_queries
    state["attempted_query_keys"] = sorted(attempted)

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
    from backend.integrations.connectors.serpapi import SerpApiConnector

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
    serpapi = SerpApiConnector()
    augmentation = _resolve_augmentation(state)
    firecrawl_enabled = _augmentation_enabled(augmentation.get("firecrawl", "auto"), bool(firecrawl.api_key))
    synthdata_enabled = _augmentation_enabled(augmentation.get("synthdata", "auto"), bool(synthdata.api_key))
    state["augmentation"] = augmentation
    if augmentation.get("firecrawl") == "on" and not firecrawl.api_key:
        state["logs"].append("⚠️ AUGMENTATION NOTICE: Firecrawl set to ON but API key is unavailable.")
    if augmentation.get("synthdata") == "on" and not synthdata.api_key:
        state["logs"].append("⚠️ AUGMENTATION NOTICE: SynthData set to ON but API key is unavailable.")
    if os.getenv("SERPAPI_API_KEY") and not serpapi.api_key:
        state["logs"].append("⚠️ AUGMENTATION NOTICE: SerpApi key expected but unavailable.")

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
            if firecrawl_enabled:
                chain.append(("firecrawl", lambda: firecrawl.search(f"{query} latest news", limit=5), web_timeout))
            return chain
        if platform == "web":
            chain = []
            if serpapi.api_key:
                chain.append(("serpapi", lambda: serpapi.search(query, limit=6), default_timeout))
            chain.append(("tabstack", lambda: tabstack.search(query, limit=5), web_timeout))
            if firecrawl_enabled:
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
            if synthdata_enabled:
                chain.append(("synthdata", lambda: synthdata.search(query, limit=5), default_timeout))
            return chain
        if platform == "tinyfish":
            return [("tinyfish", lambda: tinyfish.search(query, limit=5), tinyfish_timeout)]
        if platform == "chainlink":
            return [("chainlink", lambda: chainlink.search(query, limit=1), default_timeout)]
        if platform == "firecrawl":
            return [("firecrawl", lambda: firecrawl.search(query, limit=5), default_timeout)]
        if platform == "synthdata":
            if synthdata_enabled:
                return [("synthdata", lambda: synthdata.search(query, limit=5), default_timeout)]
            return []
        return [("tabstack", lambda: tabstack.search(query, limit=5), default_timeout)]

    async def search_with_fallback(platform: str, query: str) -> dict[str, Any]:
        state["logs"].append(f"🤖 AGENT >> Establishing quantum link to {platform.upper()} for: '{query}'")
        chain = build_chain(platform, query)
        if not chain:
            return {
                "requested_platform": platform,
                "source": None,
                "items": [],
                "fallback_used": False,
                "error": f"{platform} route disabled by augmentation settings",
            }
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
        route_records: list[dict[str, Any]] = state.get("source_routes") or []
        for result in results:
            if isinstance(result, Exception):
                state["logs"].append(f"❌ ERROR: Search job failed: {str(result)}")
                continue
            platform = str(result.get("requested_platform", "unknown")).upper()
            source = str(result.get("source", "")).upper() if result.get("source") else ""
            items = result.get("items") or []
            route_records.append(
                {
                    "requested_platform": str(result.get("requested_platform", "unknown")),
                    "resolved_source": str(result.get("source") or ""),
                    "fallback_used": bool(result.get("fallback_used")),
                    "item_count": len(items),
                    "status": "ok" if items else "empty",
                    "error": result.get("error"),
                }
            )
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
        filtered_initial, initial_filter_stats = _apply_finding_quality_filters(
            state["raw_findings"], state["topic"]
        )
        if len(filtered_initial) != len(state["raw_findings"]):
            state["logs"].append(
                "🧹 QUALITY FILTER: "
                f"dropped {len(state['raw_findings']) - len(filtered_initial)} findings "
                f"(placeholder={initial_filter_stats['placeholder']}, "
                f"stale={initial_filter_stats['stale']}, off_topic={initial_filter_stats['off_topic']})."
            )
            state["raw_findings"] = filtered_initial
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

        min_findings_required = max(4, int(os.getenv("MIN_FINDINGS_PER_RUN", "10")))
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
                    route_records.append(
                        {
                            "requested_platform": "backfill",
                            "resolved_source": label,
                            "fallback_used": False,
                            "item_count": 0,
                            "status": "error",
                            "error": err,
                        }
                    )
                    continue
                kept_items, backfill_filter_stats = _apply_finding_quality_filters(items, state["topic"])
                added = 0
                for item in kept_items:
                    key = _finding_dedupe_key(item)
                    if key in existing_keys:
                        continue
                    existing_keys.add(key)
                    state["raw_findings"].append(item)
                    added += 1
                dropped_backfill = len(items) - len(kept_items)
                if added > 0:
                    state["logs"].append(
                        f"✅ BACKFILL SUCCESS: {label} added {added} new findings ({len(state['raw_findings'])}/{min_findings_required})."
                    )
                if dropped_backfill > 0:
                    state["logs"].append(
                        f"🧹 BACKFILL FILTER: {label} dropped {dropped_backfill} low-quality items "
                        f"(placeholder={backfill_filter_stats['placeholder']}, stale={backfill_filter_stats['stale']}, "
                        f"off_topic={backfill_filter_stats['off_topic']})."
                    )
                route_records.append(
                    {
                        "requested_platform": "backfill",
                        "resolved_source": label,
                        "fallback_used": False,
                        "item_count": len(kept_items),
                        "status": "ok" if kept_items else "empty",
                        "error": None,
                    }
                )

            if len(state["raw_findings"]) < min_findings_required:
                state["logs"].append(
                    f"⚠️ QUALITY FLOOR NOT MET: Run completed with {len(state['raw_findings'])} findings after backfill."
                )
            else:
                state["logs"].append(
                    f"🎯 QUALITY FLOOR MET: Run reached {len(state['raw_findings'])} findings before validation."
                )
        state["source_routes"] = route_records[-80:]
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
        8,
        int(os.getenv("ENRICH_PER_SOURCE_TIMEOUT_SECS", "35")),
    )
    enrich_total_budget = max(
        enrich_per_source_timeout,
        int(os.getenv("ENRICH_TOTAL_BUDGET_SECS", "90")),
    )
    max_enrich_items = max(0, int(os.getenv("ENRICH_MAX_ITEMS", "1")))
    if "tinyfish" in (state.get("platforms") or []):
        # Allow slightly deeper enrichment when TinyFish is explicitly selected.
        max_enrich_items = max(max_enrich_items, 2)
    if os.getenv("DISABLE_ANALYZER_ENRICH", "0") == "1":
        max_enrich_items = 0
    enrich_started_at = datetime.datetime.now(datetime.timezone.utc)
    # Sort by metrics (e.g. likes/retweets) or just take first few
    to_enrich = [f for f in findings_to_use if f.url and len(f.content) < 500][:max_enrich_items]

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
    - A strict Coverage Matrix answering these dimensions explicitly:
      1) emergent agent skills
      2) agent commerce protocols
      3) primitives
      4) agentic workflows
      For each dimension include: coverage (full/partial/missing), evidence_count, and concrete examples.
      If evidence is weak, mark PARTIAL or MISSING rather than inferring.

    Output format:
    # Trend Report: {state["topic"]}
    ## Coverage Matrix
    | Dimension | Coverage | Evidence Count | Concrete Examples |
    | ... |
    ... (Markdown Content) ...
    """

    # Use Consensus Engine with user-selected models
    state["logs"].append(f"🤝 CONSOLIDATING WISDOM: Consulting {len(models)} AI oracles for consensus...")
    consensus_bundle = await ai_service.get_consensus_bundle(
        prompt,
        system_prompt="You are a professional, neutral trend analyst.",
        providers=state.get("models"),
    )
    
    # Enhance consensus with financial intelligence if available
    if state.get("financial_intelligence"):
        state["logs"].append("📊 INTEGRATING: Adding probabilistic financial forecasts to consensus...")
        consensus_bundle = await enhance_consensus_with_financial_data(state, consensus_bundle)
    report = str(consensus_bundle.get("consensus_report", ""))
    state["final_report_md"] = report
    # Keep full summary text to avoid clipped UI/report exports.
    state["summary"] = report if report else "No report generated."
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

    quality = _evaluate_quality_gate(state, report)
    state["quality_assessment"] = quality
    state["logs"].append(
        "🧪 QUALITY GATE: "
        f"score={quality['score']:.2f}/{quality['target']:.2f} "
        f"(sources={quality['metrics']['source_count']}, "
        f"platforms={quality['metrics']['platform_count']}, "
        f"models={quality['metrics']['model_count']}, "
        f"agreement={quality['metrics']['agreement_score']:.2f}, "
        f"missing_coverage={quality['metrics']['missing_coverage']})."
    )

    if (not quality.get("passed", False)) and state.get("current_depth", 0) < state.get("max_depth", 1):
        retry_targets = _build_retry_platform_targets(state, quality)
        state["retry_platforms"] = retry_targets
        state["follow_up_directions"] = _build_quality_follow_up_directions(state, quality)
        state["logs"].append(
            "🔁 QUALITY RETRY: Gate not met. Triggering focused refinement pass "
            f"on [{', '.join(retry_targets)}] before finalization."
        )
        # Keep run in progress; graph edge will loop back to planner.
        state["status"] = QueryStatus.PROCESSING
        return state
    state["follow_up_directions"] = []
    state["retry_platforms"] = []
    if not quality.get("passed", False):
        state["logs"].append(
            "⚠️ QUALITY EXCEPTION: Max research depth reached; finalizing below target quality threshold."
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
    workflow.add_node("financial_intelligence", financial_intelligence_node)
    workflow.add_node("analyzer", analyzer_node)
    workflow.add_node("architect", architect_node)

    def should_continue_research(state: GraphState):
        if state.get("follow_up_directions") and state.get("current_depth", 0) < state.get("max_depth", 1):
            return "planner"
        return "analyzer"

    def should_finalize_after_analyzer(state: GraphState):
        if state.get("follow_up_directions") and state.get("current_depth", 0) < state.get("max_depth", 1):
            return "planner"
        return "architect"

    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "researcher")
    workflow.add_edge("researcher", "validator")
    workflow.add_edge("validator", "financial_intelligence")
    workflow.add_conditional_edges(
        "financial_intelligence",
        should_continue_research,
        {
            "planner": "planner",
            "analyzer": "analyzer"
        }
    )
    workflow.add_conditional_edges(
        "analyzer",
        should_finalize_after_analyzer,
        {
            "planner": "planner",
            "architect": "architect",
        },
    )
    workflow.add_edge("architect", END)

    return workflow.compile()


async def run_trend_analysis(
    idea: str, 
    platforms: list[str], 
    task_id: str, 
    models: list[str] = None,
    sponsor: str = None,
    augmentation: dict[str, str] | None = None,
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
        "quality_assessment": None,
        "retry_platforms": [],
        "attempted_query_keys": [],
        "augmentation": _resolve_augmentation_from_input(augmentation),
        "source_routes": [],
        "financial_intelligence": None,
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
        "quality_assessment": None,
        "retry_platforms": [],
        "attempted_query_keys": [],
        "augmentation": {},
        "source_routes": [],
        "financial_intelligence": None,
        "error": None,
    }
    
    final_state = initial_state
    async for output in workflow.astream(initial_state):
        for _, state_update in output.items():
            final_state.update(state_update)
            
    return final_state
