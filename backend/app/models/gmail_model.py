from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.application_model import ApplicationStatus


class GmailSyncStatus(BaseModel):
    connected: bool
    google_email: str | None = None
    last_synced_at: datetime | None = None


class GmailConnectUrl(BaseModel):
    auth_url: str


TimelineEntryType = Literal["applied", "rejected", "interview", "case_study", "other"]


class EmailClassification(BaseModel):
    is_job_related: bool = Field(description="Whether this email is about a job application")
    company: str | None = Field(default=None, description="The company name, if identifiable")
    role: str | None = Field(default=None, description="The job title/role, if identifiable")
    detected_status: ApplicationStatus | None = Field(
        default=None,
        description="What stage this email suggests: applied (confirmation), pending_interview "
        "(interview invite/scheduling), offer, or rejected. Null if unclear.",
    )
    entry_type: TimelineEntryType | None = Field(
        default=None,
        description="What kind of timeline event this email represents: applied, rejected, "
        "interview (invite/scheduling/confirmation), case_study (take-home assessment/technical "
        "exercise with a deadline), or other. Null if not job-related.",
    )
    summary: str = Field(
        default="",
        description="A short, one-line human-readable summary of what this email says, written "
        "for a timeline entry (e.g. 'Recruiter reached out — scheduling technical screen.'). "
        "Empty if not job-related.",
    )
    event_at: str | None = Field(
        default=None,
        description="ISO 8601 datetime if the email states a specific interview date/time. Null "
        "if not stated or not an interview email.",
    )
    meeting_link: str | None = Field(
        default=None, description="Meeting/video-call URL if present in the email body. Null otherwise."
    )
    deadline: str | None = Field(
        default=None,
        description="ISO 8601 date/datetime if the email states a submission deadline (e.g. for a "
        "case study or assessment). Null otherwise.",
    )
    reasoning: str = Field(description="One sentence explaining the classification")


class EmailAttachment(BaseModel):
    filename: str
    storage_path: str


class DetectedUpdate(BaseModel):
    gmail_message_id: str
    subject: str
    snippet: str
    received_at: datetime | None
    company: str | None
    role: str | None
    detected_status: ApplicationStatus | None
    entry_type: TimelineEntryType | None = None
    summary: str = ""
    reasoning: str
    suggested_action: Literal["create_application", "update_status", "ignore"]
    matching_application_id: str | None = None


class GmailSyncResult(BaseModel):
    scanned: int
    detected: list[DetectedUpdate]
