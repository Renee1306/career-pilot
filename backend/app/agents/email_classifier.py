from app.agents._llm import get_llm
from app.models.gmail_model import EmailClassification

PROMPT = """You are the Gmail Classification Agent for CareerPilot.

Determine whether the following email is related to a job application the recipient
submitted (e.g. an application confirmation, an interview invite/scheduling email, a case-study
or assessment invite, an offer, or a rejection). Most emails will NOT be job-related - newsletters,
unrelated personal email, marketing, etc. Only classify as job-related if it's clearly about a
specific application the recipient made.

If it is job-related, extract the company name and role/job title if identifiable, and:

1. classify `detected_status` - which application stage this suggests:
   - "applied": an application confirmation ("we received your application")
   - "pending_interview": an interview invite, scheduling request, or assessment invite
   - "offer": a job offer
   - "rejected": a rejection / "moving forward with other candidates"
   Leave null if the email is job-related but doesn't clearly indicate a stage.

2. classify `entry_type` - what kind of timeline event this specific email represents:
   - "applied": confirms an application was submitted/received
   - "rejected": a rejection
   - "interview": an interview invite, confirmation, reminder, or scheduling email
   - "case_study": a take-home assessment, technical exercise, or case study with a deadline
   - "other": job-related but doesn't fit the above
   Leave null if not job-related.

3. write `summary` - one short, plain sentence describing what this email says, suitable for a
   timeline entry (e.g. "Recruiter reached out — scheduling technical screen." or "Received a
   rejection." or "Case study assigned, due in 5 days."). Leave empty if not job-related.

4. extract `event_at` (ISO 8601 datetime) ONLY if the email states a specific interview date/time.
   Extract `meeting_link` ONLY if a video-call/meeting URL is present. Extract `deadline` (ISO 8601
   date/datetime) ONLY if a submission deadline is stated (typically for case_study emails). Leave
   any of these null if not clearly stated in the email - never guess or estimate a date/time.

Subject: {subject}
From: {sender}
Body:
{body}
"""


def classify_email(subject: str, sender: str, body: str) -> EmailClassification:
    structured_llm = get_llm().with_structured_output(EmailClassification)
    return structured_llm.invoke(PROMPT.format(subject=subject, sender=sender, body=body))


MAX_CONCURRENT_CLASSIFICATIONS = 5


def classify_emails(emails: list[tuple[str, str, str]]) -> list[EmailClassification]:
    """Classifies multiple (subject, sender, body) emails, up to
    MAX_CONCURRENT_CLASSIFICATIONS at a time via LangChain's .batch() (each call is a
    blocking Gemini HTTP request, so this cuts wall-clock time roughly to ceil(n/5)
    call-durations instead of n). Order of results matches the order of `emails`."""
    if not emails:
        return []
    structured_llm = get_llm().with_structured_output(EmailClassification)
    prompts = [PROMPT.format(subject=subject, sender=sender, body=body) for subject, sender, body in emails]
    return structured_llm.batch(prompts, config={"max_concurrency": MAX_CONCURRENT_CLASSIFICATIONS})
