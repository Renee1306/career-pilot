from app.agents._llm import get_llm
from app.models.job import ResumeMatch

PROMPT = (
    "Compare the following resume against the job posting. Estimate how well the "
    "resume matches (0-100), list the skills from the job that the resume already "
    "covers, list important skills/requirements from the job that are missing from "
    "the resume, and give concrete, actionable suggestions for how to edit the resume "
    "to better match this job (e.g. rewording a bullet, adding a missing skill, "
    "quantifying an achievement).\n\n"
    "Job posting:\n{job_text}\n\nResume:\n{resume_text}"
)


def match_resume(job_text: str, resume_text: str) -> ResumeMatch:
    structured_llm = get_llm().with_structured_output(ResumeMatch)
    return structured_llm.invoke(PROMPT.format(job_text=job_text, resume_text=resume_text))
