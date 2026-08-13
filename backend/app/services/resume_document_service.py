import uuid
from datetime import datetime, timezone

from supabase import Client

from app.agents import resume_customizer, resume_enhancer, resume_importer
from app.models.resume_document import (
    JDMatchEvaluation,
    JDSuggestions,
    ResumeContent,
    ResumeDocumentCreate,
    ResumeDocumentUpdate,
    ResumeStyle,
)

TABLE = "resume_documents"
BUCKET = "resume-photos"
SIGNED_URL_EXPIRY_SECONDS = 60 * 60
LIST_COLUMNS = "id,user_id,name,template_id,photo_url,created_at,updated_at"


def _with_signed_url(client: Client, row: dict) -> dict:
    path = row.get("photo_url")
    if path:
        signed = client.storage.from_(BUCKET).create_signed_url(path, SIGNED_URL_EXPIRY_SECONDS)
        row = {**row, "photo_url": signed.get("signedURL") or signed.get("signedUrl")}
    return row


def list_resume_documents(client: Client, user_id: str) -> list[dict]:
    res = (
        client.table(TABLE)
        .select(LIST_COLUMNS)
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    rows = res.data
    # Batched sign-urls call instead of one Storage round-trip per row - see resume_service
    # .list_resumes for the same fix and why it matters.
    paths = [row["photo_url"] for row in rows if row.get("photo_url")]
    if not paths:
        return rows
    signed = client.storage.from_(BUCKET).create_signed_urls(paths, SIGNED_URL_EXPIRY_SECONDS)
    url_by_path = {item["path"]: item.get("signedURL") or item.get("signedUrl") for item in signed}
    return [
        {**row, "photo_url": url_by_path.get(row["photo_url"], row["photo_url"])} if row.get("photo_url") else row
        for row in rows
    ]


def create_resume_document(client: Client, user_id: str, payload: ResumeDocumentCreate) -> dict:
    row = {
        "user_id": user_id,
        "name": payload.name,
        "template_id": payload.template_id,
        "content": ResumeContent().model_dump(),
        "style": ResumeStyle().model_dump(),
    }
    res = client.table(TABLE).insert(row).execute()
    return _with_signed_url(client, res.data[0])


def _name_from_filename(filename: str) -> str:
    # Strip any directory prefix a browser might send (Windows and POSIX separators both) and the
    # extension, so "C:\\Users\\me\\Jane Doe CV.pdf" becomes "Jane Doe CV".
    stem = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if "." in stem:
        stem = stem.rsplit(".", 1)[0]
    return stem.strip()


def import_resume_document(
    client: Client, user_id: str, filename: str, file_bytes: bytes, content_type: str
) -> dict:
    content = resume_importer.import_resume(file_bytes, content_type)
    name = _name_from_filename(filename) or content.basic_info.full_name.strip() or "Imported Resume"
    row = {
        "user_id": user_id,
        "name": name,
        "template_id": ResumeDocumentCreate().template_id,
        "content": content.model_dump(),
        "style": ResumeStyle().model_dump(),
    }
    res = client.table(TABLE).insert(row).execute()
    return _with_signed_url(client, res.data[0])


def get_resume_document(client: Client, user_id: str, doc_id: str) -> dict | None:
    res = client.table(TABLE).select("*").eq("user_id", user_id).eq("id", doc_id).maybe_single().execute()
    if res is None or res.data is None:
        return None
    return _with_signed_url(client, res.data)


def update_resume_document(
    client: Client, user_id: str, doc_id: str, payload: ResumeDocumentUpdate
) -> dict | None:
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return get_resume_document(client, user_id, doc_id)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = client.table(TABLE).update(updates).eq("user_id", user_id).eq("id", doc_id).execute()
    return _with_signed_url(client, res.data[0]) if res.data else None


def delete_resume_document(client: Client, user_id: str, doc_id: str) -> bool:
    existing = (
        client.table(TABLE)
        .select("photo_url")
        .eq("user_id", user_id)
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )
    if existing is None or existing.data is None:
        return False
    if existing.data.get("photo_url"):
        client.storage.from_(BUCKET).remove([existing.data["photo_url"]])
    client.table(TABLE).delete().eq("user_id", user_id).eq("id", doc_id).execute()
    return True


def duplicate_resume_document(client: Client, user_id: str, doc_id: str) -> dict | None:
    # Photo is intentionally NOT copied - two rows sharing one storage path would mean
    # deleting either resume (or replacing either photo) silently breaks the other's image.
    source = (
        client.table(TABLE)
        .select("name,template_id,content,style")
        .eq("user_id", user_id)
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )
    if source is None or source.data is None:
        return None
    row = {
        "user_id": user_id,
        "name": f"{source.data['name']} (copy)",
        "template_id": source.data["template_id"],
        "content": source.data["content"],
        "style": source.data["style"],
    }
    res = client.table(TABLE).insert(row).execute()
    return _with_signed_url(client, res.data[0])


def upload_photo(
    client: Client, user_id: str, doc_id: str, filename: str, file_bytes: bytes, content_type: str
) -> dict | None:
    existing = (
        client.table(TABLE)
        .select("photo_url")
        .eq("user_id", user_id)
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )
    if existing is None or existing.data is None:
        return None

    storage_path = f"{user_id}/{doc_id}/{uuid.uuid4()}_{filename}"
    client.storage.from_(BUCKET).upload(storage_path, file_bytes, {"content-type": content_type})

    old_path = existing.data.get("photo_url")
    if old_path:
        client.storage.from_(BUCKET).remove([old_path])

    res = (
        client.table(TABLE)
        .update({"photo_url": storage_path, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("user_id", user_id)
        .eq("id", doc_id)
        .execute()
    )
    return _with_signed_url(client, res.data[0]) if res.data else None


def remove_photo(client: Client, user_id: str, doc_id: str) -> dict | None:
    existing = (
        client.table(TABLE)
        .select("photo_url")
        .eq("user_id", user_id)
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )
    if existing is None or existing.data is None:
        return None
    if existing.data.get("photo_url"):
        client.storage.from_(BUCKET).remove([existing.data["photo_url"]])

    res = (
        client.table(TABLE)
        .update({"photo_url": None, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("user_id", user_id)
        .eq("id", doc_id)
        .execute()
    )
    return _with_signed_url(client, res.data[0]) if res.data else None


def enhance_text(text: str, context: str | None = None) -> str:
    return resume_enhancer.enhance_text(text, context)


def evaluate_jd_match(client: Client, user_id: str, doc_id: str, jd_text: str) -> JDMatchEvaluation | None:
    doc = get_resume_document(client, user_id, doc_id)
    if doc is None:
        return None
    return resume_customizer.evaluate_match(doc["content"], jd_text)


def suggest_jd_edits(client: Client, user_id: str, doc_id: str, jd_text: str) -> JDSuggestions | None:
    doc = get_resume_document(client, user_id, doc_id)
    if doc is None:
        return None
    return JDSuggestions(suggestions=resume_customizer.suggest_edits(doc["content"], jd_text))


def customize_for_jd(client: Client, user_id: str, doc_id: str, jd_text: str) -> dict | None:
    source = (
        client.table(TABLE)
        .select("name,template_id,content,style")
        .eq("user_id", user_id)
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )
    if source is None or source.data is None:
        return None
    # Photo is intentionally NOT copied - see duplicate_resume_document's note above.
    new_content = resume_customizer.customize_content(source.data["content"], jd_text)
    row = {
        "user_id": user_id,
        "name": f"{source.data['name']} (JD tailored)",
        "template_id": source.data["template_id"],
        "content": new_content,
        "style": source.data["style"],
    }
    res = client.table(TABLE).insert(row).execute()
    return _with_signed_url(client, res.data[0])
