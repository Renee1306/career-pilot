from datetime import datetime

from pydantic import BaseModel


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
