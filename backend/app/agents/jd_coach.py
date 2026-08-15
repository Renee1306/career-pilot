"""JD-tailoring coach for the Resume Builder.

Two jobs, deliberately kept apart because they have opposite rules about invention:

1. `review` looks at what the resume already says and proposes keyword-level rewrites. It may
   never introduce a skill, tool or claim that isn't already on the page.
2. `gap_turn` runs a short interview about something the resume does *not* show. It may only
   write a new line after the candidate has said, in their own words, that they have that
   experience - and every word of the result has to trace back to what they actually said.

Both paths emit the same `ResumeHint` shape so the frontend renders and applies them identically.
"""

import re
import uuid

from langchain_core.runnables import RunnableLambda, RunnableParallel
from pydantic import BaseModel, Field

from app.agents._llm import get_openrouter_llm
from app.models.resume_document_model import (
    CoachMessage,
    GapTurnResponse,
    JDGap,
    JDReview,
    ResumeHint,
)

# Shared preamble. This rule is the entire reason the gap conversation exists, so it is stated
# once, concretely, and repeated verbatim in both prompts rather than paraphrased - the failure
# mode being guarded against is the model "helpfully" bridging a gap with a plausible-sounding
# claim the candidate would then be interviewed on.
NO_INVENTION_RULE = """CRITICAL - never invent experience. The job description names technologies
the candidate may not have. You must never introduce a technology, tool, platform, service,
methodology, employer, metric or outcome that is not already evidenced in the material you were
given. If the JD asks for FastAPI and the resume only shows Flask, keep Flask - do not write
FastAPI anywhere. If the JD asks for AWS and the resume never mentions it, do not name AWS or any
of its services. Do not invent numbers, percentages, team sizes or durations. Never bridge a gap
by asserting the missing skill: the candidate will be interviewed on whatever this resume claims,
and a claim they cannot defend costs them the job."""

# Mirrors BULLET_PREFIX in frontend/src/components/resume-builder/templates/blocks.tsx.
_BULLET_PREFIX = re.compile(r"^[•●▪◦‣∙*\-]\s+")


EVAL_PROMPT = """You are the Resume Builder's JD-match evaluator for CareerPilot.

Compare the candidate's resume against the job description and report three things.

1. `match_score` - how well the resume ALREADY matches this job, 0-100. Judge the evidence that is
   actually on the page, not the candidate's potential. Be honest rather than encouraging; an
   inflated score makes the rest of this tool useless.

2. `strengths` - 2-5 things the resume genuinely already demonstrates for this specific job. Each
   one must point at real content on the resume, not at a general quality. Say what the evidence is.

3. `gaps` - the things this job asks for that the resume does not currently show. For each gap give:
   - `title`: the missing capability in 2-6 words, as the JD would name it.
   - `detail`: one sentence on what the JD wants here and why the resume doesn't currently cover it.
   Return at most 5, ordered by how much they matter for this job. Only list a genuine absence - if
   the resume shows the thing under different wording, that is a strength or a rewording
   opportunity, NOT a gap. Return an empty list if the resume covers everything material.

Job description:
{jd_text}

Resume:
{resume_text}
"""


REFRAME_PROMPT = """You are the Resume Builder's JD-alignment reviewer for CareerPilot.

Below is every editable line of the candidate's resume, each with a slot number. Propose rewrites
that make individual lines speak more directly to the job description, using the JD's own
terminology wherever it genuinely describes what the candidate already did.

{no_invention_rule}

What you MAY do: reword, re-emphasise, and lead with the JD-relevant part of a line, using the JD's
vocabulary for work the candidate demonstrably did. Framing real experience as transferable is fine
("containerised services with Docker") as long as you never claim the missing tool itself.

What you MUST NOT do - the two failure modes that make this feature worse than useless:

1. Do not bolt the JD's domain onto work that was not in that domain. Appending a phrase like
   "for assurance and GRC workflows", "for regulated financial clients" or "to support compliance
   reporting" to a line that never mentioned it is inventing the most important part of the claim.
   The candidate built something; you do not know who it was for unless the resume says so. If the
   only way to connect a line to the JD is to assert a context that isn't on the page, leave that
   line alone.

2. Do not return a line that says the same thing as the original. If your rewrite keeps the whole
   sentence and only appends a clause, reorders two phrases, or swaps a word for a synonym, it is
   not a suggestion - it is noise the candidate has to read and dismiss. Every edit you return must
   change what the line actually communicates about this candidate for this job.

Returning NO edits at all is a good answer for a resume that already fits. A short list of edits
that clearly earn their place is always better than a long list of marginal ones.

Rules for your output:
- Return one edit per slot you want to change, keyed by that slot's number. Leave every other slot
  alone - do not return an entry for a line you would not change.
- Rewrite ONE line at a time. Never merge two slots into one, never split a slot into several, and
  never return the whole section as a single blob. Each slot is a separate bullet that the
  candidate accepts or rejects on its own.
- `suggested_text` is the replacement for that line only. It must not repeat the job title, company
  name or dates - those are rendered separately by the template - and must not start with a bullet
  character; the template draws its own.
- `reason` is one short, specific sentence naming what this rewrite improves FOR THIS JOB. "Uses
  the JD's 'incident response' wording for the same on-call work" is useful. "Makes it stronger"
  is not - the candidate is deciding whether to trust you. If your reason amounts to "keeps it the
  same", you should not have returned the edit at all.
- Skills slots hold one skill line each. You may reword one to match the JD's naming for a skill
  the candidate already lists. You may not add a skill.

Job description:
{jd_text}

Editable resume lines:
{slot_text}
"""


