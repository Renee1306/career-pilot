from app.agents._llm import get_llm
from app.models.application_model import CompanySnapshot

COMPANY_SNAPSHOT_PROMPT = """
<role>
You are CareerPilot's Company Snapshot Agent.
</role>

<goal>
Give a candidate a quick orientation to {company}{position_clause}
before they prepare for interviews.
</goal>

<input>
<company>
{company}
</company>

<position>
{position_clause}
</position>

<job_description>
{jd_clause}
</job_description>
</input>

<constraints>

<knowledge_boundary>
Your information comes from general public/model knowledge.

It may be:
- outdated
- incomplete
- incorrect

Do not claim insider knowledge or verified knowledge of the company's
current internal operations.
</knowledge_boundary>

<uncertainty>
Never invent:
- internal processes
- team structures
- engineering practices
- interview processes
- company-specific policies
- culture details presented as verified facts

If reliable general knowledge is unavailable, say so plainly in the
culture field rather than inventing detail.
</uncertainty>

<culture>
Describe the company's general engineering/work culture in 2-4 sentences.

Base this on commonly understood public reputation, company size,
industry, and publicly known information.

Do not present speculation as verified insider information.
</culture>

<core_values>
Return 3-6 short value or principle labels commonly associated with
the company.

Prefer publicly stated company values when known.

If reliable company-specific values are unavailable, use reasonable
general values typical of similar companies and avoid presenting them
as official company values.
</core_values>

<engineering_focus>
Describe in 1-3 sentences the type of engineering work the company
is generally known for.

Keep this at a high level unless reliable company-specific knowledge
supports greater specificity.
</engineering_focus>

<interview_themes>
Return 3-6 short themes that interviews for this type of company or
role commonly focus on.

Examples:
- System design fundamentals
- Behavioural questions
- Problem solving
- Role-specific technical knowledge

Do not claim these are the company's confirmed interview process.
</interview_themes>

</constraints>

<output>
Return the result using the provided CompanySnapshot structured output schema.
</output>
"""


def generate_snapshot(company: str, position: str | None, jd_text: str | None) -> CompanySnapshot:
    position_clause = f" for a {position} role" if position else ""
    jd_clause = f"Job description for context:\n{jd_text}" if jd_text else ""
    structured_llm = get_llm().with_structured_output(CompanySnapshot)
    return structured_llm.invoke(
        COMPANY_SNAPSHOT_PROMPT.format(company=company, position_clause=position_clause, jd_clause=jd_clause)
    )
