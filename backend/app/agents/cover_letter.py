from pydantic import BaseModel

from app.agents._llm import get_dashscope_llm
from app.agents.jd_coach import flatten_resume_content

PROMPT = """
<role>
You are CareerPilot's cover letter writer.
</role>

<goal>
Write a cover letter for this candidate, tailored to the job description below, using only
experience already present on the resume.
</goal>

<input>
<company>
{company_clause}
</company>

<position>
{position_clause}
</position>

<job_description>
{jd_text}
</job_description>

<resume>
{resume_text}
</resume>
</input>

<constraints>

<source_of_truth>
The resume is the only source of truth for the candidate's experience.

Do not invent:
- roles
- skills
- technologies
- achievements
- metrics
- employers
- industries

Every claim about the candidate must trace back to something the resume actually says.
</source_of_truth>

<style>
- 3-4 short paragraphs
- opens by naming the role and, if known, the company - do not invent either
- connects 2-3 specific pieces of resume evidence directly to what the job description asks for
- confident and concrete - no "hard worker", "team player", or other generic filler
- do not praise the company beyond what's reasonable to say without inside knowledge
- closes with a direct, low-pressure call to action
- never use placeholder brackets like "[Company Name]" - if something is unknown, write around
  it instead of leaving a placeholder in the text
- written in English, regardless of what language the job description or resume is written in
</style>

</constraints>

<output>
Return the letter as one plain-text block using the provided structured output schema.
Use a blank line between paragraphs.
Start directly with the opening line - no date, no address block, no "Dear Hiring Manager"
salutation unless a specific name is known from the job description.
</output>
"""


class _CoverLetter(BaseModel):
    text: str = ""


def generate_cover_letter(content: dict, jd_text: str, company: str | None, position: str | None) -> str:
    """Drafts a cover letter grounded in the resume and tailored to the JD.

    Reuses jd_coach's flattener so a cover letter and a JD review read the identical resume text
    - the two only ever need to agree on what "the resume says" means.
    """
    resume_text = flatten_resume_content(content)
    result = (
        get_dashscope_llm(max_tokens=1024)
        .with_structured_output(_CoverLetter)
        .invoke(
            PROMPT.format(
                jd_text=jd_text,
                company_clause=(company or "").strip() or "(not specified - do not invent one)",
                position_clause=(position or "").strip()
                or "(not specified - infer only from the job description)",
                resume_text=resume_text,
            )
        )
    )
    return result.text.strip()
