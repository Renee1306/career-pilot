from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.application import ApplicationStatus


class GmailSyncStatus(BaseModel):
    connected: bool
    google_email: str | None = None
    last_synced_at: datetime | None = None


class GmailConnectUrl(BaseModel):
    auth_url: str


class EmailClassification(BaseModel):
    is_job_related: bool = Field(description="Whether this email is about a job application")
    company: str | None = Field(default=None, description="The company name, if identifiable")
    role: str | None = Field(default=None, description="The job title/role, if identifiable")
    detected_status: ApplicationStatus | None = Field(
        default=None,
        description="What stage this email suggests: applied (confirmation), pending_interview "
        "(interview invite/scheduling), offer, or rejected. Null if unclear.",
    )
    reasoning: str = Field(description="One sentence explaining the classification")


class DetectedUpdate(BaseModel):
    gmail_message_id: str
    subject: str
    snippet: str
    received_at: datetime | None
    company: str | None
    role: str | None
    detected_status: ApplicationStatus | None
    reasoning: str
    suggested_action: Literal["create_application", "update_status", "ignore"]
    matching_application_id: str | None = None


class GmailSyncResult(BaseModel):
    scanned: int
    detected: list[DetectedUpdate]
