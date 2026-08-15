"""sync_gmail's branching/ordering logic, with every I/O boundary mocked out: the Supabase
client, every Gmail/Google HTTP call, and the AI classifier. Two of these tests exist
specifically to lock in real bugs PROJECT_CONTEXT.md documents as already having been hit and
fixed once - regressing either would silently reintroduce a bug that already cost real debugging
time, so these matter more than typical coverage-for-its-own-sake tests would."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.models.gmail_model import EmailClassification
from app.services import gmail_service


def _message(msg_id: str, received_at: datetime, subject: str = "Application update") -> dict:
    return {
        "id": msg_id,
        "subject": subject,
        "sender": "recruiter@acme.example",
        "snippet": subject,
        "body": subject,
        "attachments": [],
        "received_at": received_at,
    }


def _connected_state() -> dict:
    return {"refresh_token": "refresh-token-1", "google_email": "candidate@example.com"}


@pytest.fixture(autouse=True)
def _mock_gmail_io(monkeypatch):
    """Applied to every test in this file: stub every network call sync_gmail makes so tests
    run instantly and deterministically. Individual tests override return values as needed."""
    monkeypatch.setattr(gmail_service, "get_sync_state", lambda client, user_id: _connected_state())
    monkeypatch.setattr(gmail_service, "_refresh_access_token", lambda refresh_token: "access-token-1")
    monkeypatch.setattr(gmail_service, "_get_seen_gmail_message_ids", lambda client, user_id: set())


def test_raises_when_gmail_is_not_connected(monkeypatch):
    monkeypatch.setattr(gmail_service, "get_sync_state", lambda client, user_id: None)

    with pytest.raises(ValueError, match="Gmail is not connected"):
        gmail_service.sync_gmail(MagicMock(), "user-1")


def test_raises_when_connection_row_has_no_refresh_token(monkeypatch):
    monkeypatch.setattr(gmail_service, "get_sync_state", lambda client, user_id: {"refresh_token": None})

    with pytest.raises(ValueError, match="Gmail is not connected"):
        gmail_service.sync_gmail(MagicMock(), "user-1")


def test_already_processed_messages_are_never_refetched(monkeypatch):
    """The dedup table is checked BEFORE fetching, not after - an already-seen message should
    cost zero Gmail API calls on a later sync, not just zero writes."""
    monkeypatch.setattr(gmail_service, "_get_seen_gmail_message_ids", lambda client, user_id: {"seen-1"})
    monkeypatch.setattr(gmail_service, "_list_message_ids", lambda token, max_results: ["seen-1", "new-1"])

    fetched_ids = []

    def fake_get_message(access_token, message_id):
        fetched_ids.append(message_id)
        return _message(message_id, datetime.now(timezone.utc))

    monkeypatch.setattr(gmail_service, "_get_message", fake_get_message)
    monkeypatch.setattr(gmail_service, "classify_emails", lambda batch: [
        EmailClassification(is_job_related=False, reasoning="not job related") for _ in batch
    ])
    monkeypatch.setattr(
        "app.services.application_service.list_applications", lambda client, user_id: []
    )

    result = gmail_service.sync_gmail(MagicMock(), "user-1")

    assert fetched_ids == ["new-1"]
    assert result.scanned == 1


def test_messages_are_classified_oldest_first_even_though_gmail_returns_newest_first():
    """Regression test for a real bug: status-transition emails only make sense processed
    chronologically. Gmail's search API returns newest-first; sync_gmail must explicitly
    re-sort before classifying, or a rejection could be processed before the (older)
    application-confirmation email that should have created the application first."""
    older = _message("older-msg", datetime(2026, 1, 1, tzinfo=timezone.utc), subject="Application received")
    newer = _message("newer-msg", datetime(2026, 1, 5, tzinfo=timezone.utc), subject="Unfortunately, rejected")

    def fake_list_message_ids(access_token, max_results):
        return [newer["id"], older["id"]]  # Gmail order: newest first

    def fake_get_message(access_token, message_id):
        return {"older-msg": older, "newer-msg": newer}[message_id]

    classification_order: list[str] = []

    def fake_classify(batch):
        # batch is a list of (subject, sender, body) tuples, in whatever order sync_gmail
        # passes them - capture that order rather than the fetch order.
        classification_order.extend(subject for subject, _sender, _body in batch)
        return [
            EmailClassification(is_job_related=True, company="Acme", reasoning="job related") for _ in batch
        ]

    with patch.object(gmail_service, "_list_message_ids", fake_list_message_ids), patch.object(
        gmail_service, "_get_message", fake_get_message
    ), patch.object(gmail_service, "classify_emails", fake_classify), patch(
        "app.services.application_service.list_applications", return_value=[]
    ), patch(
        "app.services.application_service.create_application",
        return_value={"id": "app-1", "company": "Acme"},
    ):
        gmail_service.sync_gmail(MagicMock(), "user-1")

    assert classification_order == ["Application received", "Unfortunately, rejected"]


def test_creates_an_application_even_when_first_seen_status_is_not_applied(monkeypatch):
    """Regression test for a real bug: the create-vs-ignore branch used to require
    detected_status == "applied" to create a new application, so a company whose first-seen
    email was e.g. an interview invite (no prior "applied" confirmation ever synced) was
    silently ignored even though the classifier correctly identified it as job-related."""
    monkeypatch.setattr(gmail_service, "_list_message_ids", lambda token, max_results: ["msg-1"])
    monkeypatch.setattr(
        gmail_service, "_get_message", lambda token, mid: _message(mid, datetime.now(timezone.utc))
    )
    monkeypatch.setattr(
        gmail_service,
        "classify_emails",
        lambda batch: [
            EmailClassification(
                is_job_related=True,
                company="Acme",
                role="Backend Engineer",
                detected_status="pending_interview",
                entry_type=None,
                reasoning="Interview invite, no prior application email seen",
            )
        ],
    )
    monkeypatch.setattr("app.services.application_service.list_applications", lambda client, user_id: [])

    create_calls = []

    def fake_create(client, user_id, payload):
        create_calls.append(payload)
        return {"id": "app-new", "company": payload.company, "status": payload.status}

    monkeypatch.setattr("app.services.application_service.create_application", fake_create)

    result = gmail_service.sync_gmail(MagicMock(), "user-1")

    assert len(create_calls) == 1
    assert create_calls[0].company == "Acme"
    # Defaults to the detected status rather than requiring "applied" specifically.
    assert create_calls[0].status == "pending_interview"
    assert result.detected[0].suggested_action == "create_application"


def test_matches_an_existing_application_by_company_name_case_insensitively(monkeypatch):
    monkeypatch.setattr(gmail_service, "_list_message_ids", lambda token, max_results: ["msg-1"])
    monkeypatch.setattr(
        gmail_service, "_get_message", lambda token, mid: _message(mid, datetime.now(timezone.utc))
    )
    monkeypatch.setattr(
        gmail_service,
        "classify_emails",
        lambda batch: [
            EmailClassification(
                is_job_related=True,
                company="acme",
                detected_status="rejected",
                reasoning="Rejection email",
            )
        ],
    )
    monkeypatch.setattr(
        "app.services.application_service.list_applications",
        lambda client, user_id: [{"id": "existing-app", "company": "Acme Corp"}],
    )

    update_calls = []
    monkeypatch.setattr(
        "app.services.application_service.update_application",
        lambda client, user_id, application_id, payload: update_calls.append((application_id, payload)),
    )
    monkeypatch.setattr("app.services.application_service.create_application", MagicMock())

    result = gmail_service.sync_gmail(MagicMock(), "user-1")

    assert update_calls == [("existing-app", update_calls[0][1])]
    assert update_calls[0][1].status == "rejected"
    assert result.detected[0].suggested_action == "update_status"


def test_a_single_message_failing_does_not_sink_the_rest_of_the_batch(monkeypatch):
    """A transient write error on one message shouldn't lose every other message in the sync -
    see the try/except around the per-message write in sync_gmail."""
    monkeypatch.setattr(gmail_service, "_list_message_ids", lambda token, max_results: ["bad-msg", "good-msg"])
    monkeypatch.setattr(
        gmail_service,
        "_get_message",
        lambda token, mid: _message(mid, datetime.now(timezone.utc), subject=mid),
    )
    monkeypatch.setattr(
        gmail_service,
        "classify_emails",
        lambda batch: [
            EmailClassification(is_job_related=True, company="Acme", detected_status="applied", reasoning="r")
            for _ in batch
        ],
    )
    monkeypatch.setattr("app.services.application_service.list_applications", lambda client, user_id: [])

    call_count = {"n": 0}

    def fake_create(client, user_id, payload):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("simulated transient Postgrest error")
        return {"id": "app-good", "company": payload.company}

    monkeypatch.setattr("app.services.application_service.create_application", fake_create)

    result = gmail_service.sync_gmail(MagicMock(), "user-1")

    # The failing message is scanned but not in the successfully-detected results; the second
    # message still gets processed despite the first one raising.
    assert result.scanned == 2
    assert len(result.detected) == 1
