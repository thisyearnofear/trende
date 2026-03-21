import datetime
import json
import re
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


def _section_title(pdf: FPDF, title: str) -> None:
    pdf.set_fill_color(16, 24, 40)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, _safe_text(title.upper()), ln=1, fill=True)
    pdf.set_text_color(20, 20, 20)
    pdf.ln(1)


def _key_value(pdf: FPDF, key: str, value: str, width: float) -> None:
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(35, 6, _safe_text(f"{key}:"))
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(width - 35, 6, _wrap_hard_tokens(_safe_text(value), chunk=40))


def _render_markdown_block(pdf: FPDF, markdown: str, width: float) -> None:
    lines = markdown.splitlines()
    for raw_line in lines:
        line = _safe_text(raw_line.rstrip())
        if not line:
            pdf.ln(2)
            continue

        if line.startswith("### "):
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(0, 71, 171)
            pdf.multi_cell(width, 6, _wrap_hard_tokens(line[4:], chunk=38))
            pdf.set_text_color(20, 20, 20)
            continue

        if line.startswith("## "):
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(7, 47, 90)
            pdf.multi_cell(width, 7, _wrap_hard_tokens(line[3:], chunk=38))
            pdf.set_text_color(20, 20, 20)
            continue

        if line.startswith("# "):
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(7, 47, 90)
            pdf.multi_cell(width, 8, _wrap_hard_tokens(line[2:], chunk=38))
            pdf.set_text_color(20, 20, 20)
            continue

        if re.match(r"^\s*[-*]\s+", line):
            cleaned = re.sub(r"^\s*[-*]\s+", "", line)
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(width, 5.5, _wrap_hard_tokens(f"- {cleaned}", chunk=40))
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(width, 5.5, _wrap_hard_tokens(line, chunk=40))
            continue

        if line.startswith("|") and line.endswith("|"):
            # Render markdown table rows in monospace for readability.
            if set(line.replace("|", "").strip()) == {"-"}:
                continue
            pdf.set_font("Courier", "", 8)
            pdf.multi_cell(width, 4.8, _wrap_hard_tokens(line, chunk=72))
            continue

        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(width, 5.5, _wrap_hard_tokens(line, chunk=42))


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
    lines.append("## Proof Manifest")
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

    content_width = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_fill_color(7, 47, 90)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 17)
    pdf.multi_cell(0, 11, f"TRENDE REPORT\n{topic}", fill=True)
    pdf.ln(1)

    pdf.set_text_color(20, 20, 20)
    _section_title(pdf, "Mission Metadata")
    _key_value(pdf, "Task ID", str(payload.get("task_id", "n/a")), content_width)
    _key_value(pdf, "Generated", _iso_to_human(payload.get("updated_at")), content_width)
    _key_value(pdf, "Platforms", ", ".join(payload.get("platforms") or []) or "n/a", content_width)
    _key_value(pdf, "Models", ", ".join(payload.get("models") or []) or "n/a", content_width)
    pdf.ln(2)

    _section_title(pdf, "Executive Summary")
    pdf.set_font("Helvetica", "", 10.5)
    pdf.multi_cell(content_width, 5.8, _wrap_hard_tokens(summary, chunk=42))
    pdf.ln(2)

    _section_title(pdf, "Consensus Signals")
    providers = ", ".join(consensus.get("providers") or []) or "n/a"
    _key_value(pdf, "Providers", providers, content_width)
    _key_value(pdf, "Agreement", str(consensus.get("agreement_score", 0.0)), content_width)
    _key_value(pdf, "Diversity", str(consensus.get("diversity_level", "n/a")), content_width)
    warnings = consensus.get("warnings") or []
    _key_value(pdf, "Warnings", ", ".join(warnings) if warnings else "none", content_width)
    pdf.ln(2)

    _section_title(pdf, "Proof Manifest")
    _key_value(pdf, "Provider", str(attestation.get("provider") or "n/a"), content_width)
    _key_value(pdf, "Method", str(attestation.get("method") or "n/a"), content_width)
    _key_value(pdf, "Status", str(attestation.get("status") or "n/a"), content_width)
    _key_value(pdf, "Attestation ID", str(attestation.get("attestation_id") or "n/a"), content_width)
    _key_value(pdf, "Input Hash", str(attestation.get("input_hash") or "n/a"), content_width)
    _key_value(pdf, "Generated At", _iso_to_human(attestation.get("generated_at")), content_width)
    pdf.ln(2)

    _section_title(pdf, "Full Intelligence Report")
    _render_markdown_block(pdf, report_md, content_width)

    out = BytesIO()
    rendered = pdf.output(dest="S")
    if isinstance(rendered, str):
        out.write(rendered.encode("latin-1"))
    else:
        out.write(bytes(rendered))
    return out.getvalue()


def render_json_report(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
