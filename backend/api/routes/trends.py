"""
Trends routes for research task management and results.
"""

import asyncio
import datetime
import json
import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from backend.api.market_service import extract_related_prediction_markets
from backend.api.models import (
    AskTrendeRequest,
    PublishRequest,
    QueryRequest,
    SaveResearchRequest,
)
from backend.api.services import TaskService
from backend.api.trends_utils import (
    derive_chainlink_stage,
    derive_source_breakdown,
    derive_top_trends_from_findings,
    estimate_live_progress,
    extract_chainlink_proof,
    extract_task_findings,
    task_runtime_alerts,
)
from backend.services.archive_service import archive_service
from backend.services.export_service import (
    build_export_payload,
    render_json_report,
    render_markdown_report,
    render_pdf_report,
)
from backend.services.x402_service import x402_service
from backend.utils.rate_limit import user_rate_limiter
from shared.models import QueryStatus


router = APIRouter(prefix="/api/trends", tags=["trends"])
task_service = TaskService()


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_rate_limit(
    request: Request,
    wallet_address: str | None = None,
) -> tuple[bool, Any, Response | None]:
    """
    Check rate limit and return (allowed, info, error_response).
    If not allowed and X402 is enabled, returns 402 response.
    """
    ip_address = get_client_ip(request)
    allowed, info = await user_rate_limiter.check_and_consume(wallet_address, ip_address)

    if allowed:
        return True, info, None

    require_x402 = os.getenv("REQUIRE_X402", "false").lower() == "true"

    if require_x402:
        headers = x402_service.get_payment_headers(
            os.getenv("X402_PAYMENT_AMOUNT", "0.001"),
            os.getenv("X402_RECIPIENT_ADDRESS", ""),
            int(os.getenv("MONAD_CHAIN_ID", "10143")),
        )
        headers.update(info.to_headers())
        return (
            False,
            info,
            JSONResponse(
                status_code=402,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"You've used all {info.limit} searches for today. Connect wallet or pay to continue.",
                    "tier": info.tier,
                    "reset_at": info.reset_at.isoformat(),
                },
                headers=headers,
            ),
        )

    return (
        False,
        info,
        JSONResponse(
            status_code=429,
            content={
                "error": "Rate limit exceeded",
                "message": f"You've used all {info.limit} searches for today. Try again after {info.reset_at.isoformat()}.",
                "tier": info.tier,
                "reset_at": info.reset_at.isoformat(),
            },
            headers=info.to_headers(),
        ),
    )


