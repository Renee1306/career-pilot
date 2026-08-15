import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.middleware.auth import AuthedUser, get_current_user
from app.middleware.supabase_client import get_service_client
from app.models.gmail_model import GmailConnectUrl, GmailSyncResult, GmailSyncStatus
from app.services import gmail_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gmail", tags=["gmail"])


@router.get("/status", response_model=GmailSyncStatus)
def get_status(user: AuthedUser = Depends(get_current_user)):
    state = gmail_service.get_sync_state(user.client, user.id)
    if state is None or not state.get("refresh_token"):
        return GmailSyncStatus(connected=False)
    return GmailSyncStatus(
        connected=True, google_email=state.get("google_email"), last_synced_at=state.get("last_synced_at")
    )


@router.get("/connect", response_model=GmailConnectUrl)
def connect(user: AuthedUser = Depends(get_current_user)):
    if not settings.google_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Gmail integration is not configured")
    return GmailConnectUrl(auth_url=gmail_service.build_auth_url(user.id))


@router.get("/callback")
def callback(code: str, state: str):
    try:
        user_id = gmail_service.verify_state(state)
        tokens = gmail_service.exchange_code(code)
        google_email = gmail_service.get_google_email(tokens["access_token"])
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            # Google only returns a refresh token on first consent; without it we can't
            # sync later. Sending the user back with an error tells them to reconnect.
            return RedirectResponse(f"{settings.frontend_url}/applications?gmail_error=no_refresh_token")

        gmail_service.save_connection(get_service_client(), user_id, google_email, refresh_token)
        return RedirectResponse(f"{settings.frontend_url}/applications?gmail_connected=true")
    except Exception:
        logger.exception("Gmail OAuth callback failed")
        return RedirectResponse(f"{settings.frontend_url}/applications?gmail_error=connect_failed")


@router.post("/sync", response_model=GmailSyncResult)
def sync(timezone: str | None = None, user: AuthedUser = Depends(get_current_user)):
    """`timezone` is the caller's IANA zone (e.g. "Asia/Kuala_Lumpur"). An interview time written
    in an email is a wall-clock time with no offset, and only the browser knows which zone that
    is meant to be read in - see `gmail_service._parse_iso`."""
    try:
        return gmail_service.sync_gmail(user.client, user.id, timezone_name=timezone)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
