from app.agents._llm import get_llm
from app.models.interview import InterviewQnA, RoundType

ROUND_FOCUS = {
    "hr": (
        "This is an HR / recruiter screen. Focus on motivation, culture fit, availability, "
        "salary expectations, and general behavioral questions. Avoid deep technical questions."
    ),
    "hiring_manager": (
        "This is a hiring manager round. Focus on past experience, how the candidate's "
        "background maps to this role's responsibilities, ownership, and team fit. Include a "
        "mix of behavioral and role-relevant questions, but not deep technical trivia."
    ),
    "technical": (
        "This is a technical round. Focus on the skills and technologies mentioned in the job "
        "posting, and how the candidate's resume demonstrates them."
    ),
    "other": "Focus on general questions relevant to this stage of the interview process.",
}

PROMPT = """You are the Interview Prep Agent for CareerPilot.

Generate likely interview questions for the candidate's upcoming interview round, along
with a suggested answer for each, grounded in the candidate's actual resume. Do not invent
facts, employers, or experience the resume doesn't support - if the resume is thin on a
topic, suggest an honest, concise answer rather than fabricating detail.

{round_focus}

Job posting:
{job_text}

Candidate's resume:
{resume_text}
"""


def generate_interview_qna(job_text: str, resume_text: str, round_type: RoundType) -> InterviewQnA:
    structured_llm = get_llm().with_structured_output(InterviewQnA)
    prompt = PROMPT.format(
        round_focus=ROUND_FOCUS.get(round_type, ROUND_FOCUS["other"]),
        job_text=job_text,
        resume_text=resume_text,
    )
    return structured_llm.invoke(prompt)