@router.post("/start", response_model=None)
async def start_analysis(
    request: QueryRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    response: Response,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> dict[str, Any] | Response:
    """Start a new research analysis task."""
    # Check if payment bypasses rate limit (premium tier)
    has_premium = False
    if request.payment and x402_service.verify_payment(request.payment):
        has_premium = True

    # Check rate limit
    allowed, rate_info, error_response = await check_rate_limit(
        http_request,
        wallet_address=x_wallet_address,
    )

    # Add rate limit headers to response
    for k, v in rate_info.to_headers().items():
        response.headers[k] = v

    # If rate limit exceeded and no valid payment, return error
    if not allowed and not has_premium:
        return error_response or Response(status_code=429)

    matching_task_id = task_service.find_matching_active_task(
        request.topic or "",
        request.platforms,
        request.models,
        request.augmentation,
    )
    if matching_task_id:
        existing = task_service.get_task(matching_task_id) or {}
        return {
            "task_id": matching_task_id,
            "id": matching_task_id,
            "status": existing.get("status", QueryStatus.PENDING),
            "createdAt": existing.get("created_at"),
            "reused": True,
        }

    task_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    task = {
        "task_id": task_id,
        "status": QueryStatus.PENDING,
        "logs": [],
        "result": None,
        "topic": request.topic,
        "platforms": request.platforms,
        "models": request.models,
        "sponsor_address": x_wallet_address,
        "owner_address": x_wallet_address,
        "is_saved": False,
        "visibility": request.visibility,
        "augmentation": request.augmentation,
        "saved_at": None,
        "ipfs_cid": None,
        "ipfs_uri": None,
        "save_label": None,
        "tags": [],
        "created_at": now,
        "updated_at": now,
        "run_telemetry": {
            "run_id": task_id,
            "provider_count": 0,
            "agreement_score": 0.0,
            "diversity_level": "low",
            "attestation_status": "pending",
            "data_sufficiency": "unknown",
            "findings_count": 0,
            "logs": [],
        },
    }

    task_service.save_task(task_id, task)

    # Import here to avoid circular dependency
    from backend.api.main import run_agent_workflow
    background_tasks.add_task(
        run_agent_workflow,
        task_id,
        request.topic or "",
        request.platforms,
        request.models,
        request.augmentation,
    )

    return {
        "task_id": task_id,
        "id": task_id,
        "status": QueryStatus.PENDING,
        "createdAt": now,
    }


@router.get("/history")
async def get_history(saved_only: bool = False) -> dict[str, Any]:
    """Returns a list of all past queries."""
    records = task_service.get_all_tasks()
    if saved_only:
        records = [item for item in records if item.get("is_saved")]
    return {
        "queries": [
            {
                "id": item.get("task_id"),
                "idea": item.get("topic", ""),
                "status": item.get("status", QueryStatus.PENDING),
                "createdAt": item.get("created_at", ""),
                "savedAt": item.get("saved_at"),
                "isSaved": bool(item.get("is_saved")),
                "visibility": item.get("visibility", "private"),
                "ipfsUri": item.get("ipfs_uri"),
                "saveLabel": item.get("save_label"),
            }
            for item in records
        ]
    }


@router.get("/saved", response_model=None)
async def get_saved_research(
    limit: int = 100,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> Any:
    """Get saved research for the authenticated user."""
    if not x_wallet_address:
        return Response(
            status_code=401,
            content=json.dumps({"error": "Wallet connection required to fetch saved research."}),
        )
    records = task_service.get_saved_research(x_wallet_address, limit=limit)
    return {
        "saved": [
            {
                "id": item.get("task_id"),
                "idea": item.get("topic", ""),
                "status": item.get("status", QueryStatus.PENDING),
                "platforms": item.get("platforms", []),
                "createdAt": item.get("created_at", ""),
                "savedAt": item.get("saved_at"),
                "visibility": item.get("visibility", "private"),
                "ipfsCid": item.get("ipfs_cid"),
                "ipfsUri": item.get("ipfs_uri"),
                "saveLabel": item.get("save_label"),
                "tags": item.get("tags", []),
                "hasAttestation": bool(item.get("has_attestation")),
            }
            for item in records
        ],
        "total": len(records),
    }


@router.post("/{task_id}/save", response_model=None)
async def save_research(
    task_id: str,
    request: SaveResearchRequest,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address"),
) -> Any:
    """Save research to the vault."""
    if not x_wallet_address:
        return Response(
            status_code=401,
            content=json.dumps({"error": "Connect wallet before saving research."}),
        )

    task = task_service.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    result_node = task.get("result") if isinstance(task.get("result"), dict) else task
    archive_payload = {
        "task_id": task_id,
        "topic": task.get("topic"),
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
        "platforms": task.get("platforms", []),
        "models": task.get("models", []),
        "summary": result_node.get("summary") if isinstance(result_node, dict) else task.get("summary"),
        "final_report_md": result_node.get("final_report_md") if isinstance(result_node, dict) else task.get("final_report_md"),
        "consensus_data": result_node.get("consensus_data") if isinstance(result_node, dict) else task.get("consensus_data"),
        "attestation_data": result_node.get("attestation_data") if isinstance(result_node, dict) else task.get("attestation_data"),
    }
    archive_info = await archive_service.archive_payload(
        archive_payload,
        prefer_ipfs=request.pin_to_ipfs,
    )

    try:
        saved = task_service.mark_task_saved(
            task_id=task_id,
            wallet_address=x_wallet_address,
            visibility=request.visibility,
            ipfs_cid=archive_info.get("cid"),
            ipfs_uri=archive_info.get("uri"),
            save_label=request.save_label,
            tags=request.tags,
        )
    except PermissionError as exc:
        return Response(status_code=403, content=json.dumps({"error": str(exc)}))

    if not saved:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    if task_id:
        task_service.update_task(
            task_id,
            {
                "owner_address": saved.get("owner_address"),
                "is_saved": saved.get("is_saved"),
                "visibility": saved.get("visibility"),
                "saved_at": saved.get("saved_at"),
                "ipfs_cid": saved.get("ipfs_cid"),
                "ipfs_uri": saved.get("ipfs_uri"),
                "save_label": saved.get("save_label"),
                "tags": saved.get("tags"),
            }
        )

    return {
        "saved": {
            "id": task_id,
            "owner": saved.get("owner_address"),
            "visibility": saved.get("visibility"),
            "savedAt": saved.get("saved_at"),
            "ipfsCid": saved.get("ipfs_cid"),
            "ipfsUri": saved.get("ipfs_uri"),
            "saveLabel": saved.get("save_label"),
            "tags": saved.get("tags", []),
        },
        "archive": archive_info,
    }


@router.get("/status/{task_id}", response_model=None)
async def get_status(task_id: str) -> dict[str, Any] | Response:
    """Get the status of a task."""
    task = task_service.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))
    return task


