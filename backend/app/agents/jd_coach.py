"""JD-tailoring coach for the Resume Builder.

Two jobs, deliberately kept apart because they have opposite rules about invention:

1. `review` looks at what the resume already says and proposes keyword-level rewrites. It may
   never introduce a skill, tool or claim that isn't already on the page.
2. `gap_turn` runs a short interview about something the resume does *not* show. It may only
   write a new line after the candidate has said, in their own words, that they have that
   experience - and every word of the result has to trace back to what they actually said.

"""

import re
import uuid

from typing import Literal
from langchain_core.runnables import RunnableLambda, RunnableParallel
from pydantic import BaseModel, Field

from app.agents._llm import get_dashscope_llm_2
from app.models.resume_document_model import (
    CoachMessage,
    GapTurnResponse,
    JDGap,
    JDReview,
    QuantifyCandidate,
    ResumeHint,
)

_BULLET_PREFIX = re.compile(r"^[•●▪◦‣∙*\-]\s+")
_HAS_DIGIT = re.compile(r"\d")

EVAL_PROMPT = """
<role>
You are CareerPilot's JD-match evaluator.
</role>

<goal>
Compare the candidate's resume against the job description and determine
how well the resume already matches the role.
</goal>

<input>
<job_description>
{jd_text}
</job_description>

<resume>
{resume_text}
</resume>
</input>

<evaluation>

<match_score>
Score using this method:

1. From the job description, separate the required (must-have) qualifications from the
   preferred (nice-to-have) ones.
2. For each list, judge what fraction the resume already demonstrates with real evidence:
   required_coverage = (required items the resume evidences) / (total required items)
   preferred_coverage = (preferred items the resume evidences) / (total preferred items)
3. Combine them: match_score = round(required_coverage * 70 + preferred_coverage * 30)
4. Only count an item as covered when the resume shows it - not when the candidate could
   plausibly pick it up.

Use these bands to sanity-check the number you land on, not as a label to return:
- 90-100: the resume already demonstrates nearly everything the role asks for
- 75-89: strong match with a few gaps
- 60-74: solid overlap but real gaps remain
- 50-59: a stretch - meaningful gaps in required qualifications
- Below 50: the resume does not yet demonstrate most of what the role requires

Give a score from 0-100 based only on evidence already present in the resume.
Do not score the candidate's potential or what they could learn.
Be honest rather than encouraging.
</match_score>

<strengths>
Return 2-5 strengths that the resume genuinely demonstrates for this job.

Each strength must:
- Point to real evidence in the resume.
- Explain why that evidence matters for this job.
- Avoid generic statements about resume quality.
</strengths>

<gaps>
Identify capabilities requested by the JD that the resume does not currently show.

For each gap return:
- title: 2-6 words using the JD's terminology
- detail: one sentence explaining what the JD wants and why the resume does not cover it
- category: one of
  - "hard_skill" - a tool, language, platform, methodology, or certification
  - "soft_skill" - an interpersonal or behavioural ability, e.g. leadership, communication
  - "industry_term" - sector or domain knowledge, e.g. a regulation, business model, or
    domain vocabulary that isn't itself a tool or a soft skill

Rules:
- Return at most 5 gaps.
- Order gaps by importance to the role.
- Do not report something as a gap if the resume demonstrates it using different wording.
- If the resume covers everything material, return an empty list.
</gaps>

</evaluation>

<rules>
<rule>Judge only evidence present in the resume.</rule>
<rule>Do not infer missing skills.</rule>
<rule>Do not confuse potential with demonstrated experience.</rule>
<rule>Write the entire response in English, regardless of what language the resume or job
description is written in.</rule>
</rules>

<output>
Return the result using the provided structured output schema.
</output>
"""

