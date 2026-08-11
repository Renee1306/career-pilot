import io

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from xml.sax.saxutils import escape


def render_resume_pdf(text: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()
    body_style = styles["Normal"]

    flowables = []
    for paragraph in text.split("\n\n"):
        for line in paragraph.split("\n"):
            if line.strip():
                flowables.append(Paragraph(escape(line.strip()), body_style))
        flowables.append(Spacer(1, 10))

    doc.build(flowables)
    return buffer.getvalue()
