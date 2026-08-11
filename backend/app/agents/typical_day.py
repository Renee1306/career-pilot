from app.agents._llm import get_llm
from app.models.job import TypicalDay

PROMPT = (
    "Based on the following job posting, describe what a typical work day looks like "
    "for someone in this role. Break it into a few time blocks (e.g. morning, midday, "
    "afternoon) with the activities that usually happen in each. Be concrete and "
    "realistic rather than generic.\n\nJob posting:\n{raw_text}"
)


def generate_typical_day(raw_text: str) -> TypicalDay:
    structured_llm = get_llm().with_structured_output(TypicalDay)
    return structured_llm.invoke(PROMPT.format(raw_text=raw_text))
