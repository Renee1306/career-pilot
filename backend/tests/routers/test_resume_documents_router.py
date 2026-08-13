from unittest.mock import patch

DOCUMENT = {
    "id": "doc-1",
    "user_id": "user-123",
    "name": "My Resume",
    "template_id": "classic",
    "photo_url": None,
    "content": {},
    "style": {},
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
}

LIST_ITEM = {
    "id": "doc-1",
    "name": "My Resume",
    "template_id": "classic",
    "photo_url": None,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
}


def test_list_resume_documents(client, auth_override):
    with patch("app.services.resume_document_service.list_resume_documents", return_value=[LIST_ITEM]):
        response = client.get("/resume-documents")
    assert response.status_code == 200


def test_create_resume_document_uses_defaults(client, auth_override):
    with patch(
        "app.services.resume_document_service.create_resume_document", return_value=DOCUMENT
    ) as mock_create:
        response = client.post("/resume-documents", json={})
    assert response.status_code == 200
    payload = mock_create.call_args.args[2]
    assert payload.name == "Untitled Resume"
    assert payload.template_id == "classic"


def test_enhance_text(client, auth_override):
    with patch("app.services.resume_document_service.enhance_text", return_value="Improved text.") as mock:
        response = client.post(
            "/resume-documents/enhance-text", json={"text": "did stuff", "context": "Engineer at Acme"}
        )
    assert response.status_code == 200
    assert response.json() == {"text": "Improved text."}
    assert mock.call_args.args == ("did stuff", "Engineer at Acme")


def test_enhance_text_route_declared_before_doc_id_route(client, auth_override):
    """`/enhance-text` must be registered before `/{doc_id}` or FastAPI would try to treat
    "enhance-text" as a doc_id and route it to get_resume_document instead - this is exactly
    the ordering gotcha PROJECT_CONTEXT.md calls out about this router."""
    with patch("app.services.resume_document_service.enhance_text", return_value="x"), patch(
        "app.services.resume_document_service.get_resume_document"
    ) as mock_get:
        response = client.post("/resume-documents/enhance-text", json={"text": "hi"})
    assert response.status_code == 200
    mock_get.assert_not_called()


def test_import_resume_document_rejects_unsupported_type(client, auth_override):
    response = client.post(
        "/resume-documents/import", files={"file": ("resume.txt", b"text", "text/plain")}
    )
    assert response.status_code == 400


def test_import_resume_document_success(client, auth_override):
    with patch(
        "app.services.resume_document_service.import_resume_document", return_value=DOCUMENT
    ):
        response = client.post(
            "/resume-documents/import",
            files={"file": ("resume.pdf", b"%PDF-1.4", "application/pdf")},
        )
    assert response.status_code == 200


def test_get_resume_document_not_found(client, auth_override):
    with patch("app.services.resume_document_service.get_resume_document", return_value=None):
        response = client.get("/resume-documents/missing")
    assert response.status_code == 404


def test_update_resume_document(client, auth_override):
    with patch("app.services.resume_document_service.update_resume_document", return_value=DOCUMENT):
        response = client.patch("/resume-documents/doc-1", json={"name": "Renamed"})
    assert response.status_code == 200


def test_delete_resume_document_not_found(client, auth_override):
    with patch("app.services.resume_document_service.delete_resume_document", return_value=False):
        response = client.delete("/resume-documents/missing")
    assert response.status_code == 404


def test_duplicate_resume_document(client, auth_override):
    with patch("app.services.resume_document_service.duplicate_resume_document", return_value=DOCUMENT):
        response = client.post("/resume-documents/doc-1/duplicate")
    assert response.status_code == 200


def test_upload_photo_rejects_pdf(client, auth_override):
    # Photo endpoint only allows PNG/JPEG/WEBP, unlike the resume-upload endpoints which allow PDF.
    response = client.post(
        "/resume-documents/doc-1/photo", files={"file": ("photo.pdf", b"%PDF-1.4", "application/pdf")}
    )
    assert response.status_code == 400


def test_upload_photo_rejects_files_over_5mb(client, auth_override):
    oversized = b"x" * (5 * 1024 * 1024 + 1)
    response = client.post(
        "/resume-documents/doc-1/photo", files={"file": ("photo.png", oversized, "image/png")}
    )
    assert response.status_code == 400
    assert "5MB" in response.json()["detail"]


def test_upload_photo_success(client, auth_override):
    with patch("app.services.resume_document_service.upload_photo", return_value=DOCUMENT):
        response = client.post(
            "/resume-documents/doc-1/photo", files={"file": ("photo.png", b"fake png bytes", "image/png")}
        )
    assert response.status_code == 200


def test_remove_photo_not_found(client, auth_override):
    with patch("app.services.resume_document_service.remove_photo", return_value=None):
        response = client.delete("/resume-documents/missing/photo")
    assert response.status_code == 404


def test_evaluate_jd_match_not_found(client, auth_override):
    with patch("app.services.resume_document_service.evaluate_jd_match", return_value=None):
        response = client.post("/resume-documents/missing/jd-match", json={"jd_text": "..."})
    assert response.status_code == 404


def test_evaluate_jd_match_requires_jd_text(client, auth_override):
    response = client.post("/resume-documents/doc-1/jd-match", json={})
    assert response.status_code == 422


def test_evaluate_jd_match_success(client, auth_override):
    evaluation = {"match_score": 72, "strengths": ["Python"], "gaps": ["AWS"]}
    with patch("app.services.resume_document_service.evaluate_jd_match", return_value=evaluation):
        response = client.post("/resume-documents/doc-1/jd-match", json={"jd_text": "Needs Python and AWS."})
    assert response.status_code == 200
    assert response.json()["match_score"] == 72


def test_suggest_jd_edits(client, auth_override):
    suggestions = {"suggestions": []}
    with patch("app.services.resume_document_service.suggest_jd_edits", return_value=suggestions):
        response = client.post("/resume-documents/doc-1/jd-suggest", json={"jd_text": "..."})
    assert response.status_code == 200


def test_customize_for_jd_not_found(client, auth_override):
    with patch("app.services.resume_document_service.customize_for_jd", return_value=None):
        response = client.post("/resume-documents/missing/jd-customize", json={"jd_text": "..."})
    assert response.status_code == 404


def test_endpoints_require_auth(client):
    assert client.get("/resume-documents").status_code == 401
    assert client.post("/resume-documents", json={}).status_code == 401
