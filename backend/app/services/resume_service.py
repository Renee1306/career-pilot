from supabase import Client

from app.models.resume import ResumeCreate

TABLE = "resumes"


def list_resumes(client: Client, user_id: str) -> list[dict]:
    res = client.table(TABLE).select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data


def create_resume(client: Client, user_id: str, payload: ResumeCreate) -> dict:
    row = {"user_id": user_id, **payload.model_dump(exclude_none=True)}
    res = client.table(TABLE).insert(row).execute()
    return res.data[0]


def get_resume(client: Client, user_id: str, resume_id: str) -> dict | None:
    res = client.table(TABLE).select("*").eq("user_id", user_id).eq("id", resume_id).maybe_single().execute()
    return res.data if res else None