@router.get("/{task_id}", response_model=None)
async def get_task_results(task_id: str) -> dict[str, Any] | Response:
    """Returns the full task results in the format expected by the frontend."""
    task = task_service.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    # Normalize result extraction
    res_node_raw = task.get("result")
    res_node = res_node_raw if isinstance(res_node_raw, dict) else task

    # Transform raw items into TrendResult objects
    items_by_platform: dict[str, list[dict[str, Any]]] = {}
    
    raw_findings = []
    if isinstance(res_node, dict) and res_node.get("raw_findings"):
        raw_findings = res_node.get("raw_findings")
    elif isinstance(task, dict) and task.get("raw_findings"):
        raw_findings = task.get("raw_findings")
        
    for item in raw_findings or []:
        normalized_item = item.model_dump() if hasattr(item, "model_dump") else item
        platform = (
            normalized_item.get("platform", "web") if isinstance(normalized_item, dict) else "web"
        )
        if platform not in items_by_platform:
            items_by_platform[platform] = []
        items_by_platform[platform].append(normalized_item)

    results = []
    for platform, items in items_by_platform.items():
        results.append(
            {
                "queryId": task_id,
                "platform": platform,
                "items": items,
                "relevanceScore": res_node.get("relevance_score", 0.0)
                if isinstance(res_node, dict)
                else 0.0,
                "totalFetched": len(items),
                "processingTimeMs": 0,
            }
        )

    confidence_score = 0.0
    validation_results = []
    research_payload = None
    consensus_data = None
    attestation_data = None
    summary_text = ""
    final_report_md = ""
    run_telemetry = {}
    editorial_data = None
    financial_intelligence = None

    if isinstance(res_node, dict):
        confidence_score = res_node.get("confidence_score", task.get("confidence_score", 0.0))
        validation_results = res_node.get("validation_results", task.get("validation_results", []))
        research_payload = res_node.get("research_payload", task.get("research_payload"))
        consensus_data = res_node.get("consensus_data", task.get("consensus_data"))
        attestation_data = res_node.get("attestation_data", task.get("attestation_data"))
        summary_text = res_node.get("summary", task.get("summary", ""))
        final_report_md = res_node.get("final_report_md", task.get("final_report_md", ""))
        run_telemetry = (
            res_node.get("run_telemetry")
            or task.get("run_telemetry")
            or {}
        )
        editorial_data = res_node.get("editorial_data", task.get("editorial_data"))
        financial_intelligence = res_node.get("financial_intelligence", task.get("financial_intelligence"))

    top_trends = derive_top_trends_from_findings(raw_findings or [], limit=5)
    
    # Only fetch related markets for completed tasks
    related_market_output: dict[str, Any] = {
        "markets": [],
        "gating": {
            "actionable": False,
            "dataSufficiency": str(run_telemetry.get("data_sufficiency", "unknown")).strip().lower() or "unknown",
            "findingsCount": int(run_telemetry.get("findings_count", len(raw_findings or [])) or 0),
            "agreementScore": float((consensus_data or {}).get("agreement_score", 0.0) or 0.0),
            "minFitScore": 45,
        },
        "suppressionReasons": [],
    }
    
    if task.get("status") == QueryStatus.COMPLETED:
        related_market_output = await extract_related_prediction_markets(
            topic=task.get("topic", ""),
            financial_intelligence=financial_intelligence if isinstance(financial_intelligence, dict) else None,
            top_trends=top_trends,
            confidence_score=float(confidence_score or 0.0),
            agreement_score=float((consensus_data or {}).get("agreement_score", 0.0) or 0.0),
            findings_count=int(run_telemetry.get("findings_count", len(raw_findings or [])) or 0),
            data_sufficiency=str(run_telemetry.get("data_sufficiency", "unknown")).strip().lower(),
            limit=5,
        )
    
    related_markets = related_market_output.get("markets", [])
    source_breakdown = derive_source_breakdown(raw_findings or [])
    chainlink_proof = extract_chainlink_proof(raw_findings or [], task)
    chainlink_configured = False
    try:
        from backend.services.chainlink_service import chainlink_service
        chainlink_configured = bool(chainlink_service.is_configured())
    except Exception:
        chainlink_configured = False
    chainlink_stage = derive_chainlink_stage(chainlink_proof, chainlink_configured)
    tee_status = str((attestation_data or {}).get("status", "pending")).lower()
    consensus_status = "active" if (consensus_data or {}).get("providers") else "degraded"

    return {
        "query": {
            "id": task_id,
            "idea": task.get("topic", ""),
            "platforms": task.get("platforms", []),
            "status": task.get("status", "pending"),
            "createdAt": task.get("created_at", ""),
            "updatedAt": task.get("updated_at", task.get("created_at", "")),
            "errorMessage": task.get("error"),
            "totalResults": len(res_node.get("raw_findings") or [])
            if isinstance(res_node, dict)
            else 0,
            "relevanceThreshold": 0.5,
            "isSaved": bool(task.get("is_saved")),
            "visibility": task.get("visibility", "private"),
            "augmentation": task.get("augmentation") or {},
            "savedAt": task.get("saved_at"),
            "ipfsUri": task.get("ipfs_uri"),
            "saveLabel": task.get("save_label"),
        },
        "results": results,
        "summary": {
            "overview": summary_text,
            "keyThemes": [],
            "topTrends": top_trends,
            "sentiment": "neutral",
            "confidenceScore": confidence_score,
            "validationResults": validation_results,
            "finalReportMd": final_report_md,
            "researchPayload": research_payload,
            "consensusData": consensus_data,
            "attestationData": attestation_data,
            "oracleMarketId": task.get("oracle_market_id"),
            "financialIntelligence": financial_intelligence,
            "relatedMarkets": related_markets,
            "marketSignals": {
                "gating": related_market_output.get("gating", {}),
                "suppressionReasons": related_market_output.get("suppressionReasons", []),
            },
            "generatedAt": task.get("updated_at", task.get("created_at", "")),
        },
        "telemetry": {
            "runId": run_telemetry.get("run_id", task_id),
            "providerCount": run_telemetry.get(
                "provider_count", len((consensus_data or {}).get("providers") or [])
            ),
            "providerFailureRate": run_telemetry.get(
                "provider_failure_rate",
                0.0,  # Will be calculated from consensus_data
            ),
            "agreementScore": run_telemetry.get(
                "agreement_score", (consensus_data or {}).get("agreement_score", 0.0)
            ),
            "diversityLevel": run_telemetry.get(
                "diversity_level", (consensus_data or {}).get("diversity_level", "low")
            ),
            "durationSeconds": run_telemetry.get("duration_seconds", 0),
            "attestationStatus": run_telemetry.get(
                "attestation_status", (attestation_data or {}).get("status", "pending")
            ),
            "dataSufficiency": run_telemetry.get("data_sufficiency", "unknown"),
            "findingsCount": run_telemetry.get("findings_count", len(raw_findings or [])),
            "warnings": run_telemetry.get("warnings", (consensus_data or {}).get("warnings", [])),
            "logs": run_telemetry.get("logs", task.get("logs", [])[-12:]),
            "updatedAt": run_telemetry.get(
                "updated_at", task.get("updated_at", task.get("created_at", ""))
            ),
            "qualityGate": run_telemetry.get("quality_gate", task.get("quality_assessment", {})),
            "sourceRoutes": run_telemetry.get("source_routes", task.get("source_routes", [])),
            "sourceBreakdown": run_telemetry.get("source_breakdown", source_breakdown),
            "chainlinkProof": chainlink_proof,
            "trustStack": {
                "tee": {
                    "status": "signed" if tee_status == "signed" else ("ready" if tee_status in {"ready", "signed"} else "pending"),
                    "provider": (attestation_data or {}).get("provider", "eigen"),
                },
                "consensus": {
                    "status": consensus_status,
                    "providers": (consensus_data or {}).get("providers", []),
                    "agreementScore": (consensus_data or {}).get("agreement_score", 0.0),
                },
                "chainlink": {
                    "status": chainlink_stage,
                    "configured": chainlink_configured,
                    "network": (chainlink_proof or {}).get("network"),
                },
            },
            "marketSignals": related_market_output.get("gating", {}),
            "marketSuppressionReasons": related_market_output.get("suppressionReasons", []),
        },
        "editorial": editorial_data,
    }


