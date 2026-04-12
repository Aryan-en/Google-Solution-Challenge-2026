"""PDF report generation for HireLens bias analysis."""

from io import BytesIO
from datetime import datetime, timezone

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


ACCENT = HexColor("#2563eb")
DANGER = HexColor("#ef4444")
SUCCESS = HexColor("#22c55e")
GRAY = HexColor("#64748b")
DARK = HexColor("#0f172a")
LIGHT_BG = HexColor("#f8fafc")
BORDER = HexColor("#e2e8f0")


def generate_pdf_report(
    bias_results: dict,
    explanation: dict | None = None,
    filename: str = "unknown",
) -> bytes:
    """Generate a PDF report and return bytes."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Title"],
        fontSize=22, textColor=DARK, spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle", parent=styles["Normal"],
        fontSize=11, textColor=GRAY, spaceAfter=20,
    )
    heading_style = ParagraphStyle(
        "SectionHeading", parent=styles["Heading2"],
        fontSize=14, textColor=ACCENT, spaceBefore=16, spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "ReportBody", parent=styles["Normal"],
        fontSize=10, textColor=DARK, leading=14, spaceAfter=6,
    )
    metric_label = ParagraphStyle(
        "MetricLabel", parent=styles["Normal"],
        fontSize=9, textColor=GRAY,
    )
    metric_value = ParagraphStyle(
        "MetricValue", parent=styles["Normal"],
        fontSize=18, textColor=DARK, leading=22,
    )

    elements = []

    # ── Header ──
    elements.append(Paragraph("HireLens - Bias Analysis Report", title_style))
    generated_at = datetime.now(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")
    elements.append(Paragraph(f"Generated {generated_at} &bull; Dataset: {filename}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=12))

    # ── Summary metrics ──
    elements.append(Paragraph("Summary", heading_style))

    di = bias_results.get("disparate_impact", 0)
    bias_detected = bias_results.get("bias_detected", False)
    status_text = "BIAS DETECTED" if bias_detected else "NO SIGNIFICANT BIAS"
    status_color = DANGER if bias_detected else SUCCESS

    summary_data = [
        [
            Paragraph("Disparate Impact", metric_label),
            Paragraph("Bias Status", metric_label),
            Paragraph("Threshold Used", metric_label),
        ],
        [
            Paragraph(f"<b>{di:.4f}</b>", metric_value),
            Paragraph(f"<b><font color='{status_color.hexval()}'>{status_text}</font></b>",
                       ParagraphStyle("s", parent=metric_value, fontSize=14)),
            Paragraph(f"<b>{bias_results.get('threshold_used', 0.5)}</b>", metric_value),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[2.3 * inch, 2.7 * inch, 2 * inch])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 12))

    di_note = "below" if di < 0.8 else "above"
    elements.append(Paragraph(
        f"The disparate impact ratio of <b>{di:.4f}</b> is {di_note} the EEOC 4/5ths threshold of 0.8000. "
        f"Analysis was performed on the <b>{bias_results.get('protected_column', '')}</b> attribute "
        f"against the <b>{bias_results.get('target_column', '')}</b> outcome.",
        body_style,
    ))

    # ── Group breakdown ──
    elements.append(Paragraph("Group Breakdown", heading_style))

    group_header = [
        Paragraph("<b>Group</b>", body_style),
        Paragraph("<b>Total</b>", body_style),
        Paragraph("<b>Hired</b>", body_style),
        Paragraph("<b>Selection Rate</b>", body_style),
    ]
    group_rows = [group_header]

    selection_rates = bias_results.get("selection_rates", {})
    group_counts = bias_results.get("group_counts", {})

    for group in bias_results.get("groups", []):
        counts = group_counts.get(group, {})
        rate = selection_rates.get(group, 0)
        group_rows.append([
            Paragraph(str(group).capitalize(), body_style),
            Paragraph(str(counts.get("total", 0)), body_style),
            Paragraph(str(counts.get("hired", 0)), body_style),
            Paragraph(f"{rate * 100:.1f}%", body_style),
        ])

    group_table = Table(group_rows, colWidths=[2 * inch, 1.5 * inch, 1.5 * inch, 2 * inch])
    group_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
        ("BACKGROUND", (0, 1), (-1, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(group_table)

    # ── AI Explanation (if available) ──
    if explanation:
        elements.append(Paragraph("AI Analysis (Gemini)", heading_style))

        if explanation.get("explanation"):
            elements.append(Paragraph("<b>Explanation</b>", body_style))
            elements.append(Paragraph(explanation["explanation"], body_style))
            elements.append(Spacer(1, 6))

        if explanation.get("reasoning"):
            elements.append(Paragraph("<b>Reasoning</b>", body_style))
            elements.append(Paragraph(explanation["reasoning"], body_style))
            elements.append(Spacer(1, 6))

        if explanation.get("suggestions"):
            elements.append(Paragraph("<b>Suggestions</b>", body_style))
            elements.append(Paragraph(explanation["suggestions"], body_style))

    # ── Footer ──
    elements.append(Spacer(1, 24))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8))
    elements.append(Paragraph(
        "This report was generated by HireLens. "
        "Disparate impact analysis uses the EEOC 4/5ths rule. "
        "AI explanations are generated by Google Gemini and should be reviewed by a qualified professional.",
        ParagraphStyle("Footer", parent=body_style, fontSize=8, textColor=GRAY),
    ))

    doc.build(elements)
    return buffer.getvalue()
