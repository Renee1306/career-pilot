import base64
import hashlib
import hmac
import logging
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, tzinfo
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from supabase import Client

from app.agents.email_classifier import classify_emails
from app.core.config import settings
from app.models.application_model import ApplicationCreate, ApplicationUpdate, TimelineEntryCreate
from app.models.gmail_model import DetectedUpdate, GmailSyncResult
from app.services import application_service

logger = logging.getLogger(__name__)

TABLE = "gmail_sync_state"
TIMELINE_TABLE = "application_timeline_entries"
PROCESSED_TABLE = "gmail_processed_messages"
ATTACHMENTS_BUCKET = "application-attachments"

MAX_CONCURRENT_MESSAGE_FETCHES = 8

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
SCOPES = "https://www.googleapis.com/auth/gmail.readonly openid email"

# Search-side filtering, evaluated by Gmail before anything is fetched/classified: recent,
# not chat, not promo/social, and subject actually looks application-related. Keeps the AI
# classification step to a small, genuinely-likely-relevant set instead of every recent email.
GMAIL_QUERY = (
    "newer_than:90d -in:chat -category:promotions -category:social "
    '(subject:(application OR interview OR "thank you for applying" OR assessment OR offer OR '
    'position OR recruiter OR "next steps" OR "move forward"))'
)


def _state_secret() -> bytes:
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    return key.encode("utf-8")


def sign_state(user_id: str) -> str:
    signature = hmac.new(_state_secret(), user_id.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{user_id}.{signature}"


def verify_state(state: str) -> str:
    try:
        user_id, signature = state.split(".", 1)
    except ValueError as exc:
        raise ValueError("Malformed OAuth state") from exc
    expected = hmac.new(_state_secret(), user_id.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid OAuth state signature")
    return user_id


def build_auth_url(user_id: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": sign_state(user_id),
    }
    return f"{AUTH_ENDPOINT}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    response.raise_for_status()
    return response.json()


def _refresh_access_token(refresh_token: str) -> str:
    response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "refresh_token": refresh_token,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "grant_type": "refresh_token",
        },
    )
    response.raise_for_status()
    return response.json()["access_token"]


def get_google_email(access_token: str) -> str:
    response = httpx.get(USERINFO_ENDPOINT, headers={"Authorization": f"Bearer {access_token}"})
    response.raise_for_status()
    return response.json()["email"]


def save_connection(client: Client, user_id: str, google_email: str, refresh_token: str) -> None:
    row = {
        "user_id": user_id,
        "google_email": google_email,
        "refresh_token": refresh_token,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    client.table(TABLE).upsert(row, on_conflict="user_id").execute()


def get_sync_state(client: Client, user_id: str) -> dict | None:
    res = client.table(TABLE).select("*").eq("user_id", user_id).maybe_single().execute()
    return res.data if res else None


def _list_message_ids(access_token: str, max_results: int) -> list[str]:
    response = httpx.get(
        f"{GMAIL_API_BASE}/messages",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"q": GMAIL_QUERY, "maxResults": max_results},
    )
    response.raise_for_status()
    return [m["id"] for m in response.json().get("messages", [])]


def _decode_body_data(data: str) -> str:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def _extract_body_and_attachments(payload: dict) -> tuple[str, list[dict]]:
    """Recursively walks a Gmail message payload (handles multipart) and returns the best
    available plain-text body plus any PDF attachment parts (filename + attachmentId)."""
    text_plain: str | None = None
    text_html: str | None = None
    attachments: list[dict] = []

    def walk(part: dict) -> None:
        nonlocal text_plain, text_html
        mime_type = part.get("mimeType", "")
        filename = part.get("filename") or ""
        body = part.get("body", {}) or {}

        if filename and body.get("attachmentId"):
            if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
                attachments.append(
                    {"filename": filename, "attachment_id": body["attachmentId"], "mime_type": mime_type}
                )
        elif mime_type == "text/plain" and body.get("data") and text_plain is None:
            text_plain = _decode_body_data(body["data"])
        elif mime_type == "text/html" and body.get("data") and text_html is None:
            text_html = _decode_body_data(body["data"])

        for sub_part in part.get("parts") or []:
            walk(sub_part)

    walk(payload)

    if text_plain:
        body_text = text_plain
    elif text_html:
        body_text = re.sub(r"<[^>]+>", " ", text_html)
    else:
        body_text = ""
    return body_text, attachments


