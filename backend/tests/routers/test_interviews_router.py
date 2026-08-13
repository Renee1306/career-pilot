"""interview_rounds is unused by the current frontend (superseded by the Applications page's
Interview Questions tab - see PROJECT_CONTEXT.md), but the table/models/router are still live
backend code, so it's still worth the same coverage as any other router."""

from unittest.mock import patch

ROUND = {
    "id": "round-1",
    "user_id": "user-123",
    "application_id": "app-1",
    "round_type": "hr",
    "scheduled_at": None,
    "link": None,
    "notes": None,
    "generated_qna": None,
    "created_at": "2026-01-01T00:00:00Z",
}


def test_list_rounds_requires_application_id_query_param(client, auth_override):
    response = client.get("/interview-rounds")
    assert response.status_code == 422


def test_list_rounds(client, auth_override):
    with patch("app.services.interview_service.list_rounds_for_application", return_value=[ROUND]):
        response = client.get("/interview-rounds", params={"application_id": "app-1"})
    assert response.status_code == 200


def test_create_round_defaults_round_type_to_hr(client, auth_override):
    with patch("app.services.interview_service.create_round", return_value=ROUND) as mock_create:
        response = client.post("/interview-rounds", json={"application_id": "app-1"})
    assert response.status_code == 200
    assert mock_create.call_args.args[2].round_type == "hr"


def test_update_round_not_found(client, auth_override):
    with patch("app.services.interview_service.update_round", return_value=None):
        response = client.patch("/interview-rounds/missing", json={"notes": "Rescheduled"})
    assert response.status_code == 404


def test_generate_qna_maps_value_error_to_404(client, auth_override):
    with patch(
        "app.services.interview_service.generate_qna_for_round",
        side_effect=ValueError("Interview round not found"),
    ):
        response = client.post("/interview-rounds/missing/generate-qna")
    assert response.status_code == 404


def test_generate_qna_success(client, auth_override):
    with patch("app.services.interview_service.generate_qna_for_round", return_value=ROUND):
        response = client.post("/interview-rounds/round-1/generate-qna")
    assert response.status_code == 200


def test_endpoints_require_auth(client):
    assert client.get("/interview-rounds", params={"application_id": "app-1"}).status_code == 401
    assert client.post("/interview-rounds", json={"application_id": "app-1"}).status_code == 401
