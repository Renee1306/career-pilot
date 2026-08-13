from unittest.mock import patch

from app.core.config import settings

SYNC_RESULT = {"scanned": 3, "detected": []}


def test_status_not_connected(client, auth_override):
    with patch("app.services.gmail_service.get_sync_state", return_value=None):
        response = client.get("/gmail/status")
    assert response.status_code == 200
    assert response.json() == {"connected": False, "google_email": None, "last_synced_at": None}


def test_status_connected(client, auth_override):
    state = {
        "refresh_token": "rt-1",
        "google_email": "candidate@example.com",
        "last_synced_at": "2026-01-01T00:00:00Z",
    }
    with patch("app.services.gmail_service.get_sync_state", return_value=state):
        response = client.get("/gmail/status")
    assert response.status_code == 200
    body = response.json()
    assert body["connected"] is True
    assert body["google_email"] == "candidate@example.com"


def test_connect_returns_503_when_google_oauth_not_configured(client, auth_override, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", None)
    response = client.get("/gmail/connect")
    assert response.status_code == 503


def test_connect_returns_auth_url_when_configured(client, auth_override, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    with patch("app.services.gmail_service.build_auth_url", return_value="https://accounts.google.com/x"):
        response = client.get("/gmail/connect")
    assert response.status_code == 200
    assert response.json() == {"auth_url": "https://accounts.google.com/x"}


def test_callback_success_redirects_with_connected_flag(client, monkeypatch):
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")
    monkeypatch.setattr("app.services.gmail_service.verify_state", lambda state: "user-1")
    monkeypatch.setattr(
        "app.services.gmail_service.exchange_code",
        lambda code: {"access_token": "at-1", "refresh_token": "rt-1"},
    )
    monkeypatch.setattr(
        "app.services.gmail_service.get_google_email", lambda access_token: "candidate@example.com"
    )
    save_calls = []
    monkeypatch.setattr(
        "app.services.gmail_service.save_connection",
        lambda client, user_id, email, refresh_token: save_calls.append((user_id, email, refresh_token)),
    )
    monkeypatch.setattr("app.routers.gmail.get_service_client", lambda: object())

    response = client.get(
        "/gmail/callback", params={"code": "auth-code", "state": "user-1.sig"}, follow_redirects=False
    )

    assert response.status_code in (302, 307)
    assert "gmail_connected=true" in response.headers["location"]
    assert save_calls == [("user-1", "candidate@example.com", "rt-1")]


def test_callback_missing_refresh_token_redirects_with_specific_error(client, monkeypatch):
    """Google only returns a refresh token on first consent - without one we can't sync
    later, so this must surface a distinct error rather than silently "succeeding"."""
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")
    monkeypatch.setattr("app.services.gmail_service.verify_state", lambda state: "user-1")
    monkeypatch.setattr(
        "app.services.gmail_service.exchange_code", lambda code: {"access_token": "at-1"}
    )
    monkeypatch.setattr(
        "app.services.gmail_service.get_google_email", lambda access_token: "candidate@example.com"
    )

    response = client.get(
        "/gmail/callback", params={"code": "auth-code", "state": "user-1.sig"}, follow_redirects=False
    )

    assert response.status_code in (302, 307)
    assert "gmail_error=no_refresh_token" in response.headers["location"]


def test_callback_failure_redirects_with_generic_error(client, monkeypatch):
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")
    monkeypatch.setattr(
        "app.services.gmail_service.verify_state",
        lambda state: (_ for _ in ()).throw(ValueError("bad state")),
    )

    response = client.get(
        "/gmail/callback", params={"code": "auth-code", "state": "garbage"}, follow_redirects=False
    )

    assert response.status_code in (302, 307)
    assert "gmail_error=connect_failed" in response.headers["location"]


def test_sync_success(client, auth_override):
    with patch("app.services.gmail_service.sync_gmail", return_value=SYNC_RESULT):
        response = client.post("/gmail/sync")
    assert response.status_code == 200
    assert response.json()["scanned"] == 3


def test_sync_maps_value_error_to_400(client, auth_override):
    with patch(
        "app.services.gmail_service.sync_gmail", side_effect=ValueError("Gmail is not connected")
    ):
        response = client.post("/gmail/sync")
    assert response.status_code == 400
    assert response.json()["detail"] == "Gmail is not connected"


def test_status_and_sync_require_auth(client):
    assert client.get("/gmail/status").status_code == 401
    assert client.post("/gmail/sync").status_code == 401


def test_callback_does_not_require_auth(client, monkeypatch):
    # Google hits this endpoint directly with no bearer token available - it must not be
    # gated by get_current_user like every other route in this router is.
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")
    monkeypatch.setattr(
        "app.services.gmail_service.verify_state",
        lambda state: (_ for _ in ()).throw(ValueError("bad")),
    )
    response = client.get(
        "/gmail/callback", params={"code": "x", "state": "y"}, follow_redirects=False
    )
    assert response.status_code != 401
