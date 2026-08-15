"""Every endpoint here just delegates to job_service and maps ValueError -> 404 (see the
router's own `_run` helper), so these tests patch the service layer and check the router's HTTP
wiring: status codes, request validation, and the 404 mapping - not job_service's own logic
(which has no interesting branching beyond what's already covered indirectly) and not the real
agent calls (mocked out entirely, per the "mock the agent boundary" test scope)."""

from unittest.mock import patch

JOB = {
    "id": "job-1",
    "user_id": "user-123",
    "company": "Acme",
    "title": "Backend Engineer",
    "raw_text": "We need a backend engineer.",
    "source_url": None,
    "created_at": "2026-01-01T00:00:00Z",
}

ANALYSIS = {
    "id": "analysis-1",
    "user_id": "user-123",
    "job_description_id": "job-1",
    "explanation": {"one_sentence_summary": "..."},
    "typical_day": None,
    "explanation_translations": {},
    "typical_day_translations": {},
    "created_at": "2026-01-01T00:00:00Z",
}


def test_list_job_descriptions(client, auth_override):
    with patch("app.services.job_service.list_job_descriptions", return_value=[JOB]):
        response = client.get("/jobs")
    assert response.status_code == 200
    assert response.json()[0]["id"] == "job-1"


def test_create_job_description(client, auth_override):
    with patch("app.services.job_service.create_job_description", return_value=JOB) as mock_create:
        response = client.post("/jobs", json={"raw_text": "We need a backend engineer."})
    assert response.status_code == 200
    assert response.json()["id"] == "job-1"
    # The router passes the parsed Pydantic model through, not a raw dict.
    call_args = mock_create.call_args
    assert call_args.args[2].raw_text == "We need a backend engineer."


def test_create_job_description_requires_raw_text(client, auth_override):
    response = client.post("/jobs", json={"company": "Acme"})
    assert response.status_code == 422


def test_get_job_description_found(client, auth_override):
    with patch("app.services.job_service.get_job_description", return_value=JOB):
        response = client.get("/jobs/job-1")
    assert response.status_code == 200


def test_get_job_description_not_found(client, auth_override):
    with patch("app.services.job_service.get_job_description", return_value=None):
        response = client.get("/jobs/missing")
    assert response.status_code == 404


def test_get_analysis_returns_null_when_none_generated_yet(client, auth_override):
    with patch("app.services.job_service.get_analysis", return_value=None):
        response = client.get("/jobs/job-1/analysis")
    assert response.status_code == 200
    assert response.json() is None


def test_get_analysis_returns_existing_row(client, auth_override):
    with patch("app.services.job_service.get_analysis", return_value=ANALYSIS):
        response = client.get("/jobs/job-1/analysis")
    assert response.status_code == 200
    assert response.json()["id"] == "analysis-1"


def test_generate_explanation_success(client, auth_override):
    with patch("app.services.job_service.generate_explanation", return_value=ANALYSIS):
        response = client.post("/jobs/job-1/explanation")
    assert response.status_code == 200


def test_generate_explanation_maps_value_error_to_404(client, auth_override):
    with patch(
        "app.services.job_service.generate_explanation",
        side_effect=ValueError("Job description not found"),
    ):
        response = client.post("/jobs/missing/explanation")
    assert response.status_code == 404
    assert response.json()["detail"] == "Job description not found"


def test_generate_typical_day(client, auth_override):
    with patch("app.services.job_service.generate_typical_day_analysis", return_value=ANALYSIS):
        response = client.post("/jobs/job-1/typical-day")
    assert response.status_code == 200


def test_generate_full_analysis_takes_no_body(client, auth_override):
    with patch("app.services.job_service.generate_full_analysis", return_value=ANALYSIS):
        response = client.post("/jobs/job-1/analyze-all")
    assert response.status_code == 200


def test_translate_explanation_requires_language(client, auth_override):
    response = client.post("/jobs/job-1/explanation/translate", json={})
    assert response.status_code == 422


def test_translate_explanation_passes_language_through(client, auth_override):
    with patch("app.services.job_service.translate_explanation", return_value=ANALYSIS) as mock_translate:
        response = client.post("/jobs/job-1/explanation/translate", json={"language": "Spanish"})
    assert response.status_code == 200
    assert mock_translate.call_args.args[3] == "Spanish"


def test_translate_typical_day_maps_value_error_to_404(client, auth_override):
    with patch(
        "app.services.job_service.translate_typical_day",
        side_effect=ValueError("Generate the typical day before translating it"),
    ):
        response = client.post("/jobs/job-1/typical-day/translate", json={"language": "French"})
    assert response.status_code == 404


def test_endpoints_require_auth(client):
    assert client.get("/jobs").status_code == 401
    assert client.post("/jobs", json={"raw_text": "x"}).status_code == 401