@router.get("/{task_id}/export", response_model=None)
async def export_task_report(task_id: str, format: str = "pdf") -> Response:
    """Export a task report in the specified format."""
    task = task_service.get_task(task_id)
    if not task:
        return Response(status_code=404, content=json.dumps({"error": "Task not found"}))

    normalized_format = (format or "pdf").strip().lower()
    payload = build_export_payload(task_id=task_id, task=task)
    report_md = str(payload.get("final_report_md") or "").strip()
    summary = str(payload.get("summary") or "").strip()
    source_count = int((payload.get("stats") or {}).get("source_count") or 0)
    if not report_md and not summary and source_count == 0:
        return Response(
            status_code=422,
            content=json.dumps({"error": "Report content is empty; export aborted."}),
            media_type="application/json",
        )
    file_stub = f"trende-report-{task_id[:8]}"

    if normalized_format == "pdf":
        body = render_pdf_report(payload)
        media = "application/pdf"
        filename = f"{file_stub}.pdf"
    elif normalized_format in {"md", "markdown"}:
        body = render_markdown_report(payload).encode("utf-8")
        media = "text/markdown; charset=utf-8"
        filename = f"{file_stub}.md"
    elif normalized_format == "json":
        body = render_json_report(payload)
        media = "application/json; charset=utf-8"
        filename = f"{file_stub}.json"
    else:
        return Response(
            status_code=400,
            content=json.dumps({"error": "format must be one of: pdf, md, json"}),
            media_type="application/json",
        )

    return Response(
        content=body,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/{task_id}/stream")
async def stream_status(task_id: str) -> StreamingResponse:
    """Stream task status updates via SSE."""
    async def event_generator() -> AsyncIterator[str]:
        await asyncio.sleep(1.0)
        while True:
            state = task_service.get_task(task_id)
            if not state:
                payload = {
                    "type": "error",
                    "message": "Task not found",
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "data": {"task_id": task_id},
                }
                yield f"data: {json.dumps(payload)}\n\n"
                break

            progress = estimate_live_progress(state)
            state["progress"] = progress
            payload = {
                "type": "status",
                "message": f"{state['status']} ({progress}%)",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "data": {
                    "task_id": task_id,
                    "status": state["status"],
                    "progress": progress,
                    "logs": state.get("logs", [])[-5:],
                },
            }
            yield f"data: {json.dumps(payload)}\n\n"

            if state["status"] in [QueryStatus.COMPLETED, QueryStatus.FAILED]:
                final_payload = {
                    "type": "result" if state["status"] == QueryStatus.COMPLETED else "error",
                    "message": "Analysis completed"
                    if state["status"] == QueryStatus.COMPLETED
                    else "Analysis failed",
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "data": {"task_id": task_id, "status": state["status"]},
                }
                yield f"data: {json.dumps(final_payload)}\n\n"
                break

            yield ": keep-alive\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.post("/{task_id}/publish", response_model=None)
async def publish_trend(
    task_id: str, 
    request: PublishRequest,
    x_wallet_address: str | None = Header(None, alias="X-Wallet-Address")
) -> Any:
    """Publish trend report to external platforms."""
    if not x_wallet_address:
        return JSONResponse(status_code=401, content={"error": "Connect wallet before publishing."})

    if request.platform.strip().lower() != "paragraph":
        return JSONResponse(status_code=400, content={"error": "Unsupported publish platform."})

    task = task_service.get_task(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})

    owner_address = (
        (task.get("owner_address") or task.get("sponsor_address") or "")
        .strip()
        .lower()
    )
    requester = x_wallet_address.strip().lower()
    if owner_address and owner_address != requester:
        return JSONResponse(status_code=403, content={"error": "Task owned by a different wallet."})
        
    if task.get("status") != QueryStatus.COMPLETED:
        return JSONResponse(status_code=400, content={"error": "Analysis not complete. Cannot publish."})

    res_node = task.get("result") if isinstance(task.get("result"), dict) else task
    report_md = (res_node.get("final_report_md") or "").strip()
    if not report_md:
        summary = (res_node.get("summary") or task.get("summary") or "").strip()
        findings = res_node.get("raw_findings") or task.get("raw_findings") or []
        lines = [f"# {task.get('topic', 'Trend Analysis')}"]
        if summary:
            lines.extend(["", "## Executive Summary", summary])
        if findings:
            lines.extend(["", "## Key Evidence"])
            for idx, item in enumerate(findings[:8], start=1):
                normalized = item.model_dump() if hasattr(item, "model_dump") else item
                if not isinstance(normalized, dict):
                    continue
                title = normalized.get("title") or "Untitled Source"
                url = normalized.get("url") or ""
                content = str(normalized.get("content") or "").strip()[:280]
                bullet = f"- **S{idx}: {title}**"
                if url:
                    bullet += f" ([link]({url}))"
                if content:
                    bullet += f": {content}"
                lines.append(bullet)
        report_md = "\n".join(lines).strip()
        if not report_md:
            return JSONResponse(status_code=400, content={"error": "No trend report found to draft."})

    try:
        from backend.agents.workflow import run_editorial_task
        editorial_result = await run_editorial_task(
            topic=task.get("topic", "Trend Analysis"),
            report_md=report_md,
            api_key=request.api_key.strip(),
        )
        
        editorial_data = {
            "draft": editorial_result.get("editorial_draft"),
            "published_url": editorial_result.get("published_url"),
            "status": editorial_result.get("publish_status"),
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        task["editorial_data"] = editorial_data
        task["owner_address"] = owner_address or requester
        task_service.save_task(task_id, task)

        draft = editorial_result.get("editorial_draft") or ""
        
        return {
            "success": editorial_result.get("publish_status") in {"SUCCESS", "DRAFT_ONLY"},
            "url": editorial_result.get("published_url"),
            "status": editorial_result.get("publish_status"),
            "draft_preview": (str(draft)[:200] + "...") if draft else "",
        }
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Publishing workflow failed."})


@router.post("/{task_id}/ask", response_model=None)
async def ask_about_task(task_id: str, request: AskTrendeRequest) -> dict[str, Any]:
    """AI-powered Q&A about a specific research task."""
    question = request.question
    if not question:
        return JSONResponse(status_code=400, content={"error": "Question is required"})

    task = task_service.get_task(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})

    summary = task.get("summary") or {}
    consensus = task.get("consensus_data") or {}
    telemetry = task.get("run_telemetry") or {}
    research_payload = task.get("research_payload") or {}
    
    context_parts = []
    
    if summary.get("overview"):
        context_parts.append(f"Research Overview: {summary['overview']}")
    
    if research_payload.get("thesis"):
        thesis_text = "\n".join(f"- {t}" for t in research_payload["thesis"])
        context_parts.append(f"Key Findings:\n{thesis_text}")
    
    if consensus:
        context_parts.append(
            f"Consensus Metrics: {consensus.get('agreement_score', 0):.0%} agreement, "
            f"{len(consensus.get('providers', []))} models, "
            f"divergence: {consensus.get('main_divergence', 'none')}"
        )
    
    if telemetry:
        context_parts.append(
            f"Data Quality: {telemetry.get('findings_count', 0)} sources, "
            f"{telemetry.get('confidence_score', 0):.0%} confidence, "
            f"{telemetry.get('data_sufficiency', 'unknown')} sufficiency"
        )
    
    source_breakdown = telemetry.get("source_breakdown", [])
    if source_breakdown:
        top_sources = source_breakdown[:3]
        sources_text = ", ".join(f"{s['platform']}/{s['source']}: {s['items']}" for s in top_sources)
        context_parts.append(f"Top Sources: {sources_text}")
    
    context = "\n\n".join(context_parts)
    
    prompt = f"""You are a research assistant helping users understand their research results.

Research Context:
{context}

User Question: {question}

Provide a clear, concise answer based on the research context above. If the question asks about something not in the context, say so. Keep your answer under 200 words."""

    try:
        from backend.services.ai_service import ai_service
        
        answer = await ai_service.get_response(
            prompt,
            system_prompt="You are a helpful research assistant. Be concise and factual.",
            provider="venice"
        )
        
        citations = []
        if "confidence" in question.lower() or "score" in question.lower():
            citations.append(f"[confidence:{telemetry.get('confidence_score', 0):.0%}]")
        if "source" in question.lower():
            citations.append(f"[sources:{telemetry.get('findings_count', 0)}]")
        if "agree" in question.lower() or "diverg" in question.lower():
            citations.append(f"[agreement:{consensus.get('agreement_score', 0):.0%}]")
        
        return {
            "question": question,
            "answer": answer,
            "citations": citations,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
    except Exception as e:
        print(f"Ask Trende error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to generate answer", "details": str(e)}
        )