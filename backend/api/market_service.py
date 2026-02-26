"""
Market analysis and prediction market integration service.

This module provides functionality for fetching and scoring prediction markets
from Polymarket and Kalshi, as well as extracting related markets from research.
"""

import asyncio
import datetime
import math
import os
from typing import Any
from urllib.parse import quote_plus

import httpx

from backend.api.helpers import (
    env_flag,
    has_market_intent,
    normalize_probability,
    parse_market_dt,
    tokenize_market_text,
)


async def fetch_polymarket_markets(topic: str, limit: int = 8) -> list[dict[str, Any]]:
    """Fetch active markets from Polymarket API."""
    query = quote_plus(topic[:120])
    endpoints = [
        f"https://gamma-api.polymarket.com/markets?limit={max(limit, 8)}&closed=false&active=true&search={query}",
        f"https://gamma-api.polymarket.com/events?limit={max(limit, 8)}&closed=false&search={query}",
    ]
    markets: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=8.0) as client:
        for endpoint in endpoints:
            try:
                response = await client.get(endpoint)
                if response.status_code != 200:
                    continue
                payload = response.json()
                rows = payload if isinstance(payload, list) else payload.get("data", [])
                if not isinstance(rows, list):
                    continue
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    slug = row.get("slug") or row.get("market_slug")
                    url = row.get("url") or (f"https://polymarket.com/event/{slug}" if slug else "")
                    if not url:
                        continue
                    markets.append(
                        {
                            "provider": "polymarket",
                            "title": str(row.get("question") or row.get("title") or row.get("name") or "Polymarket market"),
                            "description": str(row.get("description") or ""),
                            "url": str(url),
                            "probability": row.get("probability") or row.get("yes_price"),
                            "volume": row.get("volume") or row.get("liquidity"),
                            "endDate": row.get("endDate") or row.get("end_date") or row.get("close_time"),
                            "createdAt": row.get("createdAt") or row.get("created_at"),
                            "relevanceReason": "Matched from Polymarket listings",
                        }
                    )
            except Exception:
                continue
    return markets[:limit]


async def fetch_kalshi_markets(topic: str, limit: int = 8) -> list[dict[str, Any]]:
    """Fetch active markets from Kalshi API."""
    query = quote_plus(topic[:120])
    candidates = [
        f"https://trading-api.kalshi.com/trade-api/v2/markets?limit={max(limit, 8)}&status=open&search={query}",
        f"https://api.elections.kalshi.com/trade-api/v2/markets?limit={max(limit, 8)}&status=open&search={query}",
    ]
    headers: dict[str, str] = {}
    if os.getenv("KALSHI_API_KEY"):
        headers["KALSHI-ACCESS-KEY"] = os.getenv("KALSHI_API_KEY", "")
    markets: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=8.0, headers=headers or None) as client:
        for endpoint in candidates:
            try:
                response = await client.get(endpoint)
                if response.status_code != 200:
                    continue
                payload = response.json()
                rows = payload.get("markets") if isinstance(payload, dict) else payload
                if not isinstance(rows, list):
                    continue
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    ticker = row.get("ticker") or row.get("id")
                    if not ticker:
                        continue
                    url = row.get("url") or f"https://kalshi.com/markets/{ticker}"
                    markets.append(
                        {
                            "provider": "kalshi",
                            "title": str(row.get("title") or row.get("question") or ticker),
                            "description": str(row.get("subtitle") or row.get("description") or ""),
                            "url": str(url),
                            "probability": row.get("yes_price") or row.get("last_price"),
                            "volume": row.get("volume") or row.get("open_interest"),
                            "endDate": row.get("close_time") or row.get("expiration_time"),
                            "createdAt": row.get("open_time") or row.get("created_time"),
                            "relevanceReason": "Matched from Kalshi listings",
                        }
                    )
            except Exception:
                continue
    return markets[:limit]