REFRAME_PROMPT = """
<role>
You are CareerPilot's ATS Resume Reframing Agent.
</role>

<goal>
Improve the ATS relevance of existing resume lines using ONLY information
already present in the resume.
</goal>

<input>
<job_description>
{jd_text}
</job_description>

<editable_resume_lines>
{slot_text}
</editable_resume_lines>
</input>

<constraints>

<source_of_truth>
The resume is the source of truth.

Never add, infer, upgrade, or assume:
- skills
- technologies
- tools
- frameworks
- platforms
- methodologies
- domains
- certifications
- metrics
- achievements
- responsibilities
- outcomes
- experience

unless explicitly supported by the resume.
</source_of_truth>

<skill_inference>
Do not infer related technologies.

Examples:
- JavaScript does not imply TypeScript.
- Python does not imply FastAPI, Django, Flask, or PyTorch.
- Java does not imply Spring or Spring Boot.
- AWS does not imply Azure, GCP, Lambda, or S3.
- SQL does not imply PostgreSQL, MySQL, or Oracle.
- React does not imply Next.js.
- Docker does not imply Kubernetes.
- LangChain does not imply LangGraph.
- REST APIs do not imply FastAPI.
</skill_inference>

<missing_jd_skills>
If a JD skill is absent from the resume:
- Do not add it.
- Do not rewrite an existing skill to imply it.
- Treat it as a gap.
- It must be investigated separately through the gap interview.
</missing_jd_skills>

<meaningful_change>
A rewrite is valid only when it creates a meaningful improvement in:
- ATS relevance
- clarity
- specificity
- evidence

Do not return cosmetic changes, synonym-only changes,
or keyword insertion without a factual improvement.
</meaningful_change>

<ats_optimization>
Prefer:
- standard industry terminology
- exact JD terminology when already supported
- explicit technology names already present
- clear action + technology + task + outcome structure
- concise bullets
- specific nouns

Avoid:
- keyword stuffing
- repeated keywords
- generic buzzwords
- inferred technologies
- unnecessary rewriting
</ats_optimization>

<language>
Write every rewrite in English, regardless of what language the job description or the
original resume line is written in.
</language>

</constraints>

<decision_process>
For every possible edit, verify:

1. Does the original line already contain the underlying experience?
2. Is the proposed wording factually equivalent?
3. Does it materially improve ATS relevance, clarity, specificity, or evidence?
4. Does it introduce any unsupported fact?
5. Would a recruiter recognize this as a meaningful improvement?

If any answer is NO, return no edit.
</decision_process>

<restructuring>

<split>
Use split only when one bullet contains two genuinely unrelated accomplishments.

Return both bullets separated by one newline.
</split>

<merge>
Use merge only when two bullets in the same entry describe the same
underlying accomplishment or one is clearly a fragment of the other.

Do not merge bullets from different entries.
</merge>

<normal_rewrite>
For normal rewrites, use:
- ats_keyword_alignment
- clarity
- specificity
- impact
- none
</normal_rewrite>

</restructuring>

<examples>

<example>
<original>
Created APIs using FastAPI and Python.
</original>

<job_description>
Build REST APIs using Python and FastAPI.
</job_description>

<result>
Built REST APIs using Python and FastAPI.
</result>

<reason>
Makes the already demonstrated REST API experience explicit.
</reason>
</example>

<example>
<original>
Python, JavaScript
</original>

<job_description>
Python, TypeScript, JavaScript
</job_description>

<result>
NO EDIT
</result>

<reason>
TypeScript is not present in the resume.
</reason>
</example>

</examples>

<output>
Return one edit per editable slot.

Do not return:
- unchanged lines
- cosmetic edits
- synonym-only edits
- unsupported JD keywords
- edits that only insert keywords

Return the result using the provided structured output schema.
</output>
"""


