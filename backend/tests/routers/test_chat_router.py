from unittest.mock import patch


def test_send_message_requires_message_field(client, auth_override):
    response = client.post("/chat", json={})
    assert response.status_code == 422


def test_send_message_success(client, auth_override):
    with patch("app.services.chat_service.send_chat_message", return_value="Here's an answer.") as mock_send:
        response = client.post(
            "/chat",
            json={
                "message": "What does this role actually involve?",
                "history": [{"role": "user", "content": "Hi"}],
                "job_id": "job-1",
                "resume_id": "resume-1",
            },
        )
    assert response.status_code == 200
    assert response.json() == {"reply": "Here's an answer."}
    call_args = mock_send.call_args.args
    assert call_args[2] == "What does this role actually involve?"
    assert call_args[4] == "job-1"
    assert call_args[5] == "resume-1"


def test_send_message_works_without_optional_scope(client, auth_override):
    """job_id/resume_id are optional - the chatbot answers ungrounded on pages that never
    call setScope (Applications, ApplicationDetail)."""
    with patch("app.services.chat_service.send_chat_message", return_value="Sure, I can help."):
        response = client.post("/chat", json={"message": "Hello"})
    assert response.status_code == 200


def test_send_message_requires_auth(client):
    response = client.post("/chat", json={"message": "Hello"})
    assert response.status_code == 401