def score_market_fit(
    *,
    market: dict[str, Any],
    topic: str,
    topic_tokens: set[str],
    evidence_tokens: set[str],
    now: datetime.datetime,
    confidence_score: float,
) -> dict[str, Any]:
    """Score how well a prediction market fits the research topic."""
    text_blob = f"{market.get('title', '')} {market.get('description', '')}".lower()
    market_tokens = tokenize_market_text(text_blob)

    semantic_hits = len(topic_tokens & market_tokens)
    evidence_hits = len(evidence_tokens & market_tokens)
    semantic_overlap = semantic_hits / max(len(topic_tokens), 1)
    evidence_overlap = evidence_hits / max(len(evidence_tokens), 1)

    volume = market.get("volume")
    try:
        volume_f = float(volume) if volume is not None else 0.0
    except Exception:
        volume_f = 0.0
    liquidity_score = max(0.0, min(1.0, math.log10(max(volume_f, 1.0)) / 6.0))

    end_dt = parse_market_dt(market.get("endDate"))
    horizon_score = 0.4
    days_to_resolution = None
    if end_dt:
        days_to_resolution = max(0.0, (end_dt - now).total_seconds() / 86400.0)
        if 1 <= days_to_resolution <= 30:
            horizon_score = 1.0
        elif days_to_resolution <= 90:
            horizon_score = 0.75
        else:
            horizon_score = 0.45

    freshness_score = 0.6
    created_dt = parse_market_dt(market.get("createdAt"))
    if created_dt:
        age_days = max(0.0, (now - created_dt).total_seconds() / 86400.0)
        freshness_score = 1.0 if age_days <= 2 else (0.75 if age_days <= 14 else 0.5)

    fit_score = (
        semantic_overlap * 0.33
        + evidence_overlap * 0.25
        + liquidity_score * 0.20
        + horizon_score * 0.12
        + freshness_score * 0.10
    )
    fit_percent = round(max(0.0, min(1.0, fit_score)) * 100)
    if fit_percent >= 72:
        fit_label = "high"
    elif fit_percent >= 50:
        fit_label = "medium"
    else:
        fit_label = "weak"

    probability = normalize_probability(market.get("probability"))
    conviction_prob = max(0.0, min(1.0, confidence_score))
    edge_delta = None
    if probability is not None:
        edge_delta = round((conviction_prob - probability) * 100, 2)

    disconfirmers: list[str] = []
    if fit_label == "weak":
        disconfirmers.append("Low semantic/evidence overlap to query.")
    if liquidity_score < 0.25:
        disconfirmers.append("Low liquidity can reduce tradability.")
    if days_to_resolution is not None and days_to_resolution > 120:
        disconfirmers.append("Long horizon may not match near-term thesis.")

    return {
        "fitScore": fit_percent,
        "fitLabel": fit_label,
        "semanticHits": semantic_hits,
        "evidenceHits": evidence_hits,
        "semanticOverlap": round(semantic_overlap, 3),
        "evidenceOverlap": round(evidence_overlap, 3),
        "liquidityScore": round(liquidity_score * 100),
        "daysToResolution": round(days_to_resolution, 1) if days_to_resolution is not None else None,
        "impliedProbability": probability,
        "convictionProbability": round(conviction_prob, 3),
        "edgeDelta": edge_delta,
        "disconfirmers": disconfirmers[:3],
    }