GAP_TURN_PROMPT = """
<role>
You are CareerPilot's resume gap interviewer.
</role>

<goal>
Determine whether the candidate genuinely has experience with a capability
requested by the job description but not currently demonstrated on the resume.

If they do, collect enough information to write truthful resume lines.

If they do not, leave the capability off the resume.
</goal>

<input>

<gap>
<title>{gap_title}</title>
<detail>{gap_detail}</detail>
</gap>

<resume_strengths>
{strengths}
</resume_strengths>

<resume_entries>
{entry_text}
</resume_entries>

<job_description>
{jd_text}
</job_description>

<conversation>
{transcript}
</conversation>

</input>

<constraints>

<source_of_truth>
In this conversation, the candidate's answers are the only source of truth
for newly confirmed experience.

The resume shows where confirmed information can attach.
It does NOT authorize new claims.
</source_of_truth>

<question_limit>
Ask exactly ONE question per turn.

Ask at most 5 questions across the entire conversation.
Count previous assistant questions in the transcript.
</question_limit>

<question_strategy>

<first_question>
The first question must establish whether the candidate has actual
hands-on experience.

Ask:
"Have you worked with X?"

Do not ask a leading question such as:
"Tell me about your X experience."
</first_question>

<follow_up>
After confirmation, ask only for information still required to write
a truthful resume line:
- what they did
- where they did it
- scale or outcome

Do not ask for information already provided.
</follow_up>

<entry_selection>
Before asking which role or project the experience belongs to,
search the entire transcript.

If exactly one resume entry plausibly matches what they said,
use that entry without asking again.

Only ask when the attachment is genuinely ambiguous.
</entry_selection>

</question_strategy>

<avoid_redundancy>
Do not ask about skills the resume already demonstrates well.

Already covered:
{strengths}
</avoid_redundancy>

<language>
Write every question and resume addition in English, regardless of what language the job
description, resume, or candidate's answers are written in.
</language>

</constraints>

<status_rules>

<asking>
Use when more information is required.

Return exactly one next question in message.
</asking>

<ready>
Use when:
- the candidate confirmed the experience
- enough concrete information has been provided

Generate truthful resume additions.
</ready>

<declined>
Use when:
- the candidate does not have the experience
- they only studied it
- they only read about it
- their answers remain too vague
- they ask to move on

Return no additions or skills.
</declined>

</status_rules>

<resume_additions>

<entry_slot>
Attach each addition to the role or project the candidate actually named.
Use -1 for Personal Statement only when no listed entry fits.
</entry_slot>

<new_text>
Write one resume bullet.

Rules:
- past tense
- starts with a verb
- no "I"
- every fact must trace directly to the candidate's answers
</new_text>

<new_skills>
Only include skills the candidate explicitly confirmed using.

Never infer related skills.
</new_skills>

</resume_additions>

<output>
Return the result using the provided structured output schema.
</output>
"""


QUANTIFY_TURN_PROMPT = """
<role>
You are CareerPilot's resume quantification interviewer.
</role>

<goal>
This resume bullet reads as an accomplishment but carries no number, so a reader can't tell how
big the work actually was. Find out from the candidate whether a real number exists, and if it
does, fold it into the bullet.

If the candidate can't give you a real number, leave the bullet exactly as it is.
</goal>

<input>

<bullet>
{bullet_text}
</bullet>

<conversation>
{transcript}
</conversation>

</input>

<constraints>

<source_of_truth>
In this conversation, the candidate's own answers are the only source of truth for any number
that ends up in the resume.

NEVER invent, estimate, round, or infer a number the candidate did not state. If they give a
range, keep the range. If they aren't sure, you may ask once whether they can work it out from
something they do know (team size, frequency, before/after) - but if they still can't, that is a
decline, not a guess.
</source_of_truth>

<question_limit>
Ask exactly ONE question per turn.

Ask at most 4 questions across the entire conversation.
Count previous assistant questions in the transcript.
</question_limit>

<question_strategy>
Draw questions from these categories, in whichever order fits what the bullet is missing:

<scale>
How many people, customers, projects, or how large a budget/system was involved?
</scale>

<impact>
What changed because of this work? What specifically improved, and for whom?
</impact>

<comparison>
What was it before versus after? What was the baseline?
</comparison>

Ask only about numbers the bullet is actually missing - do not ask about something the
candidate already answered.
</question_strategy>

<language>
Write every question and rewrite in English, regardless of what language the bullet or the
candidate's answers are written in.
</language>

</constraints>

<status_rules>

<asking>
Use when a real number might still be gettable and you haven't hit the question limit.
Return exactly one next question in message.
</asking>

<ready>
Use when the candidate has given at least one real, usable number.
Rewrite the bullet to include it.
</ready>

<declined>
Use when:
- the candidate says they don't know or don't have a number
- their answers stay too vague to write a defensible number
- they ask to skip this

Return no rewrite.
</declined>

</status_rules>

<rewrite>
Write one resume bullet.

Rules:
- past tense, starts with a verb, no "I"
- keep everything the original bullet already said
- add only the number(s) the candidate actually gave you
- do not add any other new claim
</rewrite>

<output>
Return the result using the provided structured output schema.
</output>
"""


class _QuantifyTurnResult(BaseModel):
    status: str = "asking"
    message: str = ""
    rewrite: str = ""


