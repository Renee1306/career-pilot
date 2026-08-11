from app.agents._llm import get_llm
from app.models.gmail import EmailClassification

PROMPT = """You are the Gmail Classification Agent for CareerPilot.

Determine whether the following email is related to a job application the recipient
submitted (e.g. an application confirmation, an interview invite/scheduling email, an offer,
or a rejection). Most emails will NOT be job-related - newsletters, unrelated personal email,
marketing, etc. Only classify as job-related if it's clearly about a specific application the
recipient made.

If it is job-related, extract the company name and role/job title if identifiable, and
classify which stage it suggests:
- "applied": an application confirmation ("we received your application")
- "pending_interview": an interview invite, scheduling request, or assessment invite
- "offer": a job offer
- "rejected": a rejection / "moving forward with other candidates"
Leave detected_status null if the email is job-related but doesn't clearly indicate a stage.

Subject: {subject}
From: {sender}
Body/snippet:
{body}
"""


def classify_email(subject: str, sender: str, body: str) -> EmailClassification:
    structured_llm = get_llm().with_structured_output(EmailClassification)
    return structured_llm.invoke(PROMPT.format(subject=subject, sender=sender, body=body))
