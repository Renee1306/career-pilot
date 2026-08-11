from datetime import datetime

from pydantic import BaseModel, Field


class ResponsibilityItem(BaseModel):
    responsibility: str
    simple_explanation: str
    example: str = Field(description="A practical example of what the candidate might actually do")


class RequirementItem(BaseModel):
    requirement: str
    why_it_matters: str
    evidence: str = Field(description="The text/phrasing from the job description that supports this")
    explanation: str


class RequirementBreakdown(BaseModel):
    hard_requirements: list[RequirementItem] = Field(
        default_factory=list, description="Skills/qualifications likely essential to performing the role"
    )
    learnable: list[RequirementItem] = Field(
        default_factory=list, description="Skills that could reasonably be learned after joining"
    )
    bonus: list[RequirementItem] = Field(
        default_factory=list, description="Nice-to-have skills that would make a candidate stand out"
    )


class KeyTerm(BaseModel):
    term: str
    simple_explanation: str = Field(description="Explained as if speaking to a fresh graduate")
    example: str


class InterviewQuestions(BaseModel):
    hr_questions: list[str] = Field(description="General/HR questions, e.g. 'Why this role?'")
    role_questions: list[str] = Field(
        description="Basic technical/role questions tied directly to the JD's responsibilities and requirements"
    )


class JobExplanation(BaseModel):
    one_sentence_summary: str = Field(description="What the candidate would actually do, in one simple sentence")
    top_responsibilities: list[ResponsibilityItem] = Field(
        description="Exactly the 3 most important responsibilities"
    )
    requirements: RequirementBreakdown
    key_terms: list[KeyTerm] = Field(description="3-6 of the most important terms from the job description")
    likely_questions: InterviewQuestions


class DayPeriod(BaseModel):
    approximate_time: str
    activity: str
    description: str = Field(description="What the candidate would actually do in this period")
    rationale: str = Field(description="Why this activity is likely, based on the job description")


class DayBreakdown(BaseModel):
    morning: DayPeriod
    afternoon: DayPeriod
    end_of_day: DayPeriod


class TimeAllocation(BaseModel):
    technical_development: int = Field(description="Percent of time, 0-100")
    meetings_communication: int
    analysis_problem_solving: int
    testing_qa: int
    documentation_administrative: int
    research_learning: int
    other: int


class Collaborator(BaseModel):
    who: str
    why: str
    example_interaction: str


class TypicalDay(BaseModel):
    overview: str = Field(description="2-3 sentences on what you'd probably spend most of the day doing")
    day_breakdown: DayBreakdown
    time_allocation: TimeAllocation = Field(description="Estimated percentages that should sum to 100")
    collaborators: list[Collaborator]
    surprises: list[str] = Field(description="3-5 realistic, labeled-as-estimate observations about the role")


class ResumeEdit(BaseModel):
    original_text: str = Field(
        description="An exact, character-for-character contiguous substring copied from the resume text"
    )
    suggested_text: str = Field(description="The proposed replacement for original_text")
    reason: str = Field(description="Why this change would better match the job")


class ResumeMatch(BaseModel):
    match_score: int = Field(description="0-100 estimate of how well the resume matches the job")
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    edits: list[ResumeEdit] = Field(
        default_factory=list, description="Up to 8 highest-impact, specific edit suggestions"
    )
    summary: str = Field(description="A short paragraph summarizing the overall recommended changes and why")


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