def quantify_turn(candidate: QuantifyCandidate, history: list[CoachMessage]) -> GapTurnResponse:
    """One turn of the quantify interview for a single vague bullet.

    Mirrors `gap_turn`'s asking/ready/declined shape and its refusal to invent - the only
    difference is what's being confirmed: a number instead of a skill, so there's no resume
    content or entry list to pass in, just the one bullet in question.
    """
    result = (
        get_dashscope_llm_2(max_tokens=1024)
        .with_structured_output(_QuantifyTurnResult)
        .invoke(
            QUANTIFY_TURN_PROMPT.format(
                bullet_text=candidate.text,
                transcript=_format_transcript(history),
            )
        )
    )

    status = result.status if result.status in ("asking", "ready", "declined") else "asking"

    if status == "declined":
        return GapTurnResponse(
            status="declined",
            message=result.message.strip() or "No problem - I'll leave that line as it is.",
        )

    if status == "asking":
        return GapTurnResponse(
            status="asking",
            message=result.message.strip() or "Do you have a number for that?",
        )

    rewrite = result.rewrite.strip()
    if not rewrite or not _is_meaningful_change(candidate.text, rewrite):
        return GapTurnResponse(
            status="declined",
            message=result.message.strip()
            or "That doesn't give me a real number to add, so I'll leave the line as it is.",
        )

    return GapTurnResponse(
        status="ready",
        # Deliberately not `result.message` here (unlike the asking/declined branches above): the
        # hint is only an offer, nothing is written to the resume until the candidate clicks the
        # highlighted line on the preview and hits Accept - so this instruction has to reach the
        # user every time, not just when the model happens to phrase its own reply that way.
        message="Added a number to that bullet - click the highlighted line on your resume preview to accept it.",
        hints=[
            ResumeHint(
                id=str(uuid.uuid4()),
                target=candidate.target,
                entry_id=candidate.entry_id,
                entry_label=candidate.entry_label,
                bullet_index=candidate.bullet_index,
                mode="replace",
                original_text=candidate.text,
                suggested_text=rewrite,
                reason="You gave a real number for this, so it's now in the bullet.",
                source="quantify",
            )
        ],
    )


class _Gap(BaseModel):
    title: str = ""
    detail: str = ""
    category: Literal["hard_skill", "soft_skill", "industry_term"] = "hard_skill"


class _Evaluation(BaseModel):
    match_score: int = 0
    strengths: list[str] = Field(default_factory=list)
    gaps: list[_Gap] = Field(default_factory=list)


class _SlotEdit(BaseModel):
    slot: int
    suggested_text: str = ""
    reason: str = ""
    change_type: Literal[
        "ats_keyword_alignment",
        "clarity",
        "specificity",
        "impact",
        "split",
        "merge",
        "none"
    ] = "none"
    merge_with_slot: int | None = None


class _ReframeResult(BaseModel):
    edits: list[_SlotEdit] = Field(default_factory=list)


class _GapAddition(BaseModel):
    entry_slot: int = -1
    new_text: str = ""
    reason: str = ""


class _GapTurnResult(BaseModel):
    status: str = "asking"
    message: str = ""
    additions: list[_GapAddition] = Field(default_factory=list)
    new_skills: list[str] = Field(default_factory=list)


class _Slot(BaseModel):
    """One editable line of the resume, as offered to the model by number."""

    target: str
    entry_id: str | None = None
    entry_label: str = ""
    bullet_index: int | None = None
    text: str = ""


class _EntryRef(BaseModel):
    """One place a brand-new gap-derived bullet can attach."""

    target: str
    entry_id: str
    entry_label: str


def _split_bullets(description: str) -> list[str]:
    """Split a description into the same lines the template renders as bullets.

    The leading bullet glyph an imported resume may carry is stripped here, because the template
    draws its own marker and never displays the original. Without this the enumerated line would
    read "• Did X" while the model (and the rendered page) both say "Did X" - which silently broke
    the "did this rewrite actually change anything?" check and let no-op suggestions through.

    Mirrors `splitBullets` in frontend/src/lib/api.ts and `DescriptionText` in
    frontend/src/components/resume-builder/templates/blocks.tsx - all three must agree on what
    one bullet is, or an accepted hint replaces the wrong line.
    """
    return [_BULLET_PREFIX.sub("", line.strip()) for line in description.splitlines() if line.strip()]


