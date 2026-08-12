import uuid

from supabase import Client

from app.agents.resume_parser import parse_resume
from app.models.resume import ResumeCreate

TABLE = "resumes"
BUCKET = "resumes"
SIGNED_URL_EXPIRY_SECONDS = 60 * 60


def _with_signed_url(client: Client, row: dict) -> dict:
    path = row.get("file_url")
    if path:
        signed = client.storage.from_(BUCKET).create_signed_url(path, SIGNED_URL_EXPIRY_SECONDS)
        row = {**row, "file_url": signed.get("signedURL") or signed.get("signedUrl")}
    return row


def list_resumes(client: Client, user_id: str) -> list[dict]:
    res = client.table(TABLE).select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    rows = res.data
    # One batched sign-urls call instead of one Storage round-trip per row - listing N
    # resumes used to mean N sequential HTTP calls to Supabase Storage just to build the
    # response, which dominated this endpoint's latency (~650ms/row observed).
    paths = [row["file_url"] for row in rows if row.get("file_url")]
    if not paths:
        return rows
    signed = client.storage.from_(BUCKET).create_signed_urls(paths, SIGNED_URL_EXPIRY_SECONDS)
    url_by_path = {item["path"]: item.get("signedURL") or item.get("signedUrl") for item in signed}
    return [{**row, "file_url": url_by_path.get(row["file_url"], row["file_url"])} if row.get("file_url") else row for row in rows]


def create_resume(client: Client, user_id: str, payload: ResumeCreate) -> dict:
    row = {"user_id": user_id, **payload.model_dump(exclude_none=True)}
    res = client.table(TABLE).insert(row).execute()
    return _with_signed_url(client, res.data[0])


def get_resume(client: Client, user_id: str, resume_id: str) -> dict | None:
    res = client.table(TABLE).select("*").eq("user_id", user_id).eq("id", resume_id).maybe_single().execute()
    if res is None or res.data is None:
        return None
    return _with_signed_url(client, res.data)


def upload_and_parse_resume(
    client: Client, user_id: str, filename: str, file_bytes: bytes, content_type: str, label: str | None
) -> dict:
    storage_path = f"{user_id}/{uuid.uuid4()}_{filename}"
    client.storage.from_(BUCKET).upload(storage_path, file_bytes, {"content-type": content_type})

    parsed = parse_resume(file_bytes, content_type)

    row = {
        "user_id": user_id,
        "label": label,
        "file_url": storage_path,
        "parsed_text": parsed.raw_text,
        "parsed_json": parsed.model_dump(exclude={"raw_text"}),
    }
    res = client.table(TABLE).insert(row).execute()
    return _with_signed_url(client, res.data[0])


