from typing import Literal

from pydantic import BaseModel, Field

# The two rounds prep can be generated for. "hr"/"technical" are retained only so interview rounds
# already saved under the old names still validate on read - nothing generates them any more.
QnARoundType = Literal["behavioural", "hiring_manager"]


QuestionPriority = Literal["high", "medium", "lower"]


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
    category: str = Field(
        default="",
        description="Short competency label for this question, e.g. Leadership, Problem-Solving, "
        "Technical Depth - vocabulary appropriate to the round type",
    )
    priority: QuestionPriority = Field(
        default="medium",
        description="How likely the candidate is to actually be asked this in the round",
    )


class InterviewQnA(BaseModel):
    questions: list[QnAItem] = Field(
        description="5-10 likely questions for this interview round - exactly 10 for the "
        "hiring_manager round"
    )