def _is_meaningful_change(original: str, suggested: str) -> bool:
    """Whether a proposed rewrite is worth showing at all.

    Compared on a normalised form (case, whitespace and trailing punctuation folded) so a
    suggestion that differs only cosmetically never reaches the user as something to accept.
    """
    normalise = lambda text: re.sub(r"[\s.,;:]+", " ", text).strip().lower()  # noqa: E731
    return bool(suggested) and normalise(original) != normalise(suggested)


def _skill_groups(content: dict) -> list[dict]:
    return (content.get("skills") or {}).get("groups") or []


def _format_skill_line(group: dict) -> str:
    """The one-line form of a skill group - mirrors `formatSkillLine` in frontend/src/lib/api.ts,
    which is what actually renders, so an enumerated slot matches the page character for character.
    """
    items = ", ".join(item.strip() for item in group.get("items") or [] if item.strip())
    category = (group.get("category") or "").strip()
    if not items:
        return ""
    return f"{category}: {items}" if category else items


def _entry_label(entry: dict, primary: str, secondary: str, fallback: str) -> str:
    first = (entry.get(primary) or "").strip()
    second = (entry.get(secondary) or "").strip()
    if first and second:
        return f"{first} at {second}"
    return first or second or fallback


def _build_slots(content: dict) -> list[_Slot]:
    slots: list[_Slot] = []

    summary = (content.get("summary") or {}).get("text") or ""
    if summary.strip():
        slots.append(_Slot(target="summary", entry_label="Personal Statement", text=summary.strip()))

    for entry in content.get("work_experience") or []:
        label = _entry_label(entry, "position", "company", "Work experience")
        for index, line in enumerate(_split_bullets(entry.get("description") or "")):
            slots.append(
                _Slot(
                    target="work_experience",
                    entry_id=entry.get("id"),
                    entry_label=label,
                    bullet_index=index,
                    text=line,
                )
            )

    for entry in content.get("projects") or []:
        label = (entry.get("name") or "").strip() or "Project"
        for index, line in enumerate(_split_bullets(entry.get("description") or "")):
            slots.append(
                _Slot(
                    target="projects",
                    entry_id=entry.get("id"),
                    entry_label=label,
                    bullet_index=index,
                    text=line,
                )
            )

    # One slot per skill *group*, because one group is what renders as one bullet - and the unit
    # the candidate accepts or rejects has to be the thing they can see on the page.
    for index, group in enumerate(_skill_groups(content)):
        line = _format_skill_line(group)
        if line:
            slots.append(_Slot(target="skills", entry_label="Skills", bullet_index=index, text=line))

    return slots


def _build_entry_refs(content: dict) -> list[_EntryRef]:
    refs: list[_EntryRef] = []
    for entry in content.get("work_experience") or []:
        refs.append(
            _EntryRef(
                target="work_experience",
                entry_id=entry.get("id") or "",
                entry_label=_entry_label(entry, "position", "company", "Work experience"),
            )
        )
    for entry in content.get("projects") or []:
        refs.append(
            _EntryRef(
                target="projects",
                entry_id=entry.get("id") or "",
                entry_label=(entry.get("name") or "").strip() or "Project",
            )
        )
    return refs


def _quantify_candidates(slots: list[_Slot]) -> list[QuantifyCandidate]:
    """Bullets that read as accomplishments but carry no digit anywhere in the line.

    A plain digit check rather than an LLM call - cheap, deterministic, and the cost of a false
    positive (a bullet that already has a number in an unusual form) is just an offer the
    candidate can ignore, not a wrong claim written to the resume.
    """
    candidates = [
        QuantifyCandidate(
            id=str(uuid.uuid4()),
            target=slot.target,
            entry_id=slot.entry_id,
            entry_label=slot.entry_label,
            bullet_index=slot.bullet_index,
            text=slot.text,
        )
        for slot in slots
        if slot.target in ("work_experience", "projects") and not _HAS_DIGIT.search(slot.text)
    ]
    return candidates[:3]


def _format_slots(slots: list[_Slot]) -> str:
    lines = []
    for i, slot in enumerate(slots):
        where = slot.entry_label
        if slot.target in ("work_experience", "projects"):
            where = f"{where} · bullet {(slot.bullet_index or 0) + 1}"
        lines.append(f"[{i}] ({slot.target}) {where}: {slot.text}")
    return "\n".join(lines) or "(the resume has no editable lines yet)"


def _format_entry_refs(refs: list[_EntryRef]) -> str:
    lines = [f"[{i}] ({ref.target}) {ref.entry_label}" for i, ref in enumerate(refs)]
    lines.append("[-1] Personal Statement (use when no entry above fits)")
    return "\n".join(lines)


