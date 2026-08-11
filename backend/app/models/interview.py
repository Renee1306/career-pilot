from datetime import datetime
from typing import Literal

from pydantic import BaseModel

RoundType = Literal["hr", "hiring_manager", "technical", "other"]


class InterviewRoundCreate(BaseModel):
    application_id: str
    round_type: RoundType = "hr"
    scheduled_at: datetime | None = None
    link: str | None = None
    notes: str | None = None


class InterviewRoundUpdate(BaseModel):
    round_type: RoundType | None = None
    scheduled_at: datetime | None = None
    link: str | None = None
    notes: str | None = None
    generated_qna: dict | None = None


class InterviewRoundOut(BaseModel):
    id: str
    user_id: str
    application_id: str
    round_type: RoundType
    scheduled_at: datetime | None
    link: str | None
    notes: str | None
    generated_qna: dict | None
    created_at: datetime
