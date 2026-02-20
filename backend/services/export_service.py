import datetime
import json
from io import BytesIO
from typing import Any

from fpdf import FPDF


def _safe_text(value: Any) -> str:
    text = str(value or "")
    return text.encode("latin-1", "replace").decode("latin-1")


def _wrap_hard_tokens(value: str, chunk: int = 32) -> str:
    parts: list[str] = []
    for token in value.split():
        if len(token) <= chunk:
            parts.append(token)
            continue
        parts.append(" ".join(token[i : i + chunk] for i in range(0, len(token), chunk)))
    return " ".join(parts)


def _iso_to_human(value: str | None) -> str:
    if not value:
        return "n/a"
    try:
        dt = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    except Exception:
        return value


def build_export_payload(task_id: str, task: dict[str, Any]) -> dict[str, Any]:
    result_node = task.get("result") if isinstance(task.get("result"), dict) else task
    summary = (
        result_node.get("summary")
        if isinstance(result_node, dict)
        else task.get("summary", "")
    ) or ""
    report_md = (
        result_node.get("final_report_md")
        if isinstance(result_node, dict)
        else task.get("final_report_md", "")
    ) or ""
    consensus = (
        result_node.get("consensus_data")
        if isinstance(result_node, dict)
        else task.get("consensus_data", {})
    ) or {}
    attestation = (
        result_node.get("attestation_data")
        if isinstance(result_node, dict)
        else task.get("attestation_data", {})
    ) or {}
    findings = (
        result_node.get("raw_findings")
        if isinstance(result_node, dict)
        else task.get("raw_findings", [])
    ) or []

    return {
        "task_id": task_id,
        "topic": task.get("topic", ""),
        "status": task.get("status", "unknown"),
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
        "platforms": task.get("platforms", []),
        "models": task.get("models", []),
        "summary": summary,
        "final_report_md": report_md,
        "consensus": {
            "providers": consensus.get("providers", []),
            "agreement_score": consensus.get("agreement_score", 0.0),
            "diversity_level": consensus.get("diversity_level", "low"),
            "warnings": consensus.get("warnings", []),
        },
        "attestation": {
            "provider": attestation.get("provider"),
            "method": attestation.get("method"),
            "status": attestation.get("status"),
            "attestation_id": attestation.get("attestation_id"),
            "input_hash": attestation.get("input_hash"),
            "signature": attestation.get("signature"),
            "generated_at": attestation.get("generated_at"),
        },
        "stats": {
            "source_count": len(findings),
        },
    }


def render_markdown_report(payload: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"# Trende Report: {payload.get('topic') or 'Untitled'}")
    lines.append("")
    lines.append(f"- Task ID: `{payload.get('task_id')}`")
    lines.append(f"- Status: `{payload.get('status')}`")
    lines.append(f"- Generated: `{_iso_to_human(payload.get('updated_at'))}`")
    lines.append(f"- Platforms: {', '.join(payload.get('platforms') or []) or 'n/a'}")
    lines.append(f"- Models: {', '.join(payload.get('models') or []) or 'n/a'}")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(payload.get("summary") or "No summary available.")
    lines.append("")
    lines.append("## Final Report")
    lines.append("")
    lines.append(payload.get("final_report_md") or "No markdown report available.")
    lines.append("")
    lines.append("## Consensus")
    lines.append("")
    consensus = payload.get("consensus") or {}
    lines.append(f"- Providers: {', '.join(consensus.get('providers') or []) or 'n/a'}")
    lines.append(f"- Agreement Score: {consensus.get('agreement_score', 0.0)}")
    lines.append(f"- Diversity: {consensus.get('diversity_level', 'n/a')}")
    warnings = consensus.get("warnings") or []
    lines.append(f"- Warnings: {', '.join(warnings) if warnings else 'none'}")
    lines.append("")
    lines.append("## Attestation")
    lines.append("")
    attestation = payload.get("attestation") or {}
    lines.append(f"- Provider: {attestation.get('provider') or 'n/a'}")
    lines.append(f"- Method: {attestation.get('method') or 'n/a'}")
    lines.append(f"- Status: {attestation.get('status') or 'n/a'}")
    lines.append(f"- Attestation ID: {attestation.get('attestation_id') or 'n/a'}")
    lines.append(f"- Input Hash: {attestation.get('input_hash') or 'n/a'}")
    lines.append(f"- Signature: {attestation.get('signature') or 'n/a'}")
    lines.append(f"- Generated At: {_iso_to_human(attestation.get('generated_at'))}")
    lines.append("")
    return "\n".join(lines)


def render_pdf_report(payload: dict[str, Any]) -> bytes:
    pdf = FPDF(unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    topic = _safe_text(payload.get("topic") or "Untitled")
    summary = _safe_text(payload.get("summary") or "No summary available.")
    report_md = _safe_text(payload.get("final_report_md") or "No markdown report available.")
    report_md = report_md[:30000]
    consensus = payload.get("consensus") or {}
    attestation = payload.get("attestation") or {}

    pdf.set_font("Helvetica", "B", 18)
    pdf.multi_cell(0, 10, f"Trende Report: {topic}")
    pdf.ln(1)

    pdf.set_font("Helvetica", "", 10)
    content_width = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Task ID: {payload.get('task_id')}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Generated: {_iso_to_human(payload.get('updated_at'))}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Platforms: {', '.join(payload.get('platforms') or []) or 'n/a'}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Models: {', '.join(payload.get('models') or []) or 'n/a'}")))
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 13)
    pdf.multi_cell(content_width, 8, "Summary")
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(summary))
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 13)
    pdf.multi_cell(content_width, 8, "Consensus")
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Providers: {', '.join(consensus.get('providers') or []) or 'n/a'}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Agreement Score: {consensus.get('agreement_score', 0.0)}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Diversity: {consensus.get('diversity_level', 'n/a')}")))
    warnings = consensus.get("warnings") or []
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Warnings: {', '.join(warnings) if warnings else 'none'}")))
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 13)
    pdf.multi_cell(content_width, 8, "Attestation")
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Provider: {attestation.get('provider') or 'n/a'}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Method: {attestation.get('method') or 'n/a'}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Status: {attestation.get('status') or 'n/a'}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Attestation ID: {attestation.get('attestation_id') or 'n/a'}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Input Hash: {attestation.get('input_hash') or 'n/a'}")))
    pdf.multi_cell(content_width, 6, _wrap_hard_tokens(_safe_text(f"Generated At: {_iso_to_human(attestation.get('generated_at'))}")))
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 13)
    pdf.multi_cell(content_width, 8, "Final Report (Markdown)")
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(content_width, 5, _wrap_hard_tokens(report_md, chunk=48))

    out = BytesIO()
    rendered = pdf.output(dest="S")
    if isinstance(rendered, str):
        out.write(rendered.encode("latin-1"))
    else:
        out.write(bytes(rendered))
    return out.getvalue()


def render_json_report(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
