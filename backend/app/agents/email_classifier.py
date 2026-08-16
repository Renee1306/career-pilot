from app.agents._llm import get_dashscope_llm
from app.models.gmail_model import EmailClassification

MAX_CONCURRENT_CLASSIFICATIONS = 5


GMAIL_CLASSIFICATION_PROMPT = """
<role>
You are CareerPilot's Gmail Classification Agent.
</role>

<goal>
Determine whether this email is related to a job application submitted
by the recipient.

If it is job-related, extract the relevant application information and
timeline event.
</goal>

<input>
<subject>
{subject}
</subject>

<sender>
{sender}
</sender>

<body>
{body}
</body>
</input>

<classification>

<job_related>
Classify the email as job-related ONLY when it is clearly about a
specific job application submitted by the recipient.

Examples of job-related emails:
- application confirmation
- interview invitation
- interview scheduling
- assessment invitation
- case study
- offer
- rejection

Examples of non-job-related emails:
- newsletters
- marketing
- unrelated personal emails
- generic company announcements
- job advertisements that the recipient did not apply for
- recruiter outreach where there is no evidence of an existing application
</job_related>

<detected_status>
If job-related, classify the current application stage:

<applied>
Application confirmation or evidence that an application was received.
</applied>

<pending_interview>
Interview invitation, interview scheduling request, or assessment invitation.
</pending_interview>

<offer>
Job offer.
</offer>

<rejected>
Rejection or notice that the company is moving forward with other candidates.
</rejected>

If the email is job-related but the stage is unclear, return null.
</detected_status>

<entry_type>
Classify the timeline event represented by THIS email:

<applied>
Confirms an application was submitted or received.
</applied>

<rejected>
Rejection email.
</rejected>

<interview>
Interview invitation, confirmation, reminder, or scheduling email.
</interview>

<case_study>
Take-home assessment, technical exercise, or case study with a deadline.
</case_study>

<other>
Job-related email that does not fit the categories above.
</other>

If the email is not job-related, return null.
</entry_type>

</classification>

<extraction>

<company>
Extract the company name if identifiable.
Do not guess.
</company>

<role>
Extract the job title if identifiable.
Do not guess.
</role>

<summary>
Write one short plain-language sentence suitable for an application
timeline.

Examples:
- Recruiter reached out — scheduling technical screen.
- Received a rejection.
- Case study assigned, due in 5 days.

Leave empty if the email is not job-related.
</summary>

<event_at>
Extract an ISO 8601 datetime ONLY when the email explicitly states
a specific interview date and time.

Never guess or estimate.
</event_at>

<meeting_link>
Extract a meeting/video-call URL ONLY when one is explicitly present.

Otherwise return null.
</meeting_link>

<deadline>
Extract an ISO 8601 date or datetime ONLY when a submission deadline
is explicitly stated.

Otherwise return null.
</deadline>

</extraction>

<constraints>
<rule>Never guess dates or times.</rule>
<rule>Never invent a company or role.</rule>
<rule>Do not treat generic recruiting or marketing emails as applications.</rule>
<rule>Use only information contained in the email.</rule>
<rule>Leave uncertain fields null rather than guessing.</rule>
</constraints>

<output>
Return the result using the provided EmailClassification structured output schema.
</output>
"""


def classify_emails(emails: list[tuple[str, str, str]]) -> list[EmailClassification]:
    """Classifies multiple (subject, sender, body) emails, up to
    MAX_CONCURRENT_CLASSIFICATIONS at a time via LangChain's .batch() (each call is a
    blocking HTTP request, so this cuts wall-clock time roughly to ceil(n/5)
    call-durations instead of n). Order of results matches the order of `emails`."""
    if not emails:
        return []
    structured_llm = get_dashscope_llm().with_structured_output(EmailClassification)
    prompts = [GMAIL_CLASSIFICATION_PROMPT.format(subject=subject, sender=sender, body=body) for subject, sender, body in emails]
    return structured_llm.batch(prompts, config={"max_concurrency": MAX_CONCURRENT_CLASSIFICATIONS})
