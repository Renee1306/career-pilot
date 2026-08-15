from unittest.mock import patch

APPLICATION = {
    "id": "app-1",
    "user_id": "user-123",
    "job_description_id": None,
    "resume_document_id": None,
    "status": "applied",
    "applied_date": None,
    "company": "Acme",
    "position": "Backend Engineer",
    "company_snapshot": None,
    "interview_questions": None,
    "timeline": [],
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
}


def test_list_applications(client, auth_override):
    with patch("app.services.application_service.list_applications", return_value=[APPLICATION]):
        response = client.get("/applications")
    assert response.status_code == 200
    assert response.json()[0]["company"] == "Acme"


def test_create_application_defaults_status_to_applied(client, auth_override):
    with patch("app.services.application_service.create_application", return_value=APPLICATION) as mock_create:
        response = client.post("/applications", json={"company": "Acme"})
    assert response.status_code == 200
    assert mock_create.call_args.args[2].status == "applied"


def test_create_application_rejects_invalid_status(client, auth_override):
    response = client.post("/applications", json={"company": "Acme", "status": "not-a-real-status"})
    assert response.status_code == 422


def test_get_application_not_found(client, auth_override):
    with patch("app.services.application_service.get_application", return_value=None):
        response = client.get("/applications/missing")
    assert response.status_code == 404


def test_update_application_not_found(client, auth_override):
    with patch("app.services.application_service.update_application", return_value=None):
        response = client.patch("/applications/missing", json={"status": "offer"})
    assert response.status_code == 404


def test_update_application_success(client, auth_override):
    with patch("app.services.application_service.update_application", return_value=APPLICATION):
        response = client.patch("/applications/app-1", json={"status": "offer"})
    assert response.status_code == 200


def test_delete_application_success(client, auth_override):
    with patch("app.services.application_service.delete_application", return_value=True):
        response = client.delete("/applications/app-1")
    assert response.status_code == 200
    assert response.json() == {"deleted": True}


def test_delete_application_not_found(client, auth_override):
    with patch("app.services.application_service.delete_application", return_value=False):
        response = client.delete("/applications/missing")
    assert response.status_code == 404


def test_generate_company_snapshot_not_found(client, auth_override):
    with patch("app.services.application_service.generate_company_snapshot", return_value=None):
        response = client.post("/applications/missing/company-snapshot")
    assert response.status_code == 404


def test_generate_interview_questions_requires_round_type(client, auth_override):
    response = client.post("/applications/app-1/interview-questions", json={})
    assert response.status_code == 422


def test_generate_interview_questions_rejects_unknown_round_type(client, auth_override):
    response = client.post(
        "/applications/app-1/interview-questions", json={"round_type": "final-boss"}
    )
    assert response.status_code == 422


def test_generate_interview_questions_passes_grounding_through(client, auth_override):
    with patch(
        "app.services.application_service.generate_interview_questions", return_value=APPLICATION
    ) as mock_generate:
        response = client.post(
            "/applications/app-1/interview-questions",
            json={
                "round_type": "behavioural",
                "jd_text": "We need a backend engineer.",
                "resume_document_id": "doc-1",
            },
        )
    assert response.status_code == 200
    assert mock_generate.call_args.args[2:] == (
        "app-1",
        "behavioural",
        "We need a backend engineer.",
        "doc-1",
    )


def test_generate_interview_questions_allows_hiring_manager_round(client, auth_override):
    with patch(
        "app.services.application_service.generate_interview_questions", return_value=APPLICATION
    ):
        response = client.post(
            "/applications/app-1/interview-questions", json={"round_type": "hiring_manager"}
        )
    assert response.status_code == 200


def test_generate_interview_questions_rejects_retired_round_types(client, auth_override):
    # "hr"/"technical" still validate on rows saved before the rounds were renamed, but nothing
    # may generate them any more.
    for retired in ("hr", "technical"):
        response = client.post(
            "/applications/app-1/interview-questions", json={"round_type": retired}
        )
        assert response.status_code == 422


def test_generate_interview_questions_defaults_resume_document_to_none(client, auth_override):
    with patch(
        "app.services.application_service.generate_interview_questions", return_value=APPLICATION
    ) as mock_generate:
        client.post("/applications/app-1/interview-questions", json={"round_type": "behavioural"})
    assert mock_generate.call_args.args[5] is None


def test_create_timeline_entry(client, auth_override):
    with patch("app.services.application_service.create_timeline_entry", return_value=APPLICATION):
        response = client.post(
            "/applications/app-1/timeline", json={"entry_type": "note", "content": "Called the recruiter."}
        )
    assert response.status_code == 200


def test_create_timeline_entry_rejects_unknown_entry_type(client, auth_override):
    response = client.post("/applications/app-1/timeline", json={"entry_type": "not-a-real-type"})
    assert response.status_code == 422


def test_update_timeline_entry_not_found(client, auth_override):
    with patch("app.services.application_service.update_timeline_entry", return_value=None):
        response = client.patch(
            "/applications/app-1/timeline/missing-entry", json={"content": "Updated."}
        )
    assert response.status_code == 404
    assert response.json()["detail"] == "Timeline entry not found"


def test_delete_timeline_entry_not_found(client, auth_override):
    with patch("app.services.application_service.delete_timeline_entry", return_value=None):
        response = client.delete("/applications/app-1/timeline/missing-entry")
    assert response.status_code == 404


def test_endpoints_require_auth(client):
    assert client.get("/applications").status_code == 401
    assert client.delete("/applications/app-1").status_code == 401