def _get_message(access_token: str, message_id: str) -> dict:
    response = httpx.get(
        f"{GMAIL_API_BASE}/messages/{message_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"format": "full"},
    )
    response.raise_for_status()
    data = response.json()
    headers = {h["name"]: h["value"] for h in data.get("payload", {}).get("headers", [])}
    received_at = None
    if headers.get("Date"):
        try:
            received_at = parsedate_to_datetime(headers["Date"])
        except (TypeError, ValueError):
            received_at = None

    body_text, attachments = _extract_body_and_attachments(data.get("payload", {}))
    return {
        "id": data["id"],
        "subject": headers.get("Subject", "(no subject)"),
        "sender": headers.get("From", ""),
        "snippet": data.get("snippet", ""),
        "body": body_text or data.get("snippet", ""),
        "attachments": attachments,
        "received_at": received_at,
    }


def _download_attachment(access_token: str, message_id: str, attachment_id: str) -> bytes:
    response = httpx.get(
        f"{GMAIL_API_BASE}/messages/{message_id}/attachments/{attachment_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    response.raise_for_status()
    padded_data = response.json()["data"]
    padded_data += "=" * (-len(padded_data) % 4)
    return base64.urlsafe_b64decode(padded_data)


def _parse_iso(value: str | None, assume_tz: tzinfo = timezone.utc) -> datetime | None:
    """Parse an ISO datetime, attaching `assume_tz` when the string carries no offset.

    An email that says "your interview is at 3pm on Tuesday" gives the classifier no timezone to
    work with, so `event_at` routinely comes back naive. Storing that naive value in a `timestamptz`
    column makes Postgres read it as UTC, which shifted every Gmail-derived interview by the user's
    whole UTC offset - 3pm showing up as 11pm for a UTC+8 user. A wall-clock time in an email is
    the recipient's local time, so that is what an offset-less value is interpreted as.
    """
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=assume_tz)


def _resolve_timezone(name: str | None) -> tzinfo:
    """The caller's IANA timezone, falling back to UTC for an unknown or missing name - a bad
    value from the client must never take a sync down."""
    if not name:
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


def _get_seen_gmail_message_ids(client: Client, user_id: str) -> set[str]:
    res = client.table(PROCESSED_TABLE).select("gmail_message_id").eq("user_id", user_id).execute()
    return {row["gmail_message_id"] for row in res.data}


def _mark_processed(client: Client, user_id: str, gmail_message_id: str) -> None:
    client.table(PROCESSED_TABLE).upsert(
        {"user_id": user_id, "gmail_message_id": gmail_message_id}, on_conflict="user_id,gmail_message_id"
    ).execute()


