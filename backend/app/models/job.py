from datetime import datetime

from pydantic import BaseModel


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
