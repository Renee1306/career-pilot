import copy

from pydantic import BaseModel, Field

from app.agents._llm import get_openrouter_llm
from app.models.resume_document import JDMatchEvaluation, ResumeSuggestion

EVAL_PROMPT = """You are the Resume Builder's JD-match evaluator for CareerPilot.

Compare the candidate's resume against the job description below. Score how well the resume
currently matches the job on a 0-100 scale, list the resume's genuine strengths relative to this
job, and list the key gaps (skills, experience, or terminology the JD wants but the resume doesn't
clearly show).

Job description:
{jd_text}

Resume:
{resume_text}
"""

CUSTOMIZE_PROMPT = """You are the Resume Builder's JD-tailoring agent for CareerPilot.

Rewrite the resume's personal statement (summary) and work experience descriptions so they speak
more directly to the job description below, using the JD's own terminology where it genuinely
applies. Also reorder/select from the candidate's existing skills list to foreground the ones most
relevant to this job.

CRITICAL - do not invent experience. The job description names technologies the candidate may not
have. You must never claim experience with any technology, tool, platform, service, or methodology
that does not already appear in the resume. If the JD asks for FastAPI and the resume only shows
Flask, keep Flask - do not write FastAPI anywhere. If the JD asks for AWS and the resume never
mentions it, do not name AWS or any of its services. Never bridge a gap by asserting the missing
skill; the candidate will be interviewed on whatever this resume claims.

You may only reword, re-emphasize, and reorder what is genuinely already there. The skills list you
return must only contain skills that already appear in the resume's skills list below - do not add
new skills.

There are exactly {exp_count} work experience entries, in order. Return exactly {exp_count}
descriptions in the same order, one per entry (an empty string if an entry's original description
was empty and there's nothing meaningful to say for that job).

Each description must contain only the description prose itself. Never repeat the job title,
company name, or dates inside a description - the resume template renders those separately.

Job description:
{jd_text}

Resume:
{resume_text}

Candidate's current skills list (only select/reorder from these): {skills_list}
"""


SUGGEST_PROMPT = """You are the Resume Builder's JD-tailoring reviewer for CareerPilot.

Propose targeted improvements that make this resume speak more directly to the job description,
using the JD's own terminology where it genuinely applies. The candidate will review each
suggestion one by one and accept or reject it, so every suggestion needs a short, specific reason
explaining what it improves for *this* job.

CRITICAL - do not invent experience. The job description names technologies the candidate may not
have. You must never claim experience with any technology, tool, platform, service, or methodology
that does not already appear in the resume. If the JD asks for FastAPI and the resume only shows
Flask, keep Flask - do not write FastAPI anywhere. If the JD asks for AWS and the resume never
mentions it, do not name AWS or any of its services. Never bridge a gap by asserting the missing
skill; the candidate will be interviewed on whatever this resume claims.

You may only reword, re-emphasize, and reorder what is genuinely already there - including framing
real experience as transferable ("containerized services with Docker") without claiming the missing
tool itself.

Return:
- `summary`: a rewritten personal statement, plus the reason. Leave `suggested_text` empty if the
  current statement already fits the job well.
- `work_experience`: exactly {exp_count} items, one per entry in the same order. For any entry you
  would not change, leave its `suggested_text` empty. Each description must contain only the
  description prose - never repeat the job title, company name, or dates inside it.
- `skills`: the candidate's existing skills reordered so the most JD-relevant come first, plus the
  reason. Only skills already in the list below - do not add new ones. Leave empty to keep the
  current order.

Job description:
{jd_text}

Resume:
{resume_text}

Candidate's current skills list (only select/reorder from these): {skills_list}
"""


class _CustomizedFields(BaseModel):
    summary: str
    work_experience_descriptions: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)


class _SuggestedEdit(BaseModel):
    suggested_text: str = ""
    reason: str = ""


class _SuggestionSet(BaseModel):
    summary: _SuggestedEdit = Field(default_factory=_SuggestedEdit)
    work_experience: list[_SuggestedEdit] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    skills_reason: str = ""


def _flatten_content(content: dict) -> str:
    basic_info = content.get("basic_info") or {}
    lines = [f"Name: {basic_info.get('full_name') or ''}"]

    summary = (content.get("summary") or {}).get("text") or ""
    if summary:
        lines.append(f"\nSummary:\n{summary}")

    experience = content.get("work_experience") or []
    if experience:
        lines.append("\nWork Experience:")
        for exp in experience:
            lines.append(
                f"- {exp.get('position') or ''} at {exp.get('company') or ''} "
                f"({exp.get('start_date') or ''} - {exp.get('end_date') or ''}): "
                f"{exp.get('description') or ''}"
            )

    education = content.get("education") or []
    if education:
        lines.append("\nEducation:")
        for edu in education:
            lines.append(f"- {edu.get('degree') or ''} {edu.get('major') or ''} at {edu.get('school') or ''}")

    projects = content.get("projects") or []
    if projects:
        lines.append("\nProjects:")
        for proj in projects:
            lines.append(f"- {proj.get('name') or ''}: {proj.get('description') or ''}")

    skills = (content.get("skills") or {}).get("items") or []
    if skills:
        lines.append(f"\nSkills: {', '.join(skills)}")

    return "\n".join(lines)


