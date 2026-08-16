from pydantic import BaseModel

from app.agents._llm import get_dashscope_llm
from app.agents.jd_coach import NO_INVENTION_RULE, flatten_resume_content

PROMPT = """
<role>
You are CareerPilot's resume summary writer.
</role>

<goal>
Write a one-sentence personal statement based entirely on evidence
already present in the candidate's resume.
</goal>

<input>
<resume>
{resume_text}
</resume>
</input>

<constraints>

<source_of_truth>
The resume is the only source of truth.

Do not invent:
- roles
- skills
- technologies
- achievements
- metrics
- industries
- target positions
- companies
</source_of_truth>

<style>
- one sentence
- resume voice
- no "I"
- no third-person name
- confident
- concrete
- specific
- lead with strongest evidence
- avoid generic openings such as "Motivated professional seeking..."
</style>

</constraints>

<output>
Return one personal statement using the provided structured output schema.
</output>
"""

class _Summary(BaseModel):
    text: str = ""


def generate_summary(content: dict) -> str:
    """Drafts a personal statement from everything else on the resume.

    Reuses jd_coach's grounding rule and flattener rather than duplicating them: a generated
    summary that invents a role or achievement is exactly the failure mode the JD coach's
    no-invention rule already exists to prevent, so there is no reason for this to have its own,
    possibly-drifted copy of that rule.
    """
    resume_text = flatten_resume_content(content)
    result = (
        get_dashscope_llm(max_tokens=512)
        .with_structured_output(_Summary)
        .invoke(PROMPT.format(no_invention_rule=NO_INVENTION_RULE, resume_text=resume_text))
    )
    return result.text.strip()
