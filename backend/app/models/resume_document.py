from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

PhotoShape = Literal["circle", "square", "rounded"]
Fluency = Literal["basic", "conversational", "fluent", "native"]
SectionKey = Literal[
    "summary",
    "work_experience",
    "education",
    "projects",
    "skills",
    "certificates",
    "awards",
    "languages",
    "volunteer",
    "references",
]
FIXED_SECTION_KEYS: list[SectionKey] = [
    "summary",
    "work_experience",
    "education",
    "projects",
    "skills",
    "certificates",
    "awards",
    "languages",
    "volunteer",
    "references",
]
DEFAULT_SECTION_ORDER: list[SectionKey] = list(FIXED_SECTION_KEYS)


class PhotoStyle(BaseModel):
    size: int = 96
    shape: PhotoShape = "circle"
    border: bool = True


class BasicInfo(BaseModel):
    full_name: str = ""
    age: str | None = None
    gender: str | None = None
    location: str | None = None
    email: str | None = None
    phone: str | None = None
    photo: PhotoStyle = Field(default_factory=PhotoStyle)


class SummarySection(BaseModel):
    text: str = ""


class WorkExperienceEntry(BaseModel):
    id: str
    company: str = ""
    position: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""


class EducationEntry(BaseModel):
    id: str
    school: str = ""
    major: str = ""
    degree: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""


class SkillsSection(BaseModel):
    items: list[str] = Field(default_factory=list)


class CertificateEntry(BaseModel):
    id: str
    name: str = ""
    date: str = ""


class ProjectEntry(BaseModel):
    id: str
    name: str = ""
    period: str = ""
    website: str | None = None
    description: str = ""


class AwardEntry(BaseModel):
    id: str
    title: str = ""
    awarder: str = ""
    date: str = ""
    website: str | None = None
    description: str = ""


class LanguageEntry(BaseModel):
    id: str
    language: str = ""
    fluency: Fluency = "conversational"


class VolunteerEntry(BaseModel):
    id: str
    organization: str = ""
    role: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""


class ReferenceEntry(BaseModel):
    id: str
    name: str = ""
    relationship: str = ""
    contact: str = ""
    description: str = ""


class CustomSection(BaseModel):
    id: str
    title: str = "Custom Section"
    content: str = ""


class ResumeContent(BaseModel):
    basic_info: BasicInfo = Field(default_factory=BasicInfo)
    summary: SummarySection = Field(default_factory=SummarySection)
    work_experience: list[WorkExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    skills: SkillsSection = Field(default_factory=SkillsSection)
    certificates: list[CertificateEntry] = Field(default_factory=list)
    awards: list[AwardEntry] = Field(default_factory=list)
    languages: list[LanguageEntry] = Field(default_factory=list)
    volunteer: list[VolunteerEntry] = Field(default_factory=list)
    references: list[ReferenceEntry] = Field(default_factory=list)
    custom_sections: list[CustomSection] = Field(default_factory=list)
    section_order: list[str] = Field(default_factory=lambda: list(DEFAULT_SECTION_ORDER))
    enabled_sections: dict[str, bool] = Field(
        default_factory=lambda: {k: True for k in DEFAULT_SECTION_ORDER}
    )


class ResumeStyle(BaseModel):
    accent_color: str = "#ff6b3d"
    margin_top: int = 40
    margin_right: int = 40
    margin_bottom: int = 40
    margin_left: int = 40
    font_family: str = "'Plus Jakarta Sans', sans-serif"
    name_font_size: int = 20
    heading_font_size: int = 20
    body_font_size: int = 13
    line_height: float = 1.5


class ResumeDocumentCreate(BaseModel):
    name: str = "Untitled Resume"
    template_id: str = "classic"


class ResumeDocumentUpdate(BaseModel):
    name: str | None = None
    template_id: str | None = None
    content: ResumeContent | None = None
    style: ResumeStyle | None = None


class ResumeDocumentListItem(BaseModel):
    id: str
    name: str
    template_id: str
    photo_url: str | None
    created_at: datetime
    updated_at: datetime


class ResumeDocumentOut(ResumeDocumentListItem):
    user_id: str
    content: ResumeContent
    style: ResumeStyle


class EnhanceTextRequest(BaseModel):
    text: str
    context: str | None = None


class EnhanceTextResponse(BaseModel):
    text: str


class JDMatchRequest(BaseModel):
    jd_text: str


class JDMatchEvaluation(BaseModel):
    match_score: int
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


class ResumeSuggestion(BaseModel):
    """One reviewable edit from the "hint" path. `entry_id` is the real `WorkExperienceEntry.id`
    (null for whole-section targets), so the frontend applies an accepted suggestion by id rather
    than by list position - the user can reorder or delete entries while the modal is open."""

    target: Literal["summary", "work_experience", "skills"]
    entry_id: str | None = None
    entry_label: str = ""
    original_text: str = ""
    suggested_text: str = ""
    reason: str = ""


class JDSuggestions(BaseModel):
    suggestions: list[ResumeSuggestion] = Field(default_factory=list)
