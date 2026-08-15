from app.agents._llm import get_llm
from app.models.interview_model import InterviewQnA, QnARoundType

ROUND_FOCUS = {
    "behavioural": (
        "This is the behavioural round. Ask about how the candidate has actually worked with other "
        "people and handled real situations - ownership, conflict, failure, pressure, ambiguity, "
        "feedback, and motivation for this company specifically.\n\n"
        "Use the company snapshot below to make these questions specific to THIS employer rather "
        "than generic. If the snapshot says the company values fast shipping, ask about a time the "
        "candidate had to move quickly with incomplete information. If it describes a small team, "
        "ask about wearing multiple hats. If it names a regulated or safety-critical domain, ask "
        "about care and process. Where the snapshot is thin, fall back to well-known behavioural "
        "questions rather than inventing facts about the company.\n\n"
        "Do not ask deep technical questions here."
    ),
    "hiring_manager": (
        "This is the hiring manager round. The interviewer owns the team and the work, so they are "
        "judging whether this candidate can actually do THIS job. Ask about the candidate's past "
        "experience in depth, how their background maps onto the responsibilities in the job "
        "posting, the decisions and trade-offs they made, what they owned versus contributed to, "
        "and how they would approach the problems this role would hand them.\n\n"
        "Ground questions in specific things on the resume - a real project, a real technology, a "
        "real result - so the candidate can prepare concrete material. Include role-relevant "
        "technical depth where the posting calls for it, but not abstract trivia or puzzles."
    ),
}

PROMPT = """You are the Interview Prep Agent for CareerPilot.

Predict the questions this candidate is most likely to be asked in the round described below, and
for each one tell them how to build a strong answer.

CRITICAL - you are NOT writing answers for the candidate. Never produce a script, a sample answer,
or prose written in the candidate's voice. An answer they read out is an answer they cannot defend
when the interviewer follows up, and it will not sound like them. Your job is to prepare them to
answer in their own words.

For each question return:
- `question`: the question as an interviewer would actually phrase it.
- `answer_should_cover`: 2-4 short points the answer needs to hit to land well. These are
  instructions to the candidate about SHAPE and SUBSTANCE, not sentences to recite. Write them as
  "what to do" - "Name the specific metric that improved and by how much", "State the trade-off you
  rejected and why" - not as "I improved latency by 40%".
- `draw_on`: which specific thing on the candidate's resume they should build this answer from,
  named exactly as it appears there (e.g. "the Kerry chatbot project at Experian"). If the resume
  genuinely has nothing relevant, say what kind of example they should think of instead - never
  invent an experience they don't have.

Do not invent facts, employers, technologies, metrics or experience the resume doesn't support. If
the resume is thin on something the round will probe, that is worth surfacing: ask the question
anyway and tell them honestly in `answer_should_cover` that they need a real example ready, or to
be straightforward about the gap.

{round_focus}

Job posting:
{job_text}

Candidate's resume:
{resume_text}

Company snapshot (may be empty - if so, do not invent details about the company):
{company_context}
"""


def generate_interview_qna(
    job_text: str,
    resume_text: str,
    round_type: QnARoundType,
    company_context: str = "",
) -> InterviewQnA:
    structured_llm = get_llm().with_structured_output(InterviewQnA)
    prompt = PROMPT.format(
        round_focus=ROUND_FOCUS.get(round_type, ROUND_FOCUS["behavioural"]),
        job_text=job_text,
        resume_text=resume_text,
        company_context=company_context.strip() or "(no company snapshot available)",
    )
    return structured_llm.invoke(prompt)
