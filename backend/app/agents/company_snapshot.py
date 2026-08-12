from app.agents._llm import get_llm
from app.models.application import CompanySnapshot

PROMPT = """You are the Company Snapshot Agent for CareerPilot.

Give a candidate a quick orientation to {company}{position_clause} before they prepare for
interviews there.

IMPORTANT: This reflects general public/model knowledge about {company}, not verified insider
information — it may be outdated, incomplete, or wrong. Never invent specific internal processes,
never claim insider knowledge, and never state anything as certain fact about how the company
currently operates. If you genuinely don't have reliable general knowledge about this company,
say so plainly in the culture field rather than inventing detail.

Produce:
- culture: 2-4 sentences on the company's general engineering/work culture, as commonly understood
  publicly (e.g. from its reputation, size, industry) — not verified insider detail.
- core_values: 3-6 short value/principle labels commonly associated with the company (e.g. from
  its publicly stated values), or general values typical of similar companies if none are
  well-known.
- engineering_focus: 1-3 sentences on what kind of engineering work this company is generally known
  for.
- interview_themes: 3-6 short bullet points on what interviews at this kind of company commonly
  focus on (e.g. "System design fundamentals", "Behavioral questions in STAR format").

{jd_clause}

Company: {company}
"""


def generate_snapshot(company: str, position: str | None, jd_text: str | None) -> CompanySnapshot:
    position_clause = f" for a {position} role" if position else ""
    jd_clause = f"Job description for context:\n{jd_text}" if jd_text else ""
    structured_llm = get_llm().with_structured_output(CompanySnapshot)
    return structured_llm.invoke(
        PROMPT.format(company=company, position_clause=position_clause, jd_clause=jd_clause)
    )
