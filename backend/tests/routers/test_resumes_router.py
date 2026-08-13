from unittest.mock import patch

RESUME = {
    "id": "resume-1",
    "user_id": "user-123",
    "label": "My Resume",
    "file_url": "https://example.com/resume.pdf",
    "parsed_text": "Jane Doe...",
    "parsed_json": {"full_name": "Jane Doe"},
    "version": 1,
    "created_at": "2026-01-01T00:00:00Z",
}


def test_list_resumes(client, auth_override):
    with patch("app.services.resume_service.list_resumes", return_value=[RESUME]):
        response = client.get("/resumes")
    assert response.status_code == 200


def test_create_resume(client, auth_override):
    with patch("app.services.resume_service.create_resume", return_value=RESUME):
        response = client.post("/resumes", json={"label": "My Resume"})
    assert response.status_code == 200


def test_get_resume_not_found(client, auth_override):
    with patch("app.services.resume_service.get_resume", return_value=None):
        response = client.get("/resumes/missing")
    assert response.status_code == 404


def test_upload_resume_rejects_unsupported_content_type(client, auth_override):
    response = client.post(
        "/resumes/upload", files={"file": ("resume.txt", b"plain text resume", "text/plain")}
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_resume_rejects_files_over_10mb(client, auth_override):
    oversized = b"x" * (10 * 1024 * 1024 + 1)
    response = client.post(
        "/resumes/upload", files={"file": ("resume.pdf", oversized, "application/pdf")}
    )
    assert response.status_code == 400
    assert "10MB" in response.json()["detail"]


def test_upload_resume_success(client, auth_override):
    with patch(
        "app.services.resume_service.upload_and_parse_resume", return_value=RESUME
    ) as mock_upload:
        response = client.post(
            "/resumes/upload",
            files={"file": ("resume.pdf", b"%PDF-1.4 fake pdf bytes", "application/pdf")},
            data={"label": "My Resume"},
        )
    assert response.status_code == 200
    call_args = mock_upload.call_args.args
    assert call_args[2] == "resume.pdf"
    assert call_args[4] == "application/pdf"
    assert call_args[5] == "My Resume"


def test_endpoints_require_auth(client):
    assert client.get("/resumes").status_code == 401
    assert client.post("/resumes", json={}).status_code == 401
