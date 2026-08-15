from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.interview_model import QnARoundType

ApplicationStatus = Literal["applied", "pending_interview", "offer", "rejected"]
TimelineEntryType = Literal["applied", "rejected", "interview", "case_study", "note"]


class ApplicationCreate(BaseModel):
    job_description_id: str | None = None
    resume_document_id: str | None = None
    status: ApplicationStatus = "applied"
    applied_date: date | None = None
    company: str | None = None
    position: str | None = None


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus | None = None
    applied_date: date | None = None
    company: str | None = None
    position: str | None = None


class TimelineEntryCreate(BaseModel):
    entry_type: TimelineEntryType
    occurred_at: datetime | None = None
    content: str = ""
    details: dict = Field(default_factory=dict)


class TimelineEntryUpdate(BaseModel):
    occurred_at: datetime | None = None
    content: str | None = None
    details: dict | None = None


class TimelineEntryOut(BaseModel):
    id: str
    entry_type: TimelineEntryType
    occurred_at: datetime
    content: str
    details: dict
    source: str
    created_at: datetime
    updated_at: datetime


class CompanySnapshot(BaseModel):
    culture: str
    core_values: list[str] = Field(default_factory=list)
    engineering_focus: str
    interview_themes: list[str] = Field(default_factory=list)


class InterviewQuestionsRequest(BaseModel):
    round_type: QnARoundType
    jd_text: str | None = Field(
        default=None,
        description="JD to ground the questions in. Optional: falls back to the application's "
        "linked job description when it has one.",
    )
    resume_document_id: str | None = Field(
        default=None,
        description="Resume Builder document to ground the questions in. Optional: falls back to "
        "the resume document linked to the application.",
    )


class ApplicationOut(BaseModel):
    id: str
    user_id: str
    job_description_id: str | None
    resume_document_id: str | None
    status: ApplicationStatus
    applied_date: date | None
    company: str | None
    position: str | None
    company_snapshot: dict | None
    # Keyed by round_type ("hr"/"technical") so both sets coexist on one application and
    # regenerating one never clobbers the other.
    interview_questions: dict | None = None
    timeline: list[TimelineEntryOut]
    created_at: datetime
    updated_at: datetime
