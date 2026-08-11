from app.agents._llm import get_llm
from app.models.job import ResumeMatch

PROMPT = """You are the Resume Match Agent for CareerPilot.

Compare the candidate's resume against the job posting and produce specific,
actionable edit suggestions.

For each suggestion:
- original_text must be copied EXACTLY, character-for-character, from the
  resume text below (a contiguous substring - a phrase, bullet, or sentence).
  Do not paraphrase or alter it in original_text.
- suggested_text is your proposed replacement for that exact span.
- reason briefly explains why this change would better match the job.

Focus on:
- Rewording bullets to use terminology from the job posting
- Quantifying achievements where the resume is vague
- Surfacing relevant experience that is present but under-emphasized

Never invent facts, dates, employers, or skills the resume doesn't support.

Also provide:
- match_score: 0-100 estimate of overall fit
- matched_skills: skills/requirements from the job the resume already covers
- missing_skills: important skills/requirements missing from the resume
- summary: a short paragraph summarizing the overall recommended changes
  and why they would improve the match

Only suggest edits to text that actually appears in the resume, verbatim.
Suggest at most 8 edits - focus on the highest-impact changes.

Job posting:
{job_text}

Resume:
{resume_text}
"""


def match_resume(job_text: str, resume_text: str) -> ResumeMatch:
    structured_llm = get_llm().with_structured_output(ResumeMatch)
    result = structured_llm.invoke(PROMPT.format(job_text=job_text, resume_text=resume_text))
    result.edits = [edit for edit in result.edits if edit.original_text in resume_text]
    return result