def _format_transcript(history: list[CoachMessage]) -> str:
    if not history:
        return "(no messages yet)"
    speaker = {"user": "Candidate", "assistant": "You"}
    return "\n".join(f"{speaker[m.role]}: {m.content}" for m in history)


def flatten_resume_content(content: dict) -> str:
    """Render a Resume Builder document as plain text for a prompt.

    Public because interview prep grounds its questions in the same resume the JD coach reads -
    both need the builder's structured document flattened the same way.
    """
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

    skill_lines = [line for line in (_format_skill_line(g) for g in _skill_groups(content)) if line]
    if skill_lines:
        lines.append("\nSkills:")
        lines.extend(f"- {line}" for line in skill_lines)

    certificates = content.get("certificates") or []
    if certificates:
        lines.append(f"\nCertificates: {', '.join(c.get('name') or '' for c in certificates)}")

    return "\n".join(lines)


def _evaluate(content: dict, jd_text: str) -> _Evaluation:
    return (
        get_dashscope_llm_2(max_tokens=2048)
        .with_structured_output(_Evaluation)
        .invoke(EVAL_PROMPT.format(jd_text=jd_text, resume_text=flatten_resume_content(content)))
    )


def _reframe(slots: list[_Slot], jd_text: str) -> _ReframeResult:
    if not slots:
        return _ReframeResult()
    return (
        get_dashscope_llm_2(max_tokens=4096)
        .with_structured_output(_ReframeResult)
        .invoke(
            REFRAME_PROMPT.format(
                jd_text=jd_text,
                slot_text=_format_slots(slots),
            )
        )
    )


def review(content: dict, jd_text: str) -> JDReview:
    """Score the resume, name its strengths and gaps, and propose per-bullet JD rewrites.

    The evaluation and the rewrite pass are genuinely different tasks - one judges the resume as a
    whole, the other edits individual lines - so they run as two calls rather than one overloaded
    prompt, concurrently via RunnableParallel so the user waits for the slower of the two rather
    than the sum (same pattern as app/agents/orchestrator.py).
    """
    slots = _build_slots(content)
    # Reframe suggestions only make sense for Work Experience and Projects bullets - the
    # Personal Statement and Skills slots are excluded
    reframe_slots = [slot for slot in slots if slot.target in ("work_experience", "projects")]
    results = RunnableParallel(
        evaluation=RunnableLambda(lambda _: _evaluate(content, jd_text)),
        reframes=RunnableLambda(lambda _: _reframe(reframe_slots, jd_text)),
    ).invoke({})

    evaluation: _Evaluation = results["evaluation"]
    reframes: _ReframeResult = results["reframes"]

    hints: list[ResumeHint] = []
    # A merge spends two slots on one hint - once a slot has gone into a merge, any other edit
    # naming it (including a redundant standalone edit the model returns for it anyway) is
    # dropped rather than applied twice.
    consumed_slots: set[int] = set()
    for edit in reframes.edits:
        if edit.slot in consumed_slots or not 0 <= edit.slot < len(reframe_slots):
            continue
        slot = reframe_slots[edit.slot]
        suggested = _BULLET_PREFIX.sub("", edit.suggested_text.strip())
        if not suggested or suggested.strip().lower() == "no edit":
            continue

        other_slot = edit.merge_with_slot
        if (
            edit.change_type == "merge"
            and other_slot is not None
            and other_slot != edit.slot
            and other_slot not in consumed_slots
            and 0 <= other_slot < len(reframe_slots)
            and slot.target in ("work_experience", "projects")
            and reframe_slots[other_slot].target == slot.target
            and reframe_slots[other_slot].entry_id == slot.entry_id
        ):
            other = reframe_slots[other_slot]
            consumed_slots.add(edit.slot)
            consumed_slots.add(other_slot)
            hints.append(
                ResumeHint(
                    id=str(uuid.uuid4()),
                    target=slot.target,
                    entry_id=slot.entry_id,
                    entry_label=slot.entry_label,
                    bullet_index=slot.bullet_index,
                    merge_bullet_index=other.bullet_index,
                    mode="replace",
                    original_text=f"{slot.text}\n{other.text}",
                    suggested_text=suggested,
                    reason=edit.reason.strip(),
                    source="reframe",
                )
            )
            continue

        # A rewrite that doesn't actually change what the line says is noise the user has to read
        # and dismiss by hand, so it never becomes a hint no matter what the model claimed.
        if not _is_meaningful_change(slot.text, suggested):
            continue
        hints.append(
            ResumeHint(
                id=str(uuid.uuid4()),
                target=slot.target,
                entry_id=slot.entry_id,
                entry_label=slot.entry_label,
                bullet_index=slot.bullet_index,
                mode="replace",
                original_text=slot.text,
                suggested_text=suggested,
                reason=edit.reason.strip(),
                source="reframe",
            )
        )

    return JDReview(
        match_score=max(0, min(100, evaluation.match_score)),
        strengths=[s.strip() for s in evaluation.strengths if s.strip()],
        gaps=[
            JDGap(
                id=str(uuid.uuid4()),
                title=gap.title.strip(),
                detail=gap.detail.strip(),
                category=gap.category,
            )
            for gap in evaluation.gaps
            if gap.title.strip()
        ],
        hints=hints,
        quantify_candidates=_quantify_candidates(slots),
    )


