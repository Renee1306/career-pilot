"""Tests the real get_current_user dependency (not the auth_override fixture) - these are the
only tests in the suite that exercise the actual auth-gating logic rather than bypassing it."""

from unittest.mock import MagicMock


def test_missing_bearer_token_returns_401(client):
    response = client.get("/jobs")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing bearer token"


def test_invalid_token_returns_401(client, monkeypatch):
    fake_anon_client = MagicMock()
    fake_anon_client.auth.get_user.side_effect = Exception("boom")
    monkeypatch.setattr("app.middleware.auth.get_anon_client", lambda: fake_anon_client)

    response = client.get("/jobs", headers={"Authorization": "Bearer bad-token"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


def test_supabase_returning_no_user_returns_401(client, monkeypatch):
    """auth.get_user() can return successfully with .user set to None (e.g. a revoked
    session) rather than raising - a separate failure mode from the exception path above."""
    fake_anon_client = MagicMock()
    fake_anon_client.auth.get_user.return_value = MagicMock(user=None)
    monkeypatch.setattr("app.middleware.auth.get_anon_client", lambda: fake_anon_client)

    response = client.get("/jobs", headers={"Authorization": "Bearer stale-token"})

    assert response.status_code == 401


def test_valid_token_resolves_and_scopes_the_request(client, monkeypatch):
    fake_user = MagicMock(id="user-1", email="a@b.com")
    fake_anon_client = MagicMock()
    fake_anon_client.auth.get_user.return_value = MagicMock(user=fake_user)
    monkeypatch.setattr("app.middleware.auth.get_anon_client", lambda: fake_anon_client)
    monkeypatch.setattr("app.middleware.auth.get_client_for_user", lambda token: MagicMock())

    captured_user_id = {}

    def fake_list(client, user_id):
        captured_user_id["value"] = user_id
        return []

    monkeypatch.setattr("app.services.job_service.list_job_descriptions", fake_list)

    response = client.get("/jobs", headers={"Authorization": "Bearer good-token"})

    assert response.status_code == 200
    assert response.json() == []
    # The id FastAPI resolved from the (mocked) Supabase user is what got passed downstream -
    # this is the whole point of the auth dependency: every query is scoped to the real caller.
    assert captured_user_id["value"] == "user-1"
