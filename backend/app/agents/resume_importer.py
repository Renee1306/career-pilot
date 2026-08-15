import base64
import uuid

from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

from app.agents._llm import get_llm
from app.models.resume_document_model import (
    AwardEntry,
    BasicInfo,
    CertificateEntry,
    EducationEntry,
    LanguageEntry,
    ProjectEntry,
    ResumeContent,
    SkillGroup,
    SkillsSection,
    SummarySection,
    VolunteerEntry,
    WorkExperienceEntry,
)

EXTRACTION_PROMPT = (
    "You are given a resume as a file. Extract its contents into the structured format.\n\n"
    "Transcribe what is actually written - do not invent, embellish, or infer information that "
    "is not in the document. Leave a field as an empty string and a list empty if the resume "
    "does not contain it. Keep each work experience/project/education/award/volunteer description "
    "close to the original wording; do not rewrite it into new prose.\n\n"
    "If a description is a list of bullet points in the original document, put each bullet on its "
    "own line in the description field, separated by a newline character - do not join them into "
    "one running paragraph, and do not add your own bullet markers (-, *, •) since those are "
    "rendered by the app. Only join text into a single line when the original genuinely is one "
    "continuous sentence or paragraph, not a list.\n\n"
    "Put each distinct role under work_experience (most recent first, matching the document's "
    "own order), and only put genuinely separate personal/side projects under projects.\n\n"
    "For skills, keep whatever grouping the resume itself uses: a line like 'Programming "
    "Languages: Python, C, Java' becomes one group with category 'Programming Languages' and "
    "those three items. If the resume just lists skills with no headings, return a single group "
    "with an empty category holding all of them - do not invent categories it does not use."
)

FLUENCY_VALUES = {"basic", "conversational", "fluent", "native"}


# The LLM-facing schema deliberately mirrors ResumeContent's sections *without* the per-entry `id`
# fields. Entry ids are structural (the editor keys its forms off them) - generating them
# server-side means the model can't emit duplicate/missing ids and break the editor.
class _Work(BaseModel):
    company: str = ""
    position: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""


class _Education(BaseModel):
    school: str = ""
    major: str = ""
    degree: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""


class _Project(BaseModel):
    name: str = ""
    period: str = ""
    description: str = ""


class _Certificate(BaseModel):
    name: str = ""
    date: str = ""


class _Award(BaseModel):
    title: str = ""
    awarder: str = ""
    date: str = ""
    description: str = ""


class _Language(BaseModel):
    language: str = ""
    fluency: str = "conversational"


class _Volunteer(BaseModel):
    organization: str = ""
    role: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""


class _SkillGroup(BaseModel):
    category: str = ""
    items: list[str] = Field(default_factory=list)


class ImportedResume(BaseModel):
    full_name: str = ""
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    summary: str = ""
    work_experience: list[_Work] = Field(default_factory=list)
    education: list[_Education] = Field(default_factory=list)
    projects: list[_Project] = Field(default_factory=list)
    skills: list[_SkillGroup] = Field(default_factory=list)
    certificates: list[_Certificate] = Field(default_factory=list)
    awards: list[_Award] = Field(default_factory=list)
    languages: list[_Language] = Field(default_factory=list)
    volunteer: list[_Volunteer] = Field(default_factory=list)


def _new_id() -> str:
    return str(uuid.uuid4())


def _fluency(value: str) -> str:
    normalized = (value or "").strip().lower()
    return normalized if normalized in FLUENCY_VALUES else "conversational"


def to_resume_content(parsed: ImportedResume) -> ResumeContent:
    content = ResumeContent(
        basic_info=BasicInfo(
            full_name=parsed.full_name,
            email=parsed.email,
            phone=parsed.phone,
            location=parsed.location,
        ),
        summary=SummarySection(text=parsed.summary),
        work_experience=[
            WorkExperienceEntry(
                id=_new_id(),
                company=w.company,
                position=w.position,
                start_date=w.start_date,
                end_date=w.end_date,
                description=w.description,
            )
            for w in parsed.work_experience
        ],
        education=[
            EducationEntry(
                id=_new_id(),
                school=e.school,
                major=e.major,
                degree=e.degree,
                start_date=e.start_date,
                end_date=e.end_date,
                description=e.description,
            )
            for e in parsed.education
        ],
        projects=[
            ProjectEntry(id=_new_id(), name=p.name, period=p.period, description=p.description)
            for p in parsed.projects
        ],
        skills=SkillsSection(
            groups=[
                SkillGroup(id=_new_id(), category=group.category.strip(), items=group.items)
                for group in parsed.skills
                if group.items
            ]
        ),
        certificates=[CertificateEntry(id=_new_id(), name=c.name, date=c.date) for c in parsed.certificates],
        awards=[
            AwardEntry(id=_new_id(), title=a.title, awarder=a.awarder, date=a.date, description=a.description)
            for a in parsed.awards
        ],
        languages=[
            LanguageEntry(id=_new_id(), language=lang.language, fluency=_fluency(lang.fluency))
            for lang in parsed.languages
        ],
        volunteer=[
            VolunteerEntry(
                id=_new_id(),
                organization=v.organization,
                role=v.role,
                start_date=v.start_date,
                end_date=v.end_date,
                description=v.description,
            )
            for v in parsed.volunteer
        ],
    )

    # Sections the uploaded resume had nothing for start disabled rather than enabled-but-empty,
    # so the imported document doesn't render a wall of empty headings in the preview. The user can
    # still re-enable any of them from the section list to fill in by hand.
    populated = {
        "summary": bool(content.summary.text.strip()),
        "work_experience": bool(content.work_experience),
        "education": bool(content.education),
        "projects": bool(content.projects),
        "skills": bool(content.skills.groups),
        "certificates": bool(content.certificates),
        "awards": bool(content.awards),
        "languages": bool(content.languages),
        "volunteer": bool(content.volunteer),
        "references": False,
    }
    content.enabled_sections = {key: populated.get(key, False) for key in content.section_order}
    return content


def import_resume(file_bytes: bytes, mime_type: str) -> ResumeContent:
    """Multimodal (PDF/image) extraction straight into the Resume Builder's document shape.

    Deliberately separate from `resume_parser.parse_resume`, which targets the upload/matching
    flow's flatter `ResumeParsed` (and its `raw_text` transcription) - that shape has no projects/
    awards/languages/volunteer/certificates, so reusing it here would silently drop half of what
    the builder can represent.
    """
    structured_llm = get_llm().with_structured_output(ImportedResume)
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    message = HumanMessage(
        content=[
            {"type": "text", "text": EXTRACTION_PROMPT},
            {"type": "media", "mime_type": mime_type, "data": encoded},
        ]
    )
    return to_resume_content(structured_llm.invoke([message]))