def gap_turn(
    content: dict,
    jd_text: str,
    gap: JDGap,
    strengths: list[str],
    history: list[CoachMessage],
) -> GapTurnResponse:
    """One turn of the interview about a single gap.

    Deciding whether to keep asking and drafting the resulting lines happen in the same call: the
    model has just read the candidate's latest answer, and splitting "are we done?" from "write it
    up" into two calls would only give it a second chance to drift from what was actually said.
    """
    refs = _build_entry_refs(content)
    result = (
        get_dashscope_llm_2(max_tokens=3072)
        .with_structured_output(_GapTurnResult)
        .invoke(
            GAP_TURN_PROMPT.format(
                gap_title=gap.title,
                gap_detail=gap.detail,
                strengths="; ".join(strengths) or "(none identified)",
                entry_text=_format_entry_refs(refs),
                jd_text=jd_text,
                transcript=_format_transcript(history),
            )
        )
    )

    status = result.status if result.status in ("asking", "ready", "declined") else "asking"

    # Belt and braces: "declined" must never carry edits, and a "ready" that produced nothing
    # usable is really still a decline - either way nothing gets written to the resume.
    if status == "declined":
        return GapTurnResponse(
            status="declined",
            message=result.message.strip() or "No problem - it's better to leave that off than to claim it.",
        )

    if status == "asking":
        message = result.message.strip()
        return GapTurnResponse(
            status="asking",
            message=message or f"Do you have any hands-on experience with {gap.title}?",
        )

    hints: list[ResumeHint] = []
    for addition in result.additions:
        text = addition.new_text.strip()
        if not text:
            continue
        if 0 <= addition.entry_slot < len(refs):
            ref = refs[addition.entry_slot]
            target, entry_id, entry_label = ref.target, ref.entry_id, ref.entry_label
        else:
            target, entry_id, entry_label = "summary", None, "Personal Statement"
        hints.append(
            ResumeHint(
                id=str(uuid.uuid4()),
                target=target,
                entry_id=entry_id,
                entry_label=entry_label,
                mode="append",
                original_text="",
                suggested_text=text,
                reason=addition.reason.strip(),
                source="gap",
            )
        )

    # Only skills the candidate named are worth offering, and only ones not already listed
    # anywhere in the resume - flattened across every category, since "already have it" has
    # nothing to do with which group it happens to sit in.
    existing = {
        item.strip().lower()
        for group in _skill_groups(content)
        for item in group.get("items") or []
        if item.strip()
    }
    for skill in result.new_skills:
        name = skill.strip()
        if name and name.lower() not in existing:
            hints.append(
                ResumeHint(
                    id=str(uuid.uuid4()),
                    target="skills",
                    entry_label="Skills",
                    mode="append",
                    original_text="",
                    suggested_text=name,
                    reason=f"You confirmed hands-on {name} experience, which this job asks for.",
                    source="gap",
                )
            )

    if not hints:
        return GapTurnResponse(
            status="declined",
            message=result.message.strip()
            or "There isn't enough there to write something you could defend in an interview, so I've left it off.",
        )

    return GapTurnResponse(
        status="ready",
        message=result.message.strip()
        or "I've drafted that from your answers - check it on the preview and accept what's right.",
        hints=hints,
    )
