from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RoundType = Literal["hr", "hiring_manager", "technical", "other"]


class QnAItem(BaseModel):
    question: str
    suggested_answer: str = Field(description="A suggested answer grounded in the candidate's actual resume")


class InterviewQnA(BaseModel):
    questions: list[QnAItem] = Field(description="5-8 likely questions for this interview round")


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
