from datetime import datetime, timezone

from supabase import Client

from app.agents import company_snapshot as company_snapshot_agent
from app.agents import interview_qna, jd_coach
from app.models.application_model import ApplicationCreate, ApplicationUpdate, TimelineEntryCreate, TimelineEntryUpdate
from app.services import job_service, resume_document_service, resume_service

TABLE = "applications"
TIMELINE_TABLE = "application_timeline_entries"
ATTACHMENTS_BUCKET = "application-attachments"
SIGNED_URL_EXPIRY_SECONDS = 60 * 60


def _sign_attachments(client: Client, details: dict) -> dict:
    attachments = details.get("attachments")
    if not attachments:
        return details
    signed_attachments = []
    for attachment in attachments:
        path = attachment.get("storage_path")
        if not path:
            signed_attachments.append(attachment)
            continue
        signed = client.storage.from_(ATTACHMENTS_BUCKET).create_signed_url(path, SIGNED_URL_EXPIRY_SECONDS)
        url = signed.get("signedURL") or signed.get("signedUrl")
        signed_attachments.append({**attachment, "url": url})
    return {**details, "attachments": signed_attachments}


def _list_timeline_entries(client: Client, user_id: str, application_id: str) -> list[dict]:
    res = (
        client.table(TIMELINE_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("application_id", application_id)
        .order("occurred_at", desc=True)
        .execute()
    )
    return [{**row, "details": _sign_attachments(client, row.get("details") or {})} for row in res.data]


def _with_timeline(client: Client, user_id: str, application: dict) -> dict:
    return {**application, "timeline": _list_timeline_entries(client, user_id, application["id"])}


def _batch_sign_attachments(client: Client, entries: list[dict]) -> None:
    """Mutates `entries` in place, signing every attachment across all of them with a
    single Storage API call instead of one per attachment (which itself was nested inside
    one query per application - see list_applications)."""
    paths = [
        attachment["storage_path"]
        for entry in entries
        for attachment in (entry.get("details") or {}).get("attachments") or []
        if attachment.get("storage_path")
    ]
    if not paths:
        return
    signed = client.storage.from_(ATTACHMENTS_BUCKET).create_signed_urls(paths, SIGNED_URL_EXPIRY_SECONDS)
    url_by_path = {item["path"]: item.get("signedURL") or item.get("signedUrl") for item in signed}
    for entry in entries:
        details = entry.get("details") or {}
        attachments = details.get("attachments")
        if not attachments:
            continue
        entry["details"] = {
            **details,
            "attachments": [
                {**a, "url": url_by_path.get(a["storage_path"], None)} if a.get("storage_path") else a
                for a in attachments
            ],
        }


def list_applications(client: Client, user_id: str) -> list[dict]:
    apps = client.table(TABLE).select("*").eq("user_id", user_id).order("created_at", desc=True).execute().data
    if not apps:
        return []

    # One query for every timeline entry across all applications (RLS already scopes it to
    # this user) instead of one query per application, plus one batched sign-urls call
    # instead of one per attachment - collapses what used to be 1 + N + (attachments) round
    # trips into 3 total, regardless of how many applications/entries/attachments exist.
    entries = (
        client.table(TIMELINE_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .order("occurred_at", desc=True)
        .execute()
        .data
    )
    _batch_sign_attachments(client, entries)

    entries_by_app: dict[str, list[dict]] = {}
    for entry in entries:
        entries_by_app.setdefault(entry["application_id"], []).append(entry)

    return [{**app, "timeline": entries_by_app.get(app["id"], [])} for app in apps]


def get_application(client: Client, user_id: str, application_id: str) -> dict | None:
    res = (
        client.table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("id", application_id)
        .maybe_single()
        .execute()
    )
    if res is None or res.data is None:
        return None
    return _with_timeline(client, user_id, res.data)


def create_application(client: Client, user_id: str, payload: ApplicationCreate) -> dict:
    row = {"user_id": user_id, **payload.model_dump(exclude_none=True)}
    res = client.table(TABLE).insert(row).execute()
    return _with_timeline(client, user_id, res.data[0])


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
    if not res.data:
        return None
    return _with_timeline(client, user_id, res.data[0])


def delete_application(client: Client, user_id: str, application_id: str) -> bool:
    existing = (
        client.table(TABLE)
        .select("id")
        .eq("user_id", user_id)
        .eq("id", application_id)
        .maybe_single()
        .execute()
    )
    if existing is None or existing.data is None:
        return False

    # Timeline rows cascade-delete at the DB level (FK ON DELETE CASCADE), but their
    # case-study PDF attachments live in Storage, which isn't covered by that cascade -
    # clean those up first so they don't become orphaned objects.
    timeline_res = (
        client.table(TIMELINE_TABLE)
        .select("details")
        .eq("user_id", user_id)
        .eq("application_id", application_id)
        .execute()
    )
    attachment_paths = [
        attachment["storage_path"]
        for row in timeline_res.data
        for attachment in (row.get("details") or {}).get("attachments", [])
        if attachment.get("storage_path")
    ]
    if attachment_paths:
        client.storage.from_(ATTACHMENTS_BUCKET).remove(attachment_paths)

    client.table(TABLE).delete().eq("user_id", user_id).eq("id", application_id).execute()
    return True


def set_company_snapshot(client: Client, user_id: str, application_id: str, snapshot: dict) -> dict | None:
    res = (
        client.table(TABLE)
        .update({"company_snapshot": snapshot, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("user_id", user_id)
        .eq("id", application_id)
        .execute()
    )
    if not res.data:
        return None
    return _with_timeline(client, user_id, res.data[0])


def generate_company_snapshot(client: Client, user_id: str, application_id: str) -> dict | None:
    application = get_application(client, user_id, application_id)
    if application is None:
        return None

    jd_text = None
    if application.get("job_description_id"):
        job = job_service.get_job_description(client, user_id, application["job_description_id"])
        if job:
            jd_text = job.get("raw_text")

    company = application.get("company") or "this company"
    snapshot = company_snapshot_agent.generate_snapshot(company, application.get("position"), jd_text)
    return set_company_snapshot(client, user_id, application_id, snapshot.model_dump())


def _format_company_snapshot(snapshot: dict | None) -> str:
    """Flatten a stored company snapshot into prose for the behavioural round's prompt.

    Written generically over whatever keys the snapshot happens to carry rather than against a
    fixed field list, so a change to the snapshot agent's schema widens what the interview prep
    knows about instead of silently dropping it.
    """
    if not snapshot:
        return ""
    lines: list[str] = []
    for key, value in snapshot.items():
        if not value:
            continue
        label = key.replace("_", " ").capitalize()
        if isinstance(value, list):
            rendered = "; ".join(str(v) for v in value if v)
        elif isinstance(value, dict):
            continue
        else:
            rendered = str(value)
        if rendered.strip():
            lines.append(f"{label}: {rendered}")
    return "\n".join(lines)


def generate_interview_questions(
    client: Client,
    user_id: str,
    application_id: str,
    round_type: str,
    jd_text: str | None,
    resume_document_id: str | None = None,
) -> dict | None:
    """Grounded in whatever JD text is available: the pasted `jd_text` wins, otherwise the
    application's linked job description. Falls back to company/position alone if neither exists,
    so an application created by Gmail sync (which never gets a linked JD) still works.

    Resume grounding prefers an explicitly chosen Resume Builder document - that is the resume the
    candidate is actually sending - and falls back to the uploaded file linked to the application.
    """
    application = get_application(client, user_id, application_id)
    if application is None:
        return None

    job_text = (jd_text or "").strip()
    if not job_text and application.get("job_description_id"):
        job = job_service.get_job_description(client, user_id, application["job_description_id"])
        if job:
            job_text = job.get("raw_text") or ""
    if not job_text:
        company = application.get("company") or "the company"
        position = application.get("position") or "this role"
        job_text = f"Role: {position} at {company}. No full job description was provided."

    resume_text = ""
    if resume_document_id:
        doc = resume_document_service.get_resume_document(client, user_id, resume_document_id)
        if doc:
            resume_text = jd_coach.flatten_resume_content(doc["content"])
    if not resume_text and application.get("resume_id"):
        resume = resume_service.get_resume(client, user_id, application["resume_id"])
        if resume:
            resume_text = resume.get("parsed_text") or ""

    qna = interview_qna.generate_interview_qna(
        job_text,
        resume_text,
        round_type,
        company_context=_format_company_snapshot(application.get("company_snapshot")),
    )
    merged = {**(application.get("interview_questions") or {}), round_type: qna.model_dump()}
    res = (
        client.table(TABLE)
        .update({"interview_questions": merged, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("user_id", user_id)
        .eq("id", application_id)
        .execute()
    )
    if not res.data:
        return None
    return _with_timeline(client, user_id, res.data[0])


def create_timeline_entry(
    client: Client, user_id: str, application_id: str, payload: TimelineEntryCreate
) -> dict | None:
    application = get_application(client, user_id, application_id)
    if application is None:
        return None

    row = {
        "application_id": application_id,
        "user_id": user_id,
        "entry_type": payload.entry_type,
        "content": payload.content,
        "details": payload.details,
    }
    if payload.occurred_at is not None:
        row["occurred_at"] = payload.occurred_at.isoformat()

    client.table(TIMELINE_TABLE).insert(row).execute()
    return get_application(client, user_id, application_id)


def update_timeline_entry(
    client: Client, user_id: str, application_id: str, entry_id: str, payload: TimelineEntryUpdate
) -> dict | None:
    updates = payload.model_dump(exclude_none=True)
    if "occurred_at" in updates:
        updates["occurred_at"] = payload.occurred_at.isoformat()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = (
        client.table(TIMELINE_TABLE)
        .update(updates)
        .eq("user_id", user_id)
        .eq("application_id", application_id)
        .eq("id", entry_id)
        .execute()
    )
    if not res.data:
        return None
    return get_application(client, user_id, application_id)


def delete_timeline_entry(client: Client, user_id: str, application_id: str, entry_id: str) -> dict | None:
    existing = (
        client.table(TIMELINE_TABLE)
        .select("id")
        .eq("user_id", user_id)
        .eq("application_id", application_id)
        .eq("id", entry_id)
        .maybe_single()
        .execute()
    )
    if existing is None or existing.data is None:
        return None
    client.table(TIMELINE_TABLE).delete().eq("user_id", user_id).eq("id", entry_id).execute()
    return get_application(client, user_id, application_id)