GAP_TURN_PROMPT = """You are the Resume Builder's gap interviewer for CareerPilot.

The candidate's resume does not currently evidence one thing this job asks for. Your job is to find
out - by asking the candidate directly - whether they ACTUALLY have that experience, and only if
they do, to collect enough concrete detail to write honest resume lines about it.

The gap under discussion:
  {gap_title}
  {gap_detail}

{no_invention_rule}

In this conversation the ONLY source of truth about the candidate is what they have typed in the
transcript below. The resume tells you where a confirmed answer should attach; it does not license
any new claim. If the candidate has not said something, it does not go on the resume.

How to run the conversation:
- Ask exactly ONE question per turn. Never bundle several questions into one message.
- Ask AT MOST 5 questions in total across the whole conversation. Count the assistant turns already
  in the transcript. If 5 have been asked, you must stop asking and decide.
- Your first question establishes whether they have the experience at all. Ask it plainly and
  without leading them - "Have you worked with X?", not "Tell me about your X experience", which
  presumes the answer.
- After that, only ask what you still need in order to write a truthful line: what they actually
  did, which role or project on their resume it belongs to, and the scale or outcome. Skip anything
  they have already told you.
- Do NOT ask about things this resume already demonstrates well. Those are already covered and
  asking again wastes the candidate's patience. Already covered: {strengths}
- Keep questions short and conversational. No preamble, no restating what they just said.

How to decide `status`:
- "declined" - the candidate says they don't have this experience, have only studied or read about
  it, or have never used it in real work. Also use this if their answers stay too vague to support
  any honest claim, or if they ask to move on without having given anything concrete. Set `hints`
  to an empty list. In `message`, tell them plainly that you won't add it, in one sentence, and say
  it is better left off than claimed - this is a good outcome, not a failure, so do not push back
  or ask again.
- "asking" - you still need something. Put the single next question in `message`.
- "ready" - the candidate has confirmed the experience AND given you enough specifics, or they have
  told you to go ahead and what they have already given IS enough to write something truthful. Put
  the proposed lines in `hints_json` and use `message` for one short sentence saying what you've
  drafted and that it's waiting on the preview for them to accept.

When `status` is "ready", fill `additions` with the lines to add:
- `entry_slot` says where each line attaches - use one of the numbered entries below. Choose the
  role or project the candidate actually named. If they described it as its own thing and no listed
  entry fits, use -1 to attach it to the personal statement instead.
- `new_text` is ONE resume bullet, in the resume's voice (past tense, starts with a verb, no "I").
  Every fact in it must be traceable to a specific thing the candidate typed. If they said "I
  automated our deploys with Jenkins at my internship", you may write about Jenkins and deploys;
  you may not add "reducing deploy time by 40%" because they never said that.
- Write one bullet per distinct thing they described - do not pack several claims into one line.
  Two or three bullets is normally plenty; never more than four.
- `reason` explains in one sentence what this covers for this job and that it comes from their
  answers.
- `new_skills` may list skills the candidate explicitly confirmed using. Leave it empty unless they
  named the skill themselves.

Entries this can attach to:
{entry_text}

Job description:
{jd_text}

Conversation so far (empty means this is your opening question):
{transcript}
"""


class _Gap(BaseModel):
    title: str = ""
    detail: str = ""


class _Evaluation(BaseModel):
    match_score: int = 0
    strengths: list[str] = Field(default_factory=list)
    gaps: list[_Gap] = Field(default_factory=list)


class _SlotEdit(BaseModel):
    slot: int
    suggested_text: str = ""
    reason: str = ""


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
        get_openrouter_llm(max_tokens=2048)
        .with_structured_output(_Evaluation)
        .invoke(EVAL_PROMPT.format(jd_text=jd_text, resume_text=flatten_resume_content(content)))
    )


def _reframe(slots: list[_Slot], jd_text: str) -> _ReframeResult:
    if not slots:
        return _ReframeResult()
    return (
        get_openrouter_llm(max_tokens=4096)
        .with_structured_output(_ReframeResult)
        .invoke(
            REFRAME_PROMPT.format(
                jd_text=jd_text,
                slot_text=_format_slots(slots),
                no_invention_rule=NO_INVENTION_RULE,
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
    results = RunnableParallel(
        evaluation=RunnableLambda(lambda _: _evaluate(content, jd_text)),
        reframes=RunnableLambda(lambda _: _reframe(slots, jd_text)),
    ).invoke({})

    evaluation: _Evaluation = results["evaluation"]
    reframes: _ReframeResult = results["reframes"]

    hints: list[ResumeHint] = []
    for edit in reframes.edits:
        if not 0 <= edit.slot < len(slots):
            continue
        slot = slots[edit.slot]
        suggested = _BULLET_PREFIX.sub("", edit.suggested_text.strip())
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
            JDGap(id=str(uuid.uuid4()), title=gap.title.strip(), detail=gap.detail.strip())
            for gap in evaluation.gaps
            if gap.title.strip()
        ],
        hints=hints,
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
        get_openrouter_llm(max_tokens=3072)
        .with_structured_output(_GapTurnResult)
        .invoke(
            GAP_TURN_PROMPT.format(
                gap_title=gap.title,
                gap_detail=gap.detail,
                strengths="; ".join(strengths) or "(none identified)",
                entry_text=_format_entry_refs(refs),
                jd_text=jd_text,
                transcript=_format_transcript(history),
                no_invention_rule=NO_INVENTION_RULE,
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