async def extract_related_prediction_markets(
    *,
    topic: str,
    financial_intelligence: dict[str, Any] | None,
    top_trends: list[dict[str, Any]],
    confidence_score: float,
    agreement_score: float,
    findings_count: int,
    data_sufficiency: str,
    limit: int = 5,
) -> dict[str, Any]:
    """
    Extract and score prediction markets related to the research topic.
    
    Returns enriched market data with fit scores and gating information.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    topic_tokens = tokenize_market_text(topic)
    evidence_tokens = set()
    for trend in top_trends[:6]:
        if not isinstance(trend, dict):
            continue
        evidence_tokens |= tokenize_market_text(str(trend.get("title") or ""))

    related: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    suppression_reasons: list[str] = []
    has_market_evidence = any(
        isinstance(trend, dict)
        and "url" in trend
        and isinstance(trend.get("url"), str)
        and ("polymarket.com" in trend.get("url", "").lower() or "kalshi.com" in trend.get("url", "").lower())
        for trend in top_trends
    )
    include_market_fallback = env_flag("MARKET_INCLUDE_SEARCH_FALLBACK", "false")
    market_intent_required = env_flag("MARKET_INTENT_REQUIRED", "true")
    if market_intent_required and not has_market_intent(topic_tokens) and not has_market_evidence:
        return {
            "markets": [],
            "gating": {
                "actionable": False,
                "dataSufficiency": data_sufficiency,
                "findingsCount": findings_count,
                "agreementScore": round(agreement_score, 3),
                "minFitScore": int(os.getenv("MARKET_MIN_FIT_SCORE", "55")),
            },
            "suppressionReasons": ["market_intent_gate:not_applicable_to_topic"],
        }

    def append_market(item: dict[str, Any]) -> None:
        normalized_url = str(item.get("url") or "").strip()
        if not normalized_url or normalized_url in seen_urls:
            return
        seen_urls.add(normalized_url)
        related.append(item)

    poly = (financial_intelligence or {}).get("polymarket_comparison")
    if isinstance(poly, dict):
        candidates: list[dict[str, Any]] = []
        if isinstance(poly.get("markets"), list):
            candidates.extend([row for row in poly.get("markets", []) if isinstance(row, dict)])
        if isinstance(poly.get("events"), list):
            candidates.extend([row for row in poly.get("events", []) if isinstance(row, dict)])
        if isinstance(poly.get("data"), dict):
            data = poly.get("data") or {}
            if isinstance(data.get("markets"), list):
                candidates.extend([row for row in data.get("markets", []) if isinstance(row, dict)])
            if isinstance(data.get("events"), list):
                candidates.extend([row for row in data.get("events", []) if isinstance(row, dict)])
        for row in candidates:
            url = str(row.get("url") or row.get("link") or row.get("market_url") or row.get("event_url") or "").strip()
            if not url:
                continue
            append_market(
                {
                    "provider": "polymarket" if "polymarket" in url.lower() else "prediction_market",
                    "title": str(row.get("title") or row.get("question") or row.get("name") or "Prediction market"),
                    "description": str(row.get("description") or ""),
                    "url": url,
                    "probability": row.get("probability") or row.get("yes_prob") or row.get("odds"),
                    "volume": row.get("volume") or row.get("liquidity"),
                    "endDate": row.get("end_date") or row.get("endDate") or row.get("close_time"),
                    "createdAt": row.get("created_at") or row.get("createdAt"),
                    "relevanceReason": "Mapped from SynthData prediction-market comparison",
                }
            )

    external_results = await asyncio.gather(
        fetch_polymarket_markets(topic, limit=max(limit * 2, 8)),
        fetch_kalshi_markets(topic, limit=max(limit * 2, 8)),
        return_exceptions=True,
    )
    for source in external_results:
        if isinstance(source, Exception):
            continue
        for row in source:
            append_market(row)

    for trend in top_trends:
        if not isinstance(trend, dict):
            continue
        trend_url = str(trend.get("url") or "").strip()
        if "polymarket.com" in trend_url.lower():
            append_market(
                {
                    "provider": "polymarket",
                    "title": str(trend.get("title") or "Polymarket market"),
                    "description": "",
                    "url": trend_url,
                    "probability": None,
                    "volume": None,
                    "endDate": trend.get("timestamp"),
                    "createdAt": trend.get("timestamp"),
                    "relevanceReason": "Detected directly in high-impact signals",
                }
            )
        if "kalshi.com" in trend_url.lower():
            append_market(
                {
                    "provider": "kalshi",
                    "title": str(trend.get("title") or "Kalshi market"),
                    "description": "",
                    "url": trend_url,
                    "probability": None,
                    "volume": None,
                    "endDate": trend.get("timestamp"),
                    "createdAt": trend.get("timestamp"),
                    "relevanceReason": "Detected directly in high-impact signals",
                }
            )

    if not related and include_market_fallback:
        topic_slug = quote_plus(topic[:120])
        append_market(
            {
                "provider": "polymarket",
                "title": f"Search Polymarket for: {topic[:80]}",
                "description": "",
                "url": f"https://polymarket.com/search?q={topic_slug}",
                "probability": None,
                "volume": None,
                "endDate": None,
                "createdAt": now.isoformat(),
                "relevanceReason": "No direct market matched; search suggested",
            }
        )
        append_market(
            {
                "provider": "kalshi",
                "title": f"Search Kalshi for: {topic[:80]}",
                "description": "",
                "url": f"https://kalshi.com/markets?search={topic_slug}",
                "probability": None,
                "volume": None,
                "endDate": None,
                "createdAt": now.isoformat(),
                "relevanceReason": "No direct market matched; search suggested",
            }
        )

    enriched: list[dict[str, Any]] = []
    for market in related:
        scoring = score_market_fit(
            market=market,
            topic=topic,
            topic_tokens=topic_tokens,
            evidence_tokens=evidence_tokens,
            now=now,
            confidence_score=confidence_score,
        )
        enriched.append(
            {
                **market,
                "probability": normalize_probability(market.get("probability")),
                "volume": float(market.get("volume")) if str(market.get("volume", "")).replace(".", "", 1).isdigit() else market.get("volume"),
                **scoring,
            }
        )

    enriched.sort(key=lambda item: (item.get("fitScore", 0), item.get("liquidityScore", 0)), reverse=True)
    run_actionable = (
        data_sufficiency in {"healthy", "partial"}
        and findings_count >= int(os.getenv("MARKET_MIN_FINDINGS", "5"))
        and agreement_score >= float(os.getenv("MARKET_MIN_AGREEMENT", "0.55"))
    )
    if not run_actionable:
        suppression_reasons.append(
            f"Run gated: sufficiency={data_sufficiency}, findings={findings_count}, agreement={agreement_score:.2f}"
        )

    min_fit = int(os.getenv("MARKET_MIN_FIT_SCORE", "55"))
    min_semantic_hits = int(os.getenv("MARKET_MIN_SEMANTIC_HITS", "1"))
    min_semantic_overlap = float(os.getenv("MARKET_MIN_SEMANTIC_OVERLAP", "0.06"))
    min_evidence_overlap = float(os.getenv("MARKET_MIN_EVIDENCE_OVERLAP", "0.0"))
    strict_relevance_gate = env_flag("MARKET_STRICT_RELEVANCE_GATE", "true")
    filtered: list[dict[str, Any]] = []
    for market in enriched:
        semantic_hits = int(market.get("semanticHits", 0))
        semantic_overlap = float(market.get("semanticOverlap", 0.0))
        evidence_overlap = float(market.get("evidenceOverlap", 0.0))
        relevance_ok = (
            semantic_hits >= min_semantic_hits
            and semantic_overlap >= min_semantic_overlap
            and evidence_overlap >= min_evidence_overlap
        )
        market_actionable = run_actionable and int(market.get("fitScore", 0)) >= min_fit and relevance_ok
        market["actionable"] = market_actionable
        market["fitLabel"] = market.get("fitLabel", "weak")
        if not market_actionable:
            reasons: list[str] = []
            if not run_actionable:
                reasons.append("Run quality gate not met")
            if int(market.get("fitScore", 0)) < min_fit:
                reasons.append(f"fit<{min_fit}")
            if not relevance_ok:
                reasons.append("low_topic_overlap")
            if int(market.get("liquidityScore", 0)) < int(os.getenv("MARKET_MIN_LIQ_SCORE", "20")):
                reasons.append("low_liquidity")
            market["suppressionReasons"] = reasons
            suppression_reasons.extend([f"{market.get('provider')}:{market.get('title')[:40]}:{reason}" for reason in reasons])
        else:
            market["suppressionReasons"] = []
        if relevance_ok or not strict_relevance_gate:
            filtered.append(market)
    enriched = filtered

    return {
        "markets": enriched[:limit],
        "gating": {
            "actionable": run_actionable,
            "dataSufficiency": data_sufficiency,
            "findingsCount": findings_count,
            "agreementScore": round(agreement_score, 3),
            "minFitScore": min_fit,
        },
        "suppressionReasons": suppression_reasons[:20],
    }
