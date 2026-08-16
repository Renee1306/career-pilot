from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator

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


class SkillGroup(BaseModel):
    """One category of skills, rendered as a single bullet ("Data Tools: R, MySQL, SAS").

    An empty `category` means an uncategorised group, which renders as a bare list of skills -
    that is what a resume that never used categories upgrades into.
    """

    id: str
    category: str = ""
    items: list[str] = Field(default_factory=list)


class SkillsSection(BaseModel):
    groups: list[SkillGroup] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _upgrade_legacy_flat_list(cls, data):
        """Migrate the old `{"items": ["Python", ...]}` shape read straight out of the database.

        Documents were stored as a flat list of strings before categories existed, and importers
        routinely produced entries like "Programming Languages: Python, C, Java" - a category the
        user clearly intended but that the old shape had nowhere to put. Those are split back into
        a real category with real items; anything without that shape collects into one
        uncategorised group. Runs on read, so a document upgrades the next time it is saved.
        """
        if not isinstance(data, dict) or "groups" in data:
            return data

        legacy = data.get("items")
        if not isinstance(legacy, list):
            return data

        groups: list[dict] = []
        loose: list[str] = []
        for raw in legacy:
            if not isinstance(raw, str) or not raw.strip():
                continue
            category, separator, tail = raw.partition(":")
            # A short leading segment before a colon reads as a category label; a long one is
            # almost certainly a sentence that happens to contain a colon, so it stays a skill.
            if separator and 0 < len(category.strip()) <= 40 and tail.strip():
                items = [part.strip() for part in tail.split(",") if part.strip()]
                if items:
                    groups.append({"id": str(uuid4()), "category": category.strip(), "items": items})
                    continue
            loose.append(raw.strip())

        if loose:
            groups.append({"id": str(uuid4()), "category": "", "items": loose})
        return {"groups": groups}


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
    # One colour per text role, mirroring the three size controls. The heading default matches
    # accent_color so resumes saved before these fields existed keep their exact look.
    name_color: str = "#211f26"
    heading_color: str = "#ff6b3d"
    body_color: str = "#211f26"
    text_align: Literal["left", "center", "right", "justify"] = "left"


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


class GenerateSummaryResponse(BaseModel):
    text: str


class JDMatchRequest(BaseModel):
    jd_text: str


class CoverLetterRequest(BaseModel):
    jd_text: str
    company: str | None = None
    position: str | None = None


class CoverLetterResponse(BaseModel):
    text: str


class CoverLetterExportRequest(BaseModel):
    text: str
    company: str | None = None
    position: str | None = None


HintTarget = Literal["summary", "work_experience", "projects", "skills"]


class ResumeHint(BaseModel):
    """One reviewable edit, surfaced as an inline hint on the resume preview.

    Addressed by (target, entry_id, original_text) rather than by list position, so the user can
    reorder or delete entries while hints are still pending; `bullet_index` is only the fallback
    for when the original line can no longer be matched verbatim.

    `mode` distinguishes the two things a hint can do: "replace" rewords a line that is already
    there (the JD-keyword reframe path), while "append" adds a brand-new line - which only ever
    happens after the candidate has confirmed the underlying experience in the gap conversation.

    A "replace" hint can also restructure a bullet rather than just reword it: `suggested_text`
    may hold two newline-separated lines to split one overloaded bullet into two, and
    `merge_bullet_index` may name a second original bullet - in the same entry - that
    `suggested_text` folds into this one, combining both into a single line. `original_text`
    then holds both source lines, newline-separated, in (bullet_index, merge_bullet_index) order.
    """

    id: str
    target: HintTarget
    entry_id: str | None = None
    entry_label: str = ""
    bullet_index: int | None = None
    merge_bullet_index: int | None = None
    mode: Literal["replace", "append"] = "replace"
    original_text: str = ""
    suggested_text: str = ""
    reason: str = ""
    source: Literal["reframe", "gap", "quantify"] = "reframe"


GapCategory = Literal["hard_skill", "soft_skill", "industry_term"]


class JDGap(BaseModel):
    """One thing the JD asks for that the resume doesn't currently evidence. Kept as a structured
    object rather than a bare string because the gap conversation is driven per-gap."""

    id: str
    title: str
    detail: str
    category: GapCategory = "hard_skill"


class QuantifyCandidate(BaseModel):
    """One resume bullet that reads as an accomplishment but carries no number - the gap the
    quantify interview exists to close, detected without an LLM call since it's just presence
    or absence of a digit in the bullet text."""

    id: str
    target: Literal["work_experience", "projects"]
    entry_id: str | None = None
    entry_label: str = ""
    bullet_index: int | None = None
    text: str = ""


class JDReview(BaseModel):
    match_score: int = 0
    strengths: list[str] = Field(default_factory=list)
    gaps: list[JDGap] = Field(default_factory=list)
    hints: list[ResumeHint] = Field(default_factory=list)
    quantify_candidates: list[QuantifyCandidate] = Field(default_factory=list)


class CoachMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class GapTurnRequest(BaseModel):
    jd_text: str
    gap: JDGap
    strengths: list[str] = Field(default_factory=list)
    history: list[CoachMessage] = Field(default_factory=list)


class QuantifyTurnRequest(BaseModel):
    candidate: QuantifyCandidate
    history: list[CoachMessage] = Field(default_factory=list)


class GapTurnResponse(BaseModel):
    """`status` drives the whole gap loop:

    - "asking"   - `message` is the next question; no resume changes are proposed.
    - "ready"    - the candidate gave enough real detail; `hints` are grounded in their answers.
    - "declined" - the candidate doesn't have this experience. `hints` is always empty here; this
                   is the case the whole flow exists to protect, so nothing is ever written.
    """

    status: Literal["asking", "ready", "declined"]
    message: str = ""
    hints: list[ResumeHint] = Field(default_factory=list)
