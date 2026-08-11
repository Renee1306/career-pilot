import hashlib
import hmac
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode

import httpx
from supabase import Client

from app.agents.email_classifier import classify_email
from app.core.config import settings
from app.models.gmail import DetectedUpdate, GmailSyncResult
from app.services import application_service, job_service

TABLE = "gmail_sync_state"

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
SCOPES = "https://www.googleapis.com/auth/gmail.readonly openid email"

# Search only for likely application-related mail to keep the scan small.
GMAIL_QUERY = (
    'newer_than:30d ("application" OR "interview" OR "position" OR "offer" OR "candidacy")'
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


def _get_message(access_token: str, message_id: str) -> dict:
    response = httpx.get(
        f"{GMAIL_API_BASE}/messages/{message_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]},
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
    return {
        "id": data["id"],
        "subject": headers.get("Subject", "(no subject)"),
        "sender": headers.get("From", ""),
        "snippet": data.get("snippet", ""),
        "received_at": received_at,
    }


def sync_gmail(client: Client, user_id: str, max_results: int = 15) -> GmailSyncResult:
    state = get_sync_state(client, user_id)
    if state is None or not state.get("refresh_token"):
        raise ValueError("Gmail is not connected")

    access_token = _refresh_access_token(state["refresh_token"])
    message_ids = _list_message_ids(access_token, max_results)

    existing_apps = application_service.list_applications(client, user_id)
    job_by_id = {
        job["id"]: job
        for job in job_service.list_job_descriptions(client, user_id)
    }

    detected: list[DetectedUpdate] = []
    for message_id in message_ids:
        message = _get_message(access_token, message_id)
        classification = classify_email(message["subject"], message["sender"], message["snippet"])
        if not classification.is_job_related:
            continue

        matching_application_id = None
        if classification.company:
            for app in existing_apps:
                job = job_by_id.get(app.get("job_description_id"))
                if job and job.get("company") and classification.company.lower() in job["company"].lower():
                    matching_application_id = app["id"]
                    break

        suggested_action = (
            "update_status"
            if matching_application_id and classification.detected_status
            else "create_application"
            if classification.detected_status == "applied"
            else "ignore"
        )

        detected.append(
            DetectedUpdate(
                gmail_message_id=message["id"],
                subject=message["subject"],
                snippet=message["snippet"],
                received_at=message["received_at"],
                company=classification.company,
                role=classification.role,
                detected_status=classification.detected_status,
                reasoning=classification.reasoning,
                suggested_action=suggested_action,
                matching_application_id=matching_application_id,
            )
        )

    client.table(TABLE).update({"last_synced_at": datetime.now(timezone.utc).isoformat()}).eq(
        "user_id", user_id
    ).execute()

    return GmailSyncResult(scanned=len(message_ids), detected=detected)
