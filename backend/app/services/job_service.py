from supabase import Client

from app.models.job import JobDescriptionCreate

JOBS_TABLE = "job_descriptions"
ANALYSES_TABLE = "job_analyses"


def list_job_descriptions(client: Client, user_id: str) -> list[dict]:
    res = (
        client.table(JOBS_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


def create_job_description(client: Client, user_id: str, payload: JobDescriptionCreate) -> dict:
    row = {"user_id": user_id, **payload.model_dump(exclude_none=True)}
    res = client.table(JOBS_TABLE).insert(row).execute()
    return res.data[0]


def get_job_description(client: Client, user_id: str, job_id: str) -> dict | None:
    res = (
        client.table(JOBS_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("id", job_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def list_analyses_for_job(client: Client, user_id: str, job_id: str) -> list[dict]:
    res = (
        client.table(ANALYSES_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("job_description_id", job_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data
