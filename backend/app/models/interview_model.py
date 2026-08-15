from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# The two rounds prep can be generated for. "hr"/"technical" are retained only so interview rounds
# already saved under the old names still validate on read - nothing generates them any more.
QnARoundType = Literal["behavioural", "hiring_manager"]
RoundType = Literal["behavioural", "hiring_manager", "hr", "technical", "other"]


class QnAItem(BaseModel):
    """Deliberately holds no written answer. The candidate gets the question plus the shape of a
    good response, so they walk in able to answer in their own words and defend a follow-up."""

    question: str = Field(description="The question as an interviewer would actually phrase it")
    answer_should_cover: list[str] = Field(
        default_factory=list,
        description="2-4 short instructions on what a strong answer must include - what to do, "
        "not sentences to recite back",
    )
    draw_on: str = Field(
        default="",
        description="The specific experience on the candidate's resume to build this answer from, "
        "named as it appears there",
    )


class InterviewQnA(BaseModel):
    questions: list[QnAItem] = Field(description="5-8 likely questions for this interview round")


class InterviewRoundCreate(BaseModel):
    application_id: str
    round_type: RoundType = "behavioural"
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
