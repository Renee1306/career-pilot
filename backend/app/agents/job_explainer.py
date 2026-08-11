from app.agents._llm import get_llm
from app.models.job import JobExplanation

PROMPT = (
    "Explain the following job posting in plain, easy to understand language, as if "
    "explaining it to someone unfamiliar with the industry. Use concrete, relatable "
    "examples rather than jargon.\n\nJob posting:\n{raw_text}"
)


def explain_job(raw_text: str) -> JobExplanation:
    structured_llm = get_llm().with_structured_output(JobExplanation)
    return structured_llm.invoke(PROMPT.format(raw_text=raw_text))
