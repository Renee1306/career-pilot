from datetime import datetime

from pydantic import BaseModel, Field


class JobExplanation(BaseModel):
    overview: str = Field(description="A 2-3 sentence plain-language summary of what this job actually is")
    key_responsibilities: list[str] = Field(default_factory=list)
    key_skills: list[str] = Field(default_factory=list)
    examples: list[str] = Field(
        default_factory=list, description="Concrete, relatable examples of tasks someone in this role does"
    )
    who_thrives: str = Field(description="A short note on what kind of person tends to do well in this role")


class DayBlock(BaseModel):
    time_block: str
    activities: str


class TypicalDay(BaseModel):
    summary: str
    schedule: list[DayBlock] = Field(default_factory=list)


class ResumeMatch(BaseModel):
    match_score: int = Field(description="0-100 estimate of how well the resume matches the job")
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(
        default_factory=list, description="Actionable suggestions for editing the resume to better match"
    )


class ResumeMatchRequest(BaseModel):
    resume_id: str


class TranslateRequest(BaseModel):
    language: str = Field(description="Target language, e.g. 'Spanish' or 'zh-Hans'")


class JobDescriptionCreate(BaseModel):
    company: str | None = None
    title: str | None = None
    raw_text: str
    source_url: str | None = None


class JobDescriptionOut(BaseModel):
    id: str
    user_id: str
    company: str | None
    title: str | None
    raw_text: str
    source_url: str | None
    created_at: datetime


class JobAnalysisOut(BaseModel):
    id: str
    user_id: str
    job_description_id: str
    resume_id: str | None
    explanation: dict | None
    typical_day: dict | None
    match_suggestions: dict | None
    translations: dict
    created_at: datetime
