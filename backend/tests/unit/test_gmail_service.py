"""Pure-logic pieces of gmail_service.py - OAuth state signing (security-critical, no I/O) and
MIME payload parsing (previously only verified by hand with a synthetic payload, per
PROJECT_CONTEXT.md's "Gmail sync" section - this formalizes that as an automated test). The
actual Gmail/Google HTTP calls and sync_gmail's branching logic are covered separately in
test_gmail_sync.py with everything I/O-bound mocked out."""

import base64

import pytest

from app.services import gmail_service


class TestStateSigning:
    def test_verify_state_recovers_the_user_id_from_a_freshly_signed_state(self):
        state = gmail_service.sign_state("user-123")
        assert gmail_service.verify_state(state) == "user-123"

    def test_tampered_user_id_is_rejected(self):
        state = gmail_service.sign_state("user-123")
        # Swap the payload but keep the original signature - this is exactly what an attacker
        # forging the OAuth callback's state param would try.
        _, signature = state.split(".", 1)
        forged = f"attacker-id.{signature}"
        with pytest.raises(ValueError, match="Invalid OAuth state signature"):
            gmail_service.verify_state(forged)

    def test_tampered_signature_is_rejected(self):
        state = gmail_service.sign_state("user-123")
        user_id, signature = state.split(".", 1)
        with pytest.raises(ValueError, match="Invalid OAuth state signature"):
            gmail_service.verify_state(f"{user_id}.{signature[:-1]}0")

    def test_malformed_state_is_rejected(self):
        with pytest.raises(ValueError, match="Malformed OAuth state"):
            gmail_service.verify_state("not-a-valid-state-string")


class TestDecodeBodyData:
    def test_decodes_url_safe_base64_without_padding(self):
        # Gmail's API returns body data as url-safe base64 with padding stripped - the classic
        # source of an "Incorrect padding" error if you don't re-pad it first.
        raw = "Hello, world! This needs padding."
        encoded = base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")
        assert gmail_service._decode_body_data(encoded) == raw


class TestExtractBodyAndAttachments:
    def _b64(self, text: str) -> str:
        return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")

    def test_prefers_text_plain_over_text_html(self):
        payload = {
            "mimeType": "multipart/alternative",
            "parts": [
                {"mimeType": "text/plain", "body": {"data": self._b64("Plain body")}},
                {"mimeType": "text/html", "body": {"data": self._b64("<p>HTML body</p>")}},
            ],
        }
        body, attachments = gmail_service._extract_body_and_attachments(payload)
        assert body == "Plain body"
        assert attachments == []

    def test_falls_back_to_stripped_html_when_no_plain_text(self):
        payload = {
            "mimeType": "multipart/alternative",
            "parts": [{"mimeType": "text/html", "body": {"data": self._b64("<p>Only HTML</p>")}}],
        }
        body, _ = gmail_service._extract_body_and_attachments(payload)
        assert "Only HTML" in body
        assert "<p>" not in body

    def test_finds_pdf_attachment_by_filename_when_mime_type_is_generic(self):
        payload = {
            "mimeType": "multipart/mixed",
            "parts": [
                {"mimeType": "text/plain", "body": {"data": self._b64("See attached.")}},
                {
                    "mimeType": "application/octet-stream",
                    "filename": "assessment.pdf",
                    "body": {"attachmentId": "att-1"},
                },
            ],
        }
        body, attachments = gmail_service._extract_body_and_attachments(payload)
        assert body == "See attached."
        assert attachments == [
            {"filename": "assessment.pdf", "attachment_id": "att-1", "mime_type": "application/octet-stream"}
        ]

    def test_ignores_non_pdf_attachments(self):
        payload = {
            "mimeType": "multipart/mixed",
            "parts": [
                {"mimeType": "text/plain", "body": {"data": self._b64("Body")}},
                {"mimeType": "image/png", "filename": "logo.png", "body": {"attachmentId": "att-2"}},
            ],
        }
        _, attachments = gmail_service._extract_body_and_attachments(payload)
        assert attachments == []

    def test_walks_nested_multipart_parts(self):
        payload = {
            "mimeType": "multipart/mixed",
            "parts": [
                {
                    "mimeType": "multipart/alternative",
                    "parts": [{"mimeType": "text/plain", "body": {"data": self._b64("Nested body")}}],
                },
                {"mimeType": "application/pdf", "filename": "resume.pdf", "body": {"attachmentId": "att-3"}},
            ],
        }
        body, attachments = gmail_service._extract_body_and_attachments(payload)
        assert body == "Nested body"
        assert len(attachments) == 1

    def test_empty_payload_yields_empty_body_and_no_attachments(self):
        body, attachments = gmail_service._extract_body_and_attachments({})
        assert body == ""
        assert attachments == []


class TestParseIso:
    def test_parses_a_z_suffixed_timestamp(self):
        result = gmail_service._parse_iso("2026-01-15T10:00:00Z")
        assert result is not None
        assert result.year == 2026
        assert result.month == 1
        assert result.day == 15

    def test_returns_none_for_none_input(self):
        assert gmail_service._parse_iso(None) is None

    def test_returns_none_for_empty_string(self):
        assert gmail_service._parse_iso("") is None

    def test_returns_none_for_unparseable_string(self):
        assert gmail_service._parse_iso("not a date") is None