def sync_gmail(
    client: Client, user_id: str, max_results: int = 15, timezone_name: str | None = None
) -> GmailSyncResult:
    state = get_sync_state(client, user_id)
    if state is None or not state.get("refresh_token"):
        raise ValueError("Gmail is not connected")

    # Interview times in emails are wall-clock times in the reader's own timezone, and only the
    # browser knows what that is - see `_parse_iso`.
    local_tz = _resolve_timezone(timezone_name)

    access_token = _refresh_access_token(state["refresh_token"])

    seen_message_ids = _get_seen_gmail_message_ids(client, user_id)
    message_ids = [m for m in _list_message_ids(access_token, max_results) if m not in seen_message_ids]

    existing_apps = application_service.list_applications(client, user_id)

    # Gmail's search results come back newest-first. Fetch all of them, then process
    # oldest-first: status transitions (applied -> pending_interview -> rejected/offer)
    # only make sense in chronological order - classifying newest-first could process a
    # rejection before the application-confirmation email that should have created the
    # application it belongs to, silently dropping the rejection and then having the
    # older "applied" email recreate/overwrite it as "applied".
    # Fetched concurrently: these are up to `max_results` independent, blocking Gmail HTTP calls,
    # and doing them one at a time was the single biggest chunk of sync wall-clock time (the AI
    # classification below is already batched, and measures ~4s for a dozen emails). A slow sync
    # is not just a UX annoyance here - the browser gives up on the request long before the server
    # finishes, so the writes all land but the frontend reports a generic failure (see the
    # "Sync now" gotcha in PROJECT_CONTEXT.md).
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_MESSAGE_FETCHES) as executor:
        messages = list(executor.map(lambda mid: _get_message(access_token, mid), message_ids))
    messages.sort(key=lambda m: m["received_at"] or datetime.min.replace(tzinfo=timezone.utc))

    classifications = classify_emails([(m["subject"], m["sender"], m["body"]) for m in messages])

    detected: list[DetectedUpdate] = []
    for message, classification in zip(messages, classifications):
        _mark_processed(client, user_id, message["id"])
        if not classification.is_job_related:
            continue

        try:
            matching_application_id = None
            if classification.company:
                for app in existing_apps:
                    company = (app.get("company") or "").lower()
                    if company and classification.company.lower() in company:
                        matching_application_id = app["id"]
                        break

            application_id = matching_application_id
            if application_id is None and classification.company:
                new_app = application_service.create_application(
                    client,
                    user_id,
                    ApplicationCreate(
                        status=classification.detected_status or "applied",
                        company=classification.company,
                        position=classification.role,
                    ),
                )
                application_id = new_app["id"]
                existing_apps.append(new_app)
                suggested_action = "create_application"
            elif application_id and classification.detected_status:
                application_service.update_application(
                    client, user_id, application_id, ApplicationUpdate(status=classification.detected_status)
                )
                suggested_action = "update_status"
            else:
                suggested_action = "ignore"

            if application_id and classification.entry_type:
                details: dict = {}
                if classification.meeting_link:
                    details["meeting_link"] = classification.meeting_link
                if classification.entry_type == "case_study":
                    # Normalised through the same local-timezone rule as event_at, so the stored
                    # value always carries an explicit offset instead of leaving it to whatever
                    # reads it next to guess.
                    deadline = _parse_iso(classification.deadline, local_tz)
                    if deadline:
                        details["deadline"] = deadline.isoformat()
                    attachments_meta = []
                    for attachment in message["attachments"]:
                        pdf_bytes = _download_attachment(access_token, message["id"], attachment["attachment_id"])
                        storage_path = f"{user_id}/{application_id}/{uuid.uuid4()}_{attachment['filename']}"
                        client.storage.from_(ATTACHMENTS_BUCKET).upload(
                            storage_path, pdf_bytes, {"content-type": "application/pdf"}
                        )
                        attachments_meta.append({"filename": attachment["filename"], "storage_path": storage_path})
                    if attachments_meta:
                        details["attachments"] = attachments_meta

                occurred_at = _parse_iso(classification.event_at, local_tz) or message["received_at"]
                entry = TimelineEntryCreate(
                    entry_type=classification.entry_type,
                    occurred_at=occurred_at,
                    content=classification.summary or classification.reasoning,
                    details=details,
                )
                client.table(TIMELINE_TABLE).insert(
                    {
                        "application_id": application_id,
                        "user_id": user_id,
                        "entry_type": entry.entry_type,
                        "occurred_at": entry.occurred_at.isoformat() if entry.occurred_at else datetime.now(timezone.utc).isoformat(),
                        "content": entry.content,
                        "details": entry.details,
                        "source": "gmail",
                        "gmail_message_id": message["id"],
                    }
                ).execute()
        except Exception:
            # A single message failing to write (e.g. a transient Postgrest/storage error)
            # shouldn't sink the rest of the batch - the message is already marked processed
            # above, so it won't be retried; everything after it in this sync should still
            # get its chance.
            logger.exception("Failed to apply Gmail update for message %s", message["id"])
            continue

        detected.append(
            DetectedUpdate(
                gmail_message_id=message["id"],
                subject=message["subject"],
                snippet=message["snippet"],
                received_at=message["received_at"],
                company=classification.company,
                role=classification.role,
                detected_status=classification.detected_status,
                entry_type=classification.entry_type,
                summary=classification.summary,
                reasoning=classification.reasoning,
                suggested_action=suggested_action,
                matching_application_id=application_id,
            )
        )

    client.table(TABLE).update({"last_synced_at": datetime.now(timezone.utc).isoformat()}).eq(
        "user_id", user_id
    ).execute()

    return GmailSyncResult(scanned=len(message_ids), detected=detected)
