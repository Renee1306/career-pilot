from supabase import Client

from app.models.interview import InterviewRoundCreate, InterviewRoundUpdate

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


def create_round(client: Client, user_id: str, payload: InterviewRoundCreate) -> dict:
    row = {"user_id": user_id, **payload.model_dump(exclude_none=True)}
    res = client.table(TABLE).insert(row).execute()
    return res.data[0]


def update_round(client: Client, user_id: str, round_id: str, payload: InterviewRoundUpdate) -> dict | None:
    updates = payload.model_dump(exclude_none=True)
    res = client.table(TABLE).update(updates).eq("user_id", user_id).eq("id", round_id).execute()
    return res.data[0] if res.data else None
