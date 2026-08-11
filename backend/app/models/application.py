from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

ApplicationStatus = Literal["applied", "pending_interview", "offer", "rejected"]


class ApplicationCreate(BaseModel):
    job_description_id: str | None = None
    resume_id: str | None = None
    status: ApplicationStatus = "applied"
    applied_date: date | None = None


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus | None = None
    applied_date: date | None = None
    timeline: list[dict] | None = None


class TimelineEntryCreate(BaseModel):
    note: str


class ApplicationOut(BaseModel):
    id: str
    user_id: str
    job_description_id: str | None
    resume_id: str | None
    status: ApplicationStatus
    applied_date: date | None
    timeline: list[dict]
    created_at: datetime
    updated_at: datetime