def _entry_label(entry: dict) -> str:
    position = (entry.get("position") or "").strip()
    company = (entry.get("company") or "").strip()
    if position and company:
        return f"{position} at {company}"
    return position or company or "Work experience"


def _strip_echoed_header(text: str, entry: dict) -> str:
    """Drop a '{position} at {company} ({dates}): ' prefix the model copied out of the prompt.

    `_flatten_content` feeds each experience entry to the model in exactly that shape, and the
    model sometimes echoes the whole line back as the rewritten description - which would render
    the title/company/dates twice, since the template already draws them from their own fields.
    Only strips when the leading segment really is this entry's own header, so a legitimate
    description that happens to contain a colon is left alone.
    """
    head, separator, tail = text.partition(": ")
    if not separator or len(head) > 120:
        return text
    position = (entry.get("position") or "").strip().lower()
    company = (entry.get("company") or "").strip().lower()
    head_lower = head.lower()
    if not position and not company:
        return text
    if position and position not in head_lower:
        return text
    if company and company not in head_lower:
        return text
    return tail.strip() or text


def evaluate_match(content: dict, jd_text: str) -> JDMatchEvaluation:
    resume_text = _flatten_content(content)
    structured_llm = get_openrouter_llm().with_structured_output(JDMatchEvaluation)
    return structured_llm.invoke(EVAL_PROMPT.format(jd_text=jd_text, resume_text=resume_text))


def suggest_edits(content: dict, jd_text: str) -> list[ResumeSuggestion]:
    """Same grounding rules as `customize_content`, but returns reviewable per-field suggestions
    instead of a finished document - the "hint" path, where the user accepts or rejects each edit
    against their *existing* resume rather than getting a new one built wholesale.
    """
    resume_text = _flatten_content(content)
    experience = content.get("work_experience") or []
    original_skills = (content.get("skills") or {}).get("items") or []

    structured_llm = get_openrouter_llm(max_tokens=4096).with_structured_output(_SuggestionSet)
    result = structured_llm.invoke(
        SUGGEST_PROMPT.format(
            jd_text=jd_text,
            resume_text=resume_text,
            exp_count=len(experience),
            skills_list=", ".join(original_skills),
        )
    )

    suggestions: list[ResumeSuggestion] = []

    original_summary = (content.get("summary") or {}).get("text") or ""
    summary_text = result.summary.suggested_text.strip()
    if summary_text and summary_text != original_summary.strip():
        suggestions.append(
            ResumeSuggestion(
                target="summary",
                entry_label="Personal Statement",
                original_text=original_summary,
                suggested_text=summary_text,
                reason=result.summary.reason,
            )
        )

    # Positional zip onto the real entries (same contract as customize_content) - an entry the
    # model left blank, or returned unchanged, simply produces no suggestion to review.
    for entry, edit in zip(experience, result.work_experience):
        suggested = _strip_echoed_header(edit.suggested_text.strip(), entry)
        original = entry.get("description") or ""
        if not suggested or suggested == original.strip():
            continue
        suggestions.append(
            ResumeSuggestion(
                target="work_experience",
                entry_id=entry.get("id"),
                entry_label=_entry_label(entry),
                original_text=original,
                suggested_text=suggested,
                reason=edit.reason,
            )
        )

    # Same "can't invent" filter as customize_content: anything the model added that wasn't
    # already in the candidate's skills list is dropped before it can be offered.
    original_skill_set = set(original_skills)
    filtered_skills = [s for s in result.skills if s in original_skill_set]
    if filtered_skills and filtered_skills != original_skills:
        missing = [s for s in original_skills if s not in filtered_skills]
        suggestions.append(
            ResumeSuggestion(
                target="skills",
                entry_label="Skills",
                original_text=", ".join(original_skills),
                suggested_text=", ".join(filtered_skills + missing),
                reason=result.skills_reason,
            )
        )

    return suggestions


def customize_content(content: dict, jd_text: str) -> dict:
    resume_text = _flatten_content(content)
    experience = content.get("work_experience") or []
    original_skills = (content.get("skills") or {}).get("items") or []

    # Rewrites a summary plus one description per work-experience entry - needs more headroom
    # than the 1024-token default (sized for a single short chat reply).
    structured_llm = get_openrouter_llm(max_tokens=4096).with_structured_output(_CustomizedFields)
    fields = structured_llm.invoke(
        CUSTOMIZE_PROMPT.format(
            jd_text=jd_text,
            resume_text=resume_text,
            exp_count=len(experience),
            skills_list=", ".join(original_skills),
        )
    )

    new_content = copy.deepcopy(content)
    new_content.setdefault("summary", {})["text"] = fields.summary

    new_experience = new_content.get("work_experience") or []
    for i, description in enumerate(fields.work_experience_descriptions[: len(new_experience)]):
        new_experience[i]["description"] = _strip_echoed_header(description, new_experience[i])

    original_skill_set = set(original_skills)
    filtered_skills = [s for s in fields.skills if s in original_skill_set]
    new_content.setdefault("skills", {})["items"] = filtered_skills or original_skills

    return new_content
