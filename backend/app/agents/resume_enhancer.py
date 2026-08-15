from app.agents._llm import get_openrouter_llm
from app.models.resume_document_model import EnhanceTextResponse

PROMPT = """You are the Resume Enhance Agent for CareerPilot.

Rewrite the given resume text to be clearer, more impactful, and more
professionally worded. Prefer strong action verbs and, where the text
already implies a measurable outcome, make it concrete.

Never invent facts: do not add employers, dates, titles, technologies,
metrics, or achievements that are not already present or clearly implied
in the given text. If the text is thin, tighten the wording rather than
padding it with invented specifics.

{context_line}
Text to improve:
{text}
"""


def enhance_text(text: str, context: str | None = None) -> str:
    structured_llm = get_openrouter_llm().with_structured_output(EnhanceTextResponse)
    context_line = f"Context: {context}\n" if context else ""
    result = structured_llm.invoke(PROMPT.format(context_line=context_line, text=text))
    return result.text
