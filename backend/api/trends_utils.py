"""
Utility functions for trends route handlers.

This module provides helper functions for task data extraction,
analysis, and result transformation used by the trends routes.
"""

import datetime
from typing import Any

from backend.api.helpers import parse_iso, provider_failure_rate


def extract_task_findings(task: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract and normalize raw findings from a task."""
    result_node = task.get("result")
    if isinstance(result_node, dict) and isinstance(result_node.get("raw_findings"), list):
        findings = result_node.get("raw_findings") or []
    elif isinstance(task.get("raw_findings"), list):
        findings = task.get("raw_findings") or []
    else:
        findings = []

    normalized: list[dict[str, Any]] = []
    for item in findings:
        if hasattr(item, "model_dump"):
            normalized.append(item.model_dump())
        elif isinstance(item, dict):
            normalized.append(item)
    return normalized


def build_podcast_payload(
    task_id: str,
    task: dict[str, Any],
    input_payload: dict[str, Any],
) -> dict[str, Any]:
    """Build podcast generation payload from task results."""
    result_node = task.get("result") if isinstance(task.get("result"), dict) else task
    topic = str(task.get("topic") or "Trende Intelligence Brief")
    summary = str(result_node.get("summary") or task.get("summary") or "").strip()
    final_report = str(result_node.get("final_report_md") or task.get("final_report_md") or "").strip()
    tone = str(input_payload.get("tone") or "analyst").strip()[:32]
    duration_minutes = int(input_payload.get("duration_minutes") or 8)
    duration_minutes = max(3, min(duration_minutes, 20))

    findings = extract_task_findings(task)
    citations: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for idx, item in enumerate(findings, start=1):
        url = str(item.get("url") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        citations.append(
            {
                "id": f"S{len(citations) + 1}",
                "title": str(item.get("title") or "Source"),
                "url": url,
                "platform": str(item.get("platform") or "web"),
                "author": str(item.get("author") or "unknown"),
            }
        )
        if len(citations) >= 12:
            break

    intro = summary or (final_report[:900] if final_report else "No summary available.")
    bullet_lines = [f"- [{c['id']}] {c['title']} ({c['platform']})" for c in citations[:6]]
    bullet_block = "\n".join(bullet_lines) if bullet_lines else "- No source links captured in this run."
    script = (
        f"# Podcast Draft: {topic}\n\n"
        f"## Episode Meta\n"
        f"- Tone: {tone}\n"
        f"- Target length: {duration_minutes} minutes\n"
        f"- Source task: {task_id}\n\n"
        f"## Intro (Host)\n"
        f"{intro}\n\n"
        f"## Segment 1: What happened\n"
        f"Host: Summarize the strongest verified signal in plain language.\n"
        f"Analyst: Tie claim to sources and model agreement.\n\n"
        f"## Segment 2: Why it matters\n"
        f"Host: Explain market/agent impact and what changed this cycle.\n"
        f"Analyst: Call out reliability and disagreement risks.\n\n"
        f"## Segment 3: What to monitor next\n"
        f"Host: Provide clear watchlist items for next 24-72h.\n"
        f"Analyst: Add trigger thresholds and invalidation cues.\n\n"
        f"## Source Anchors\n"
        f"{bullet_block}\n\n"
        f"## Compliance Note\n"
        f"This draft is generated from attested Trende run outputs and must preserve source citations."
    )

    outline = (
        f"# Outline: {topic}\n\n"
        f"1. Opening thesis (60-90s)\n"
        f"2. Evidence and divergence (3-5 min)\n"
        f"3. Risk and next triggers (2-3 min)\n\n"
        f"## Citations\n"
        f"{bullet_block}"
    )

    return {
        "status": "ready",
        "podcast": {
            "title": str(input_payload.get("title") or f"Trende Podcast Draft: {topic}")[:160],
            "tone": tone,
            "duration_minutes": duration_minutes,
            "source_task_id": task_id,
            "source_count": len(citations),
            "audio_generation": "not_started",
            "notes": "Draft-only mode enabled. Hook TTS renderer for MP3 generation.",
        },
        "assets": {
            "transcript_markdown": script,
            "outline_markdown": outline,
            "citations": citations,
        },
    }


def extract_chainlink_proof(
    raw_findings: list[dict[str, Any]] | list[Any],
    task: dict[str, Any],
) -> dict[str, Any] | None:
    """Extract Chainlink proof data from findings and actions."""
    latest_finding: dict[str, Any] | None = None
    latest_ts: datetime.datetime | None = None

    for finding in raw_findings or []:
        item = finding.model_dump() if hasattr(finding, "model_dump") else finding
        if not isinstance(item, dict):
            continue
        if str(item.get("platform", "")).lower() != "chainlink":
            continue
        ts = parse_iso(item.get("timestamp"))
        if latest_finding is None or (ts and (latest_ts is None or ts > latest_ts)):
            latest_finding = item
            latest_ts = ts

    proof: dict[str, Any] = {}
    if latest_finding:
        raw_data = latest_finding.get("raw_data", {}) or {}
        if isinstance(raw_data, dict):
            tx_hash = raw_data.get("tx_hash")
            network = raw_data.get("network")
            request_id = raw_data.get("request_id")
            source_query = raw_data.get("source_query")
            status = raw_data.get("status")
            if tx_hash:
                proof["txHash"] = tx_hash
            if network:
                proof["network"] = network
            if request_id:
                proof["requestId"] = request_id
            if source_query:
                proof["sourceQuery"] = source_query
            if status:
                proof["status"] = status

    for action in task.get("actions", []) or []:
        if not isinstance(action, dict):
            continue
        action_type = str(action.get("action_type", ""))
        if action_type not in {"stage_oracle_market", "resolve_oracle_market"}:
            continue
        payload = action.get("result_payload") or {}
        if not isinstance(payload, dict):
            continue
        if payload.get("tx_hash"):
            proof.setdefault("txHash", payload.get("tx_hash"))
        if payload.get("network"):
            proof.setdefault("network", payload.get("network"))
        if payload.get("explorer_url"):
            proof["explorerUrl"] = payload.get("explorer_url")
        if payload.get("market_id"):
            proof.setdefault("marketId", payload.get("market_id"))
        if action_type == "resolve_oracle_market":
            proof["oracleSettlement"] = "requested"
        elif action_type == "stage_oracle_market":
            proof.setdefault("oracleSettlement", "staged")

    if not proof:
        return None

    if proof.get("txHash") and not proof.get("explorerUrl"):
        try:
            from backend.services.chainlink_service import chainlink_service  # lazy import

            explorer = chainlink_service.chain_info.get("explorer", "https://sepolia.basescan.org")
            proof["explorerUrl"] = f"{explorer}/tx/{proof['txHash']}"
            proof.setdefault("network", chainlink_service.active_chain)
        except Exception:
            pass

    proof.setdefault("status", "submitted" if proof.get("txHash") else "available")
    return proof


def derive_chainlink_stage(proof: dict[str, Any] | None, configured: bool) -> str:
    """Derive the Chainlink stage from proof and configuration."""
    if not configured:
        return "not_configured"
    if not proof:
        return "available"
    settlement = str(proof.get("oracleSettlement", "")).lower()
    if settlement == "requested":
        return "resolution_requested"
    if settlement == "staged":
        return "market_staged"
    if proof.get("txHash"):
        return "request_submitted"
    return "available"


def task_runtime_alerts(task: dict[str, Any]) -> list[str]:
    """Generate runtime alerts for a task based on its state."""
    import os
    from shared.models import QueryStatus
    
    alerts: list[str] = []
    status = str(task.get("status", "")).lower()
    created_at = parse_iso(task.get("created_at"))
    updated_at = parse_iso(task.get("updated_at")) or datetime.datetime.now(datetime.timezone.utc)
    consensus = task.get("consensus_data") or {}
    result_node = task.get("result") if isinstance(task.get("result"), dict) else {}
    consensus = consensus or result_node.get("consensus_data") or {}
    attestation = task.get("attestation_data") or result_node.get("attestation_data") or {}
    findings = result_node.get("raw_findings") or task.get("raw_findings") or []
    report_md = str(result_node.get("final_report_md") or task.get("final_report_md") or "").strip()

    stuck_seconds = int(os.getenv("RUN_HEALTH_STUCK_SECONDS", "420"))
    if created_at and status in {
        QueryStatus.PENDING,
        QueryStatus.PLANNING,
        QueryStatus.RESEARCHING,
        QueryStatus.PROCESSING,
        QueryStatus.ANALYZING,
    }:
        elapsed = (updated_at - created_at).total_seconds()
        if elapsed > stuck_seconds:
            alerts.append(f"stuck_run: elapsed {int(elapsed)}s > {stuck_seconds}s")

    if status == QueryStatus.COMPLETED and str(attestation.get("status", "")).lower() != "signed":
        alerts.append("attestation_not_signed")

    failure_rate = provider_failure_rate(consensus)
    if failure_rate >= float(os.getenv("RUN_HEALTH_PROVIDER_FAIL_RATE", "0.5")):
        alerts.append(f"provider_failure_rate_high:{failure_rate}")

    if status == QueryStatus.COMPLETED and len(findings) == 0:
        alerts.append("empty_findings")
    if status == QueryStatus.COMPLETED and len(report_md) < 120:
        alerts.append("report_too_short_for_export")

    return alerts


def estimate_live_progress(state: dict[str, Any]) -> int:
    """Estimate progress percentage based on task status and elapsed time."""
    from shared.models import QueryStatus
    
    status = state.get("status")
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    created_dt = parse_iso(state.get("created_at")) or now_dt
    elapsed_seconds = max(0, int((now_dt - created_dt).total_seconds()))

    if status == QueryStatus.PENDING:
        progress = min(15, 8 + max(0, elapsed_seconds // 3))
    elif status == QueryStatus.PLANNING:
        progress = min(30, 18 + max(0, elapsed_seconds // 4))
    elif status == QueryStatus.RESEARCHING:
        research_elapsed = min(max(elapsed_seconds - 15, 0), 480)
        progress = 32 + int((research_elapsed / 480.0) * 33)
    elif status == QueryStatus.PROCESSING:
        process_elapsed = min(max(elapsed_seconds - 120, 0), 420)
        progress = 66 + int((process_elapsed / 420.0) * 20)
    elif status == QueryStatus.ANALYZING:
        analyze_elapsed = min(max(elapsed_seconds - 240, 0), 600)
        progress = 86 + int((analyze_elapsed / 600.0) * 11)
    elif status == QueryStatus.COMPLETED:
        progress = 100
    elif status == QueryStatus.FAILED:
        progress = int(state.get("progress", 0) or 0)
    else:
        progress = int(state.get("progress", 0) or 0)

    previous_progress = int(state.get("progress", 0) or 0)
    if status != QueryStatus.COMPLETED:
        progress = min(99, max(previous_progress, progress))
    return int(progress)


def derive_top_trends_from_findings(
    raw_findings: list[Any],
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Extract top trends from raw findings based on relevance and engagement."""
    seen: set[tuple[str, str]] = set()
    ranked: list[tuple[float, dict[str, Any]]] = []

    for entry in raw_findings or []:
        item = entry.model_dump() if hasattr(entry, "model_dump") else entry
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        content = str(item.get("content") or "").strip()
        if not title and not content:
            continue

        platform = str(item.get("platform") or "unknown").strip().lower()
        dedupe_key = (platform, (item.get("url") or title or content[:120]).strip().lower())
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        relevance = item.get("relevance_score")
        try:
            relevance_score = float(relevance) if relevance is not None else 0.0
        except Exception:
            relevance_score = 0.0

        metrics = item.get("metrics") or {}
        engagement = 0
        if isinstance(metrics, dict):
            for key in ("likes", "shares", "comments", "views"):
                try:
                    engagement += int(metrics.get(key) or 0)
                except Exception:
                    pass

        ranked.append(
            (
                relevance_score * 1000 + engagement,
                {
                    "title": title or content[:120],
                    "platform": platform,
                    "url": str(item.get("url") or ""),
                    "author": str(item.get("author") or ""),
                    "timestamp": str(item.get("timestamp") or ""),
                },
            )
        )

    ranked.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in ranked[:limit]]


def derive_source_breakdown(raw_findings: list[Any]) -> list[dict[str, Any]]:
    """Derive source breakdown statistics from raw findings."""
    bucket: dict[str, dict[str, Any]] = {}
    for entry in raw_findings or []:
        item = entry.model_dump() if hasattr(entry, "model_dump") else entry
        if not isinstance(item, dict):
            continue
        platform = str(item.get("platform") or "unknown").lower()
        raw_data = item.get("raw_data") if isinstance(item.get("raw_data"), dict) else {}
        source_name = str(
            raw_data.get("source")
            or raw_data.get("provider")
            or raw_data.get("connector")
            or item.get("author_handle")
            or platform
        ).strip().lower()
        key = f"{platform}:{source_name}"
        row = bucket.setdefault(
            key,
            {
                "platform": platform,
                "source": source_name,
                "items": 0,
            },
        )
        row["items"] += 1

    rows = list(bucket.values())
    rows.sort(key=lambda r: int(r.get("items", 0)), reverse=True)
    return rows[:20]
