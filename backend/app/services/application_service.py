from datetime import datetime, timezone

from supabase import Client

from app.models.application import ApplicationCreate, ApplicationUpdate

TABLE = "applications"


def list_applications(client: Client, user_id: str) -> list[dict]:
    res = client.table(TABLE).select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data


def get_application(client: Client, user_id: str, application_id: str) -> dict | None:
    res = (
        client.table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("id", application_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create_application(client: Client, user_id: str, payload: ApplicationCreate) -> dict:
    row = {"user_id": user_id, **payload.model_dump(exclude_none=True)}
    res = client.table(TABLE).insert(row).execute()
    return res.data[0]


def update_application(client: Client, user_id: str, application_id: str, payload: ApplicationUpdate) -> dict | None:
    updates = payload.model_dump(exclude_none=True)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = (
        client.table(TABLE)
        .update(updates)
        .eq("user_id", user_id)
        .eq("id", application_id)
        .execute()
    )
    return res.data[0] if res.data else None


def add_timeline_entry(client: Client, user_id: str, application_id: str, note: str) -> dict | None:
    application = get_application(client, user_id, application_id)
    if application is None:
        return None

    entry = {"date": datetime.now(timezone.utc).isoformat(), "note": note}
    timeline = [*application.get("timeline", []), entry]

    res = (
        client.table(TABLE)
        .update({"timeline": timeline, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("user_id", user_id)
        .eq("id", application_id)
        .execute()
    )
    return res.data[0] if res.data else None
