from supabase import Client

from app.agents.interview_qna import generate_interview_qna
from app.models.interview import InterviewRoundCreate, InterviewRoundUpdate
from app.services import application_service, job_service, resume_service

TABLE = "interview_rounds"


def list_rounds_for_application(client: Client, user_id: str, application_id: str) -> list[dict]:
    res = (
        client.table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("application_id", application_id)
        .order("scheduled_at")
        .execute()
    )
    return res.data


def get_round(client: Client, user_id: str, round_id: str) -> dict | None:
    res = client.table(TABLE).select("*").eq("user_id", user_id).eq("id", round_id).maybe_single().execute()
    return res.data if res else None


def create_round(client: Client, user_id: str, payload: InterviewRoundCreate) -> dict:
    row = {"user_id": user_id, **payload.model_dump(exclude_none=True)}
    res = client.table(TABLE).insert(row).execute()
    return res.data[0]


def update_round(client: Client, user_id: str, round_id: str, payload: InterviewRoundUpdate) -> dict | None:
    updates = payload.model_dump(exclude_none=True)
    res = client.table(TABLE).update(updates).eq("user_id", user_id).eq("id", round_id).execute()
    return res.data[0] if res.data else None


def generate_qna_for_round(client: Client, user_id: str, round_id: str) -> dict:
    round_ = get_round(client, user_id, round_id)
    if round_ is None:
        raise ValueError("Interview round not found")

    application = application_service.get_application(client, user_id, round_["application_id"])
    if application is None:
        raise ValueError("Application not found")
    if not application.get("job_description_id"):
        raise ValueError("Application has no linked job description")
    if not application.get("resume_id"):
        raise ValueError("Application has no linked resume")

    job = job_service.get_job_description(client, user_id, application["job_description_id"])
    resume = resume_service.get_resume(client, user_id, application["resume_id"])
    if job is None or resume is None:
        raise ValueError("Linked job description or resume not found")

    qna = generate_interview_qna(job["raw_text"], resume.get("parsed_text") or "", round_["round_type"])

    res = (
        client.table(TABLE)
        .update({"generated_qna": qna.model_dump()})
        .eq("user_id", user_id)
        .eq("id", round_id)
        .execute()
    )
    return res.data[0]
