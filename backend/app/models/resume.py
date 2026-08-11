from datetime import datetime

from pydantic import BaseModel, Field


class ExperienceEntry(BaseModel):
    title: str | None = None
    company: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None


class EducationEntry(BaseModel):
    institution: str | None = None
    degree: str | None = None
    field: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class ResumeParsed(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    raw_text: str = ""


class ResumeCreate(BaseModel):
    label: str | None = None
    file_url: str | None = None
    parsed_text: str | None = None
    parsed_json: dict | None = None


class ResumeOut(BaseModel):
    id: str
    user_id: str
    label: str | None
    file_url: str | None
    parsed_text: str | None
    parsed_json: dict | None
    version: int
    created_at: datetime


class ResumeExportRequest(BaseModel):
    text: str
    filename: str | None = None
