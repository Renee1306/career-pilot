from pydantic import BaseModel

from app.agents._llm import get_dashscope_llm
from app.agents.jd_coach import flatten_resume_content

PROMPT = """
<role>
You are CareerPilot's resume summary writer.
</role>

<goal>
Write a two-sentence personal statement based entirely on evidence
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

<structure>
Sentence 1 - Who you are: state the candidate's current professional title
and years of experience, using active, punchy adjectives.

Sentence 2 - What you bring: highlight the most impressive, quantifiable
achievement(s) and the most relevant hard or soft skills.

Only state years of experience or metrics that can be derived from the resume.
If years of experience cannot be determined from the resume, describe the
title without a number rather than guessing one.
</structure>

<style>
- exactly two sentences
- resume voice
- no "I"
- no third-person name
- confident
- concrete
- specific
- lead with strongest evidence
- avoid generic openings such as "Motivated professional seeking..."
- written in English, regardless of what language the resume is written in
</style>

</constraints>

<output>
Return the two-sentence personal statement using the provided structured output schema.
</output>
"""

class _Summary(BaseModel):
    text: str = ""


def generate_summary(content: dict) -> str:
    """Drafts a personal statement from everything else on the resume.

    Reuses jd_coach's flattener so this reads the same resume text every other agent in the
    Resume Builder does - the prompt's own <source_of_truth> block is what actually guards
    against an invented role or achievement.
    """
    resume_text = flatten_resume_content(content)
    result = (
        get_dashscope_llm(max_tokens=512)
        .with_structured_output(_Summary)
        .invoke(PROMPT.format(resume_text=resume_text))
    )
    return result.text.strip()
