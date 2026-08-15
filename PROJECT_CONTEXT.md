# CareerPilot — Project Context

This file exists so a new agent (or a human) can pick up this project cold. It describes what
has been built, how it's structured, and what decisions were made and why. Update it whenever
you complete a phase or change something a future reader would need to know.

## What this is

An AI career copilot with two halves:

1. **Understand a job** — paste a job description, get a plain-language job explanation and a
   "typical day" preview (translatable). Resume-vs-JD matching used to live here too (a third tab,
   click-to-apply edits, PDF export) — it was **removed** from this page and replaced by the
   JD Coach inside Resume Builder instead (see "Resume Builder" below). The old upload-flow
   resume-parsing agent (`resume_parser.py`) and per-field "AI enhance" agent (`resume_enhancer.py`)
   have since been deleted outright, not just left unused — see "Resume Builder" for what replaced
   AI-enhance (a "draft from my resume" summary generator) and the "Reconciling a self-edit" note
   for how the parser's removal was finished consistently.
2. **Build a resume** — a from-scratch structured resume editor (library + editor with a
   collapsible right rail, five templates/many fonts, per-role font colors, photo upload,
   print-to-PDF export via true multi-page pagination, and a **JD Coach** that reviews the resume
   against a pasted JD and only ever adds a claim after the candidate confirms it themselves) —
   see "Resume Builder" below.
3. **Track applications & prep for interviews** — a Kanban board of applications, a timeline of
   notes per application, AI-generated interview prep (question + what a strong answer should
   cover + which resume experience to draw on — never a script to read out) per round type
   (behavioural / hiring manager), and Gmail sync to auto-detect application updates from your
   inbox (see "Gmail sync" below).

## Tech stack

- **Backend**: Python, FastAPI, LangChain (`langchain` 1.x + `langchain-google-genai` 4.x),
  Gemini (`gemini-flash-lite-latest`), Supabase (Postgres + Auth + Storage), `reportlab` for PDF
  export.
- **Frontend**: React 19 + TypeScript + Vite 6, react-router-dom, `@supabase/supabase-js`. No UI
  framework — a small hand-rolled design system (see `frontend/src/styles/components.css`).
- **Auth**: Supabase Auth (email/password). The backend never uses the service-role key for
  normal requests — every request is scoped to the caller's JWT so Postgres RLS enforces
  per-user isolation (see "Auth model" below).

## Repo structure

**Naming convention** (as of the file-rename pass this session): every model file is `*_model.py`,
every router file is `*_router.py`, every service file is `*_service.py` — one suffix per layer,
consistently, so the layer a file belongs to is legible from its name alone without opening it.

```
career-pilot/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app, CORS, router registration
│   │   ├── core/config.py       pydantic-settings, loads backend/.env by absolute path
│   │   ├── middleware/
│   │   │   ├── auth.py          get_current_user dependency: verifies bearer JWT, returns AuthedUser{id, email, client}
│   │   │   └── supabase_client.py  builds a Supabase client with the user's JWT in headers (see Auth model)
│   │   ├── models/               Pydantic request/response schemas, one file per resource
│   │   │   ├── job_model.py              JobExplanation/TypicalDay (agent outputs), JobDescription*, JobAnalysisOut
│   │   │   ├── application_model.py      ApplicationCreate/Update/Out, TimelineEntryCreate, InterviewQuestionsRequest
│   │   │   ├── interview_model.py        QnAItem{question, answer_should_cover[], draw_on}, QnARoundType
│   │   │   └── resume_document_model.py  ResumeContent/ResumeStyle/SkillsSection (Resume Builder document shape) +
│   │   │                                  JDReview/JDGap/ResumeHint/CoachMessage/GapTurnResponse (JD Coach shapes, see "Resume Builder")
│   │   ├── routers/               FastAPI route handlers — thin, delegate to services
│   │   │   ├── jobs_router.py, applications_router.py, resume_documents_router.py
│   │   ├── services/               business logic + Supabase queries
│   │   │   ├── job_service.py, application_service.py, resume_document_service.py
│   │   └── agents/                 LangChain calls, one file per AI task (Gemini via get_llm(), or
│   │       │                        OpenRouter/Nemotron via get_openrouter_llm() — see "AI agents" below)
│   │       ├── _llm.py             get_llm()/get_openrouter_llm() — the ONE place model names are set
│   │       ├── job_explainer.py    JD text → JobExplanation (5-section format, see below)
│   │       ├── typical_day.py      JD text → TypicalDay (5-section format, see below)
│   │       ├── translator.py       re-runs job_explainer's output through the model in another language
│   │       ├── interview_qna.py    JD + resume + round_type + company snapshot → InterviewQnA (guidance, not a script)
│   │       ├── company_snapshot.py JD/company/position → culture/values/themes (ApplicationDetail's Company Snapshot tab)
│   │       ├── email_classifier.py Gmail sync's classifier (stays on Gemini deliberately, see "Gmail sync")
│   │       ├── resume_importer.py  multimodal: PDF/image → ResumeContent (Resume Builder import)
│   │       ├── jd_coach.py         Resume Builder's JD Coach — review + gap interview (see "Resume Builder")
│   │       └── summary_generator.py  drafts a personal statement from the rest of the resume when it's empty
│   ├── tests/                     158 tests as of this session (`tests/unit/*`, `tests/routers/*`) —
│   │   │                           see "Testing approach" for what changed here.
│   ├── requirements.txt
│   └── .env.example                SUPABASE_URL/ANON_KEY (safe, public), SUPABASE_SERVICE_ROLE_KEY,
│                                    GEMINI_API_KEY, OPENROUTER_API_KEY (secrets — user fills in backend/.env, gitignored)
└── frontend/
    ├── src/
    │   ├── main.tsx, App.tsx        AppChrome layout route wraps authenticated pages in the top nav; unauthenticated → Login
    │   ├── context/
    │   │   └── AuthContext.tsx      session state via supabase.auth.onAuthStateChange
    │   ├── components/
    │   │   ├── Topbar.tsx, ProtectedRoute.tsx
    │   │   ├── Icons.tsx             all inline SVG icons (no icon package dependency)
    │   │   ├── JobExplanationTab.tsx, TypicalDayTab.tsx   (the only 2 analysis tabs — Resume
    │   │   │                          Match was deleted, see "Resume-match (removed entirely)")
    │   │   ├── LanguageSelect.tsx    searchable language combobox used by JobExplanationTab's translate control
    │   │   ├── ResumePreviewModal.tsx  small centered modal, iframes a resume's signed file_url
    │   │   ├── IconPopover.tsx       generic icon-button-that-opens-a-panel (click-outside-to-close
    │   │   │                          baked in) — used by GmailSync.tsx and Applications.tsx's
    │   │   │                          "track a new application" trigger
    │   │   ├── GmailSync.tsx         icon (mounted via IconPopover) - see "Gmail sync" below
    │   │   ├── ApplicationTimeline.tsx  typed/editable timeline entries, see "Applications overhaul" below
    │   │   ├── CompanySnapshotCard.tsx  AI company culture/values card (renders bare - hosted in a tabbed card)
    │   │   ├── InterviewQuestionsCard.tsx  behavioural/hiring-manager interview prep, resume-document picker, tab beside the snapshot
    │   │   └── resume-builder/       Resume Builder editor components (SectionList, per-section
    │   │       │                      forms, PhotoUpload, ResumePreview, StylePanel, JDCoachPanel,
    │   │       │                      TemplatePickerModal) — see "Resume Builder" below
    │   │       └── templates/        ClassicTemplate/SidebarTemplate/CompactTemplate/TimelineTemplate/
    │   │                              BannerTemplate.tsx, blocks.tsx (shared), hints.tsx (JD Coach inline hint layer)
    │   ├── pages/
    │   │   ├── Landing.tsx           public marketing page (/) - hero, marquee, features,
    │   │   │                          workflow, tracker showcase, quotes, CTA, footer
    │   │   ├── Dashboard.tsx         signed-in home (/dashboard) - stat tiles, pipeline funnel,
    │   │   │                          recent activity, upcoming interviews, quick actions
    │   │   ├── Login.tsx             split auth screen (form + ink side panel)
    │   │   ├── JobUnderstanding.tsx  paste JD (/job-analysis), hosts the 2 analysis tabs
    │   │   ├── Applications.tsx      Kanban board, icon-popover actions in the page header, loading skeleton on first load
    │   │   ├── ApplicationDetail.tsx  back link, editable company/position header, typed timeline, Company Snapshot
    │   │   ├── ResumeLibrary.tsx     Resume Builder document list (/resume-builder)
    │   │   └── ResumeEditor.tsx      Resume Builder editor (/resume-builder/:documentId) — preview
    │   │                              pane + collapsible right rail (Style | Tailor to JD tabs)
    │   ├── lib/
    │   │   ├── supabaseClient.ts
    │   │   ├── languages.ts          static list of languages for LanguageSelect
    │   │   ├── useReveal.ts          landing-page scroll reveal (progressive enhancement)
    │   │   └── api.ts                ALL backend calls + all shared TS types live here
    │   ├── index.css                 design tokens (CSS custom properties) + base reset
    │   └── styles/
    │       ├── components.css        the design system: .card, .btn*, .input, .tabs, .badge*, .board*, .topbar*, .builder-*, .jdc-*, .hint-*, etc.
    │       ├── resume-templates.css  Resume Builder template layouts (reads --resume-* custom properties)
    │       └── print.css             scopes window.print() to #resume-print-root, see "Resume Builder"
    ├── vercel.json                   SPA rewrite (every path -> index.html) + build config
    ├── public/_redirects             same fallback for Netlify/Cloudflare Pages
    └── .env.example                  VITE_SUPABASE_URL/ANON_KEY (safe), VITE_API_BASE_URL
```

**Ask CareerPilot chatbot — removed entirely** (not just unused): `Chatbot.tsx`, `ChatContext.tsx`,
`chat_assistant.py`, `chat_service.py`, `chat.py` (router + model), and the `POST /chat` endpoint
are all deleted, along with their tests. It was a floating icon + pop-out panel with frontend-only
history, grounded in whatever `job_id`/`resume_id` was "currently open"; nothing replaced it.

## Auth model (important, easy to get wrong)

Every authenticated backend request builds a **per-request Supabase client** scoped to the
caller's JWT via `ClientOptions(headers={"Authorization": f"Bearer {token}"})` at client
*construction* time (`middleware/supabase_client.py::get_client_for_user`). This matters because
`supabase-py`'s `client.postgrest.auth(token)` (the more commonly-documented approach) only sets
the header for Postgrest queries — it does **not** propagate to `client.storage`. Since resume
uploads go through Storage with RLS-style bucket policies, we needed the header set at
construction so it applies to every sub-client (postgrest, storage, functions) consistently.

Routers depend on `get_current_user` (`middleware/auth.py`), which verifies the bearer token via
`supabase.auth.get_user(token)` and returns `AuthedUser{id, email, client}` — `client` is
already scoped, so **services never see the service-role key** and RLS does the authorization
work. This means a service function is just normal Postgrest queries; there's no manual
`.eq("user_id", ...)`-then-trust-it pattern to audit for bugs — RLS is the actual boundary. (The
`.eq("user_id", user_id)` filters that do appear in services are for correctness/clarity, not
security.)

## Database (Supabase project `careerpilot`)

Tables (all with RLS enabled, owner-only policies, `user_id` FK to `auth.users`):

- `resumes` — file_url (storage path, signed on read), parsed_text, parsed_json, version
- `job_descriptions` — company, title, raw_text, source_url
- `job_analyses` — **one row per (user_id, job_description_id)** (unique constraint), columns
  `explanation` / `typical_day` / `translations` / `typical_day_translations`
  (all jsonb) get filled in independently as each tab is generated — see "Analysis lifecycle"
  below. `translations` and `typical_day_translations` are separate columns (not one shared
  structure) since they were added in separate phases - each is `Record<language, ThatSection>`.
  `match_suggestions` and `resume_id` were **dropped** — see "Resume-match (removed entirely)".
- `applications` — status enum (`applied`/`pending_interview`/`offer`/`rejected`), `company`/
  `position` (text, directly on the row — not derived from the linked JD, see "Applications
  overhaul" below), `company_snapshot` (jsonb, AI-generated), `interview_questions` (jsonb,
  AI-generated, keyed by round type — see "Interview questions" below), links to
  job_description_id + resume_document_id (points at `resume_documents`, not the removed
  `resumes` table — see "Resume Builder"). The legacy `timeline` jsonb column (`{date,note}[]`, superseded
  by `application_timeline_entries` at cutover) was dropped in a later cleanup pass - nothing had
  read or written it since that table took over.
- `application_timeline_entries` — **not** jsonb-on-applications, a real table (one row per
  timeline entry) so per-entry edits are atomic `UPDATE ... WHERE id = ?` instead of a
  read-modify-write on a shared array. `entry_type` (`applied`/`rejected`/`interview`/`case_study`/
  `note`), `occurred_at`, `content`, `details` (jsonb: `{meeting_link}` for interview,
  `{deadline, attachments:[{filename,storage_path}]}` for case_study), `source` (`manual`/`gmail`),
  `gmail_message_id` (nullable, set only for Gmail-sourced entries — kept for traceability, not the
  dedup mechanism itself, see "Gmail sync" below).
- `gmail_processed_messages` — dedup ledger, primary key `(user_id, gmail_message_id)`, no other
  columns beyond `processed_at`. Every message `sync_gmail` classifies (job-related or not,
  matched or not) gets marked here so it's never reclassified on a later sync — deliberately
  decoupled from `application_timeline_entries` (which only gets rows for messages that actually
  produced a timeline entry) so an email that's job-related-but-unmatched still only costs one
  Gemini call, ever.
- `interview_rounds` — **removed** in a later cleanup pass (table, and `models/services/routers/
  interview*.py`), along with the `applications.timeline` column above. It backed the old Interview
  Prep panel (round_type, scheduled_at, link, notes, generated_qna jsonb), which had already been
  replaced by the Interview Questions tab and had zero live callers. `agents/interview_qna.py`
  is unrelated and still very much alive — the Interview Questions tab calls it directly and caches
  results on `applications.interview_questions` rather than a rounds table.
- `gmail_sync_state` — refresh_token, google_email, last_synced_at (one row per user)

Storage: private `resume-photos` bucket (Resume Builder), RLS policies scoped by
`(storage.foldername(name))[1] = auth.uid()::text` (i.e. objects live at `{user_id}/{uuid}
_{filename}`). Reads go through a signed URL generated on demand
(`resume_document_service._with_signed_url`), 1 hour expiry. Same private/owner-scoped pattern
repeated for `application-attachments` (path `{user_id}/{application_id}/{uuid}_{filename}` —
case-study PDFs auto-fetched from Gmail, see "Applications overhaul" below). The old `resumes`
bucket (uploaded resume files for the now-removed `resumes` table) still has ~10 orphaned files in
it — the table is gone but the bucket/objects were left alone since deleting storage objects is
irreversible; worth a manual pass to actually empty and remove it.

### Analysis lifecycle (job_analyses)

`job_service._get_or_create_analysis` fetches the existing row for `(user_id, job_id)` or
creates an empty one. Each `generate_*` function then `UPDATE`s just its own column by row id.
This means: visiting the Job Explanation tab, then the Typical Day tab, then Resume Match tab
all accumulate onto the *same* analysis row rather than creating three separate rows or
clobbering each other. `GET /jobs/{id}/analysis` returns that single row (or null).

**Generation trigger**: `JobUnderstanding.tsx` fetches `listResumes()` on mount and offers two
ways to get an active resume — pick one from the "Or choose an existing resume" `<select>`, or
choose a file (a styled `<label className="btn btn-secondary">` wrapping a hidden native file
input) and click the separate "Upload" button (upload is *not* auto-triggered on file selection
anymore - the file picker and the upload action are two deliberate steps). Either path sets the
same `resume` state; `upload_and_parse_resume` still saves + parses synchronously either way, so
there's no separate "generate" step after upload itself.

Once both a resume and JD text are present, a "Generate" button on the JD card creates the job
description and fires `POST /jobs/{id}/analyze-all` (`job_service.generate_full_analysis`), which
runs all three agents *concurrently* via `app/agents/orchestrator.py::run_full_analysis` (see
below) and writes all three columns in one `UPDATE`. Additionally, a `useEffect` in
`JobUnderstanding.tsx` watches `[resume, jobDescription]` and **re-fires the same analyze-all**
whenever the active resume changes (a new upload, or picking a different one from the dropdown)
while a job description is already loaded — so resume match (and, as a side effect, explanation/
typical-day too, since they're regenerated together) never lags behind on a stale resume. Both
triggers funnel through one `runAnalysis(job, resume)` helper; a `lastAutoRunKey` ref (keyed on
`` `${jobId}:${resumeId}` ``) is set *before* the request goes out so the effect doesn't
double-fire right after the manual "Generate" click sets the same pair. The three tabs' own
generate/regenerate buttons still call the individual single-section endpoints directly for
one-off re-runs.

The three-tab card (`.analysis-card`) is now **always rendered** (tab bar always visible, so the
user can see what's coming even before generating) — only the content area conditionally shows
the actual tab component vs. a "paste a JD and click Generate" placeholder, gated on
`jobDescription` existing. This replaced an earlier version that hid the whole card behind an
all-or-nothing gate message.

## AI agents — what each one does and how it's prompted

Most agents use `app/agents/_llm.py::get_llm()`, currently `gemini-flash-lite-latest`. **Do not
casually swap this** — see "Gemini model/quota gotcha" below. Two agents (`jd_coach`,
`summary_generator`) instead use the sibling factory `get_openrouter_llm()` (NVIDIA Nemotron 3
Ultra via OpenRouter) — see "OpenRouter / Nemotron" below for why and its gotchas. `chat_assistant`
and `resume_customizer` (OpenRouter) and `resume_parser`/`resume_enhancer` (Gemini) are **deleted**,
not just unused — the chatbot has no successor; JD-based tailoring is now `jd_coach.py` (see
"Resume Builder"); the old flat-record resume parser has no successor (`resume_importer.py` is the
one live PDF/image extractor, feeding the builder directly); AI-enhance's successor is
`summary_generator.py` (see "Resume Builder").

- **job_explainer** — produces `JobExplanation` in a fixed 5-section shape the user specified
  exactly: `one_sentence_summary`, `top_responsibilities[]` (exactly 3), `requirements`
  (`hard_requirements`/`learnable`/`bonus`, each with requirement/why_it_matters/evidence quoted
  from the JD/explanation), `key_terms[]`, `role_questions[]` (role/technical questions only -
  the old `likely_questions{hr_questions[], role_questions[]}` shape was flattened and HR/general
  questions dropped entirely, since only the role-specific half was ever useful here). The prompt
  text in `job_explainer.py` is close to verbatim what the user specified — don't paraphrase it
  away without checking with them first.
- **typical_day** — produces `TypicalDay`: `overview`, `day_breakdown{morning, afternoon,
  end_of_day}` each with approximate_time/activity/description/rationale,
  `time_allocation` (7 percentage buckets — **normalized server-side to sum to exactly 100** via
  `_normalize_time_allocation`, since the model doesn't reliably hit 100 on its own),
  `collaborators[]`, `surprises[]` (explicitly framed as estimates, not real company data).
- **orchestrator** — not a third analysis type, just fans out `job_explainer`/`typical_day`
  concurrently using LangChain's `RunnableParallel` (runs each branch in a thread pool; since every
  branch is a blocking Gemini HTTP call, this cuts wall-clock time to roughly the slowest single
  branch instead of their sum). Used only by the `analyze-all` path; the two single-section
  endpoints call their agents directly and don't go through this. `jd_coach.review` reuses the exact
  same `RunnableParallel` pattern for its own two independent sub-calls (evaluate + reframe) — see
  "Resume Builder".
- **translator** — re-runs `JobExplanation` through the model with a "translate every field into
  {language}" prompt, structured-output-parsed back into the *same* `JobExplanation` shape. Only
  translates the explanation (not typical day) — that's what was asked for.
- **company_snapshot** — JD/company/position → culture/values/engineering-focus/interview-themes,
  cached on `applications.company_snapshot`. Explicitly framed as general/estimated model
  knowledge, not verified insider data — feeds `interview_qna`'s behavioural round (below).
- **interview_qna** — `InterviewQnA{questions: [{question, answer_should_cover[], draw_on}]}` for
  round type `behavioural` (grounded in the company snapshot — "if the snapshot says the company
  values fast shipping, ask about a time the candidate had to move quickly") or `hiring_manager`
  (grounded in the JD + resume fit). **Deliberately carries no written answer** — `suggested_answer`
  was removed this session in favour of `answer_should_cover` (what a strong answer needs to hit)
  and `draw_on` (which specific resume experience to build it from), because a scripted answer is
  one the candidate can't defend under a follow-up and won't sound like them. Grounded in whichever
  resume the caller picked: a Resume Builder document (preferred — flattened via
  `jd_coach.flatten_resume_content`, same flattener the JD Coach uses) or the uploaded-file fallback
  linked to the application. `hr`/`technical` still validate as *stored* round types (old rows
  don't break) but nothing generates them any more.
- **email_classifier** — Gmail sync's classifier, stays on Gemini deliberately, on measured
  evidence — see "Gmail sync".
- **resume_importer** — multimodal (PDF/image bytes, base64-inlined): PDF/image → `ResumeContent`
  for a brand-new Resume Builder document. Its extraction schema models each description as
  `list[str]` (one item per genuine bullet) rather than a single string the model has to embed its
  own newlines into — the model is unreliable at the latter, and would routinely turn one bullet
  that happened to visually wrap across lines in the source PDF into several separate bullets. The
  service joins the list back into the `"\n"`-delimited string `ResumeContent` actually stores.
- **jd_coach** — the JD Coach (see "Resume Builder" for the full flow: `review()` for per-bullet
  reframe hints, `gap_turn()` for the bounded gap interview). Also exports
  `flatten_resume_content(content)` — a Resume Builder document rendered as plain text for a
  prompt — which `interview_qna`'s resume-document grounding reuses rather than duplicating.
- **summary_generator** — `generate_summary(content) -> str`, powers SummaryForm's "Draft from my
  resume" button (only offered while the field is empty — see "Resume Builder"). Reuses `jd_coach`'s
  `NO_INVENTION_RULE` and `flatten_resume_content` rather than keeping its own copy that could drift.

### Gemini model/quota gotcha (read before changing `_llm.py`)

`gemini-flash-latest` currently resolves to a newer model with a **20-requests/day free-tier
cap**, which was hit mid-development. Switched to `gemini-flash-lite-latest`, which has a much
more generous free quota and has worked fine for everything built so far. If you hit
`RESOURCE_EXHAUSTED` again, check `google.genai.Client(...).models.list()` for what's currently
available to this API key before picking a replacement — model aliases and their tiers/quotas
have moved multiple times already during this project.

**A second, different quota failure mode**: `RESOURCE_EXHAUSTED` also fires with `"Your
prepayment credits are depleted"` when the Google AI Studio project's billing/prepaid credits run
out - unrelated to the free-tier daily cap above, and it needs the user to add credits at
https://ai.studio/projects, not a model change. This is nastier to diagnose than it sounds: it
takes ~30-40s for LangChain's retry logic to give up, and by the time it does, the dropped/timed-
out connection makes the *browser* report a generic `net::ERR_FAILED` / "CORS policy" console
error (no CORS headers reach the browser because the backend never got to send a response) —
there is no hint in the browser that it's actually a Gemini billing issue. If analyze-all/
translate/etc. "just hangs then fails" with a CORS-shaped error in the console, check the backend
terminal (or reproduce the service-layer call directly in a `python -c` one-liner) for the actual
traceback before assuming it's a CORS or frontend bug - it can look exactly like a CORS error in
the browser console with no hint that it's actually a billing issue on the backend.

### OpenRouter / Nemotron (jd_coach + summary_generator only)

`app/agents/_llm.py::get_openrouter_llm(model="nvidia/nemotron-3-ultra-550b-a55b")` is a second,
separate LLM factory alongside `get_llm()` — `ChatOpenAI` pointed at OpenRouter's OpenAI-compatible
endpoint (`base_url="https://openrouter.ai/api/v1"`) rather than a dedicated OpenRouter SDK. Needs
`OPENROUTER_API_KEY` in `backend/.env`. Used by `jd_coach` and `summary_generator`; every other
agent stays on Gemini via `get_llm()`. `.with_structured_output(...)` works fine against it too
(goes through OpenAI-style function calling under the hood).

**Gotcha 1 — max_tokens**: leaving it unset makes `ChatOpenAI` request this model's full
65536-token output ceiling on *every* call. OpenRouter's low-balance 402 (`"requires more credits,
or fewer max_tokens"`) rejects that outright — even for a two-sentence reply — instead of silently
capping to what the balance affords. `get_openrouter_llm` defaults to `max_tokens=1024`;
`jd_coach.review`'s reframe call and `gap_turn` both pass higher explicit values since they return
several structured items in one response. If you add another OpenRouter-backed agent, size this to
what it actually returns rather than copying the default blindly.

**Gotcha 2 — needs a much blunter anti-fabrication prompt than Gemini did, and it is an ongoing
fight, not a one-time fix**: a polite "never invent facts" is not enough for this model. Early on,
against a resume with no FastAPI/AWS experience and a JD demanding both, Nemotron wrote "5 years
building scalable APIs... **including experience with FastAPI and AWS cloud services**". `jd_coach.py`'s
`NO_INVENTION_RULE` names the failure mode concretely ("if the JD asks for FastAPI and the resume
only shows Flask, keep Flask") rather than stating the rule abstractly — keep that bluntness if this
prompt is edited; softening it back to the abstract phrasing reintroduces the fabrication.

This resurfaced in a subtler form even with the blunt rule in place: the reframe agent would bolt
the JD's *domain* onto real work ("...for assurance and GRC workflows" appended to a line that never
mentioned that domain) and would return "rewrites" that only reworded a line without changing what
it claimed — both of which read as either an invented context or as noise, not a real improvement.
`REFRAME_PROMPT` now names both failure modes explicitly (`MEANINGFUL_CHANGE_RULE` and a "do not
bolt on a domain that isn't there" rule) and `jd_coach._is_meaningful_change` backstops it in code —
comparing the original and suggested text on a normalised (case/whitespace/punctuation-folded) form
and dropping any "edit" that didn't actually change anything, regardless of what the model claimed
its `change_type` was. **If suggestions still read as cosmetic or as inventing context, that prompt
is the first place to look, not `_is_meaningful_change`** — the code-level filter can only catch
edits that are *textually* identical, not edits that are wordy-but-empty in a new way.

The candidate-facing structural mitigation is still the review step itself: every reframe hint shows
before/after/reason on the preview and is Accept/Dismiss, one at a time — nothing is silently
applied. `jd_coach.review`'s skills reframes are additionally safe by construction: `customize`-style
skill edits are filtered against the resume's *existing* skills, so an invented skill can never reach
the document that way either. Free-text lines (summary, work-experience/project bullets) have no
equivalent structural guardrail, which is exactly why the prompt-level rules above matter.

**Gotcha 3 — a prompt rewrite silently dropped the actual content being rewritten**: while
hardening `REFRAME_PROMPT` against the above, an edit removed the trailing `Job description: {jd_text}`
/ `Editable resume lines: {slot_text}` section entirely, leaving all the *rules* in place but no
`{slot_text}` placeholder anywhere in the template — so `.format(...)` silently accepted the kwarg
and dropped it, and the reframe call ran with no visibility into what it was supposed to be
rewriting. Caught by grep (`{jd_text}`/`{slot_text}` not appearing in `REFRAME_PROMPT`'s source),
not by a test — there is no test that would have caught a prompt silently missing its own subject
matter, since the mocked-agent-boundary tests never call the real model. If a JD Coach prompt is
edited again, grep for its own placeholders after editing, not just for the new rules.

### Tracing (LangSmith, optional)

`app/core/config.py` calls `load_dotenv(BACKEND_DIR / ".env")` and, if `LANGCHAIN_TRACING_V2` +
`LANGCHAIN_API_KEY` are set, pushes `LANGCHAIN_TRACING_V2`/`LANGCHAIN_API_KEY`/`LANGCHAIN_PROJECT`
into `os.environ`. That's the entire integration — LangSmith's tracing is wired into every
`langchain-core` `Runnable` (which is what `get_llm()`, `.with_structured_output(...)`, and
`RunnableParallel` all produce), so every agent call is traced automatically once those env vars
are in the process environment. No code in `app/agents/*` references LangSmith at all. `settings`
alone (a pydantic-settings object) is *not* enough for this — LangSmith reads `os.environ`
directly, not our `Settings` instance, which is why the explicit `os.environ[...] = ...` lines
exist right after `settings = Settings()`. Needs a free `smith.langchain.com` account + API key in
`backend/.env`; disabled by default (`LANGCHAIN_TRACING_V2=false`).

### Translation (Job Explanation + Typical Day)

Both tabs share the same UX, built once and reused: `LanguageSelect.tsx` is a searchable combobox
(text input + filtered dropdown over the static list in `lib/languages.ts`, "Original" pinned
first, translated languages marked "Saved") driving a `language` string state in the parent tab
component. `app/agents/translator.py::translate_structured(model, language)` is generic over
*any* Pydantic model (`with_structured_output(type(model))`) — both `job_service.
translate_explanation` and `job_service.translate_typical_day` call the same function, just
against `JobExplanation` vs `TypicalDay` and against the `translations` vs
`typical_day_translations` columns respectively. Selecting an already-translated language in the
dropdown switches the displayed content immediately (no request); selecting a new one shows a
"Translate to {language}" button that generates and caches it. Regenerate lives top-right of each
tab's header row (`.form-row { justify-content: space-between }`), separate from the translate
controls on the left.

## Frontend design system

Rebuilt in the "orange" pass (see phase 15) against a fintech landing-page reference the user
supplied: warm cream page, white rounded cards, one deep-espresso "ink" surface used for
high-contrast bands (hero visual, marquee, CTA, dashboard header, auth side panel), a vivid
orange primary and an amber accent used sparingly the way a highlighter is. Two type faces,
both from Google Fonts via `<link>` in `index.html`: **Bricolage Grotesque** for display
(headings, stat numbers, the landing hero) and **Plus Jakarta Sans** for body. Everything after
those two in the font URL is there only for the resume builder's font picker.

Everything lives in two files, and **no rule hardcodes a brand colour** — the only literal colours
left are translucent overlays derived from those same values (the modal scrim, the radial glows,
hairlines on ink panels), which need an alpha channel a bare token can't carry:
- `src/index.css` — the tokens (surfaces, ink, brand, text, status, radii, elevation, type,
  `--page-max`) + base element resets, a global focus ring, and a `prefers-reduced-motion` block
  that neutralises every animation/transition/`scroll-behavior` in the app at once.
- `src/styles/components.css` — the reusable classes, grouped into 21 numbered sections. Two
  shells live here and are deliberately different: `.marketing` (public landing + auth — full-bleed
  alternating cream/ink bands, oversized display type, normal page scrolling) and `.app-shell`
  (the signed-in product — viewport-locked, only innermost regions scroll; see "Full-height
  layout" below). Beyond the pre-existing vocabulary (`.card`, `.btn*`, `.input`, `.field`,
  `.tabs`/`.tab-button`, `.badge*`, `.board*`, `.progress-*`, `.subcard` + `.tier-*`,
  `.topbar*`, `.lang-select*`, `.chat-*`, `.icon-btn`/`.icon-popover*`, `.menu-item*`,
  `.builder-*`, `.template-thumb*`, `.resume-page*`), it now also carries `.marketing-nav*`,
  `.hero*`, `.marquee*`, `.section*`/`.showcase`/`.step-*`/`.stat-strip*`, `.feature-card*`,
  `.mock-window*`, `.quote-*`, `.cta-band`, `.site-footer*`, `.auth-*`, and the dashboard's
  `.dash-hero`/`.stat-tile*`/`.funnel*`/`.quick-action*`/`.list-row*`.

Class names from before the redesign were all **kept** rather than renamed, so the restyle
touched no page component that wasn't otherwise changing.

New shared pieces:
- `src/components/Icons.tsx` — every inline SVG icon used by the nav, landing page and dashboard,
  in one place. Still no icon package (same "no new frontend dependency" precedent as elsewhere);
  each icon inherits `currentColor` and takes a `size` prop.
- `src/lib/useReveal.ts` — the landing page's scroll-reveal, written as a **progressive
  enhancement on purpose**. `.reveal` on its own is fully visible; the hidden start state lives on
  `.reveal-ready`, which the hook adds itself only once it has an observer running, and a 1.2s
  failsafe timer reveals anything the observer hasn't reached. The first version put `opacity: 0`
  directly on `.reveal` and it rendered a **completely blank page** in any context where
  IntersectionObserver never fires (a backgrounded or non-compositing tab does exactly that — this
  was caught in the browser during the redesign, not in theory). If this is ever refactored, keep
  the invariant: no-JS/no-observer must still show content.

`IconPopover` takes a `variant` prop: `"panel"` (default, the wide form-shaped popover) or
`"menu"`, which adds `.icon-popover-menu` — `width: max-content`, small padding, meant for short
action lists like the resume library's Rename/Duplicate/Delete. Use `.menu-item` rows inside it
(hover background, inline SVG icon, `.menu-item-danger` for destructive actions) rather than the
bare `.link-button`s it used to hold, which rendered as loose text in an oversized card.

There is no component library (no MUI/Chakra/etc.) — just these class names applied directly in
JSX, occasionally mixed with inline `style={}` for one-off layout tweaks. Keep using this
pattern rather than introducing a UI library, unless the user asks for one.

### Routing + layout

`App.tsx` is a **layout route**, not a session-conditional wrapper: `AppChrome` (`<ProtectedRoute>`
wrapping `.app-shell` + `<Topbar/>` + `<main>` with an `<Outlet/>`) is the parent route for every
product page, so the nav mounts **once** and survives navigation between them. `/` (Landing) and
`/login` sit outside it and render their own chrome.

| Route | Page | Auth |
| --- | --- | --- |
| `/` | `Landing.tsx` | public |
| `/login` | `Login.tsx` (`?mode=sign_up` opens the sign-up variant) | public |
| `/dashboard` | `Dashboard.tsx` | protected |
| `/job-analysis` | `JobUnderstanding.tsx` — **moved off `/`** in phase 15 | protected |
| `/applications`, `/applications/:id` | `Applications.tsx`, `ApplicationDetail.tsx` | protected |
| `/resume-builder`, `/resume-builder/:documentId` | `ResumeLibrary.tsx`, `ResumeEditor.tsx` | protected |
| `*` | redirect to `/` | — |

The public pages load eagerly; **every protected page is `React.lazy`-loaded** behind a `<Suspense>`
inside `AppChrome`, so a cold visitor to the landing page doesn't download the resume-builder
editor (by far the heaviest route). This cut the entry bundle from ~580kB to ~487kB (158→140kB
gzipped) with the editor split into its own 51kB chunk.

`ProtectedRoute` redirects to `/login` with `state.from` set to the path that was attempted, and
`Login` honours it — so a deep link (an emailed `/applications/:id`, say) survives the sign-in
detour instead of dumping the user on the dashboard.

Product pages are full-viewport-width — there's no sidebar eating horizontal space, which is what
lets `JobUnderstanding.tsx`'s two-column layout size itself against the actual viewport (see
"Scrollable split layout" below).

### Full-height layout, no page scroll (`.page-fill` / `.split-layout` in components.css)

The whole app shell is height-bound to the viewport, not just this one page: `.app-shell` is
`height: 100vh` (not `min-height`), `.main-content` is `flex:1; min-height:0; overflow-y:auto`
(so pages with more content than fits — e.g. Applications' board — scroll *inside*
`.main-content`, never at the `body` level). A page opts into filling that space exactly (rather
than just flowing to its natural height) by wrapping its return value in `<div
className="page-fill">` (`display:flex; flex-direction:column; flex:1; min-height:0`) —
`JobUnderstanding.tsx` does this so `.split-layout` can be `flex:1` and get a real, definite
height to distribute to its children, all the way down: `.split-layout-left` and the right
analysis `.card` both stretch to fill it, and only the innermost scrollable regions actually
scroll (`.analysis-scroll` for the tab content; each `.split-layout-left .card` independently for
the resume/JD boxes — not one shared scroll for the whole left column). **Gotcha already hit
once**: `.main-content`'s direct child is the *page's own root div* — if that div isn't
`.page-fill` (or otherwise part of the flex chain), `flex:1` on anything inside it does nothing,
because flex properties only apply to direct children of a flex container. If a page's content
isn't filling/scrolling as expected, check that the page's outermost returned element is actually
flexed into the chain, not just floating as an unstyled wrapper.

**Resume/JD box sizing is intentionally asymmetric**: `.split-layout-left .resume-card` is `flex:
0 0 auto` (hugs its own content — the resume box has fixed-height chrome: file picker, existing-
resume dropdown, active-resume line) while the plain `.split-layout-left .card` rule gives the JD
card `flex: 1` (absorbs whatever's left, so its textarea gets most of the vertical room). **Gotcha
already hit once**: `.resume-card { flex: 0 0 auto }` alone silently loses to the more specific
`.split-layout-left .card { flex: 1 }` rule (two chained classes beats one, regardless of source
order) — it has to be written as `.split-layout-left .resume-card` to win. Both rules'
`overflow-y: auto` (from the base `.card` rule) plus `min-height: 0` on their flex children
(`.jd-textarea`, previously also `.resume-preview` before it was removed - see below) is what
keeps any single box's overflow contained to itself instead of forcing a sibling or the whole
column to grow/scroll. **This full-height/no-scroll behavior only applies above the `900px` width
breakpoint** — below it, `.split-layout` falls back to `flex-direction:column` with `flex:none`
and `overflow-y:visible` everywhere (a normal stacked, page-scrolling mobile layout, scrolling
inside `.main-content` same as any other page). If you're testing this in an automated browser and
it looks like one long scrolling page, check the viewport width first.

## Chatbot — removed

The floating "Ask CareerPilot" chatbot (icon + pop-out panel, frontend-only history, `POST /chat`
re-deriving job/resume context per request via `ChatScopeProvider`) existed for several phases and
is now **deleted entirely** — `Chatbot.tsx`, `ChatContext.tsx`, `chat_assistant.py`, `chat_service.py`,
`chat.py` (router + model), the endpoint, and their tests. No successor; nothing else in the app
grounds itself in "whatever page is currently open" the way it did. Two leftover copy references
(a landing-page feature card, an onboarding-guide step) were reworded rather than left dangling.

## Resume-match (removed entirely)

The Job Analysis page's Resume Match tab, its resume picker/upload, and the whole structured
PDF-export path that hung off it are **gone** - not "left in place, unused" as an earlier revision
of this file described them. Deleted: `agents/resume_matcher.py`, `components/ResumeMatchTab.tsx`,
`services/pdf_service.py`, `resume_service.apply_edits_to_parsed`, `POST /jobs/{id}/resume-match`,
`POST /resumes/export-pdf`, and the `ResumeMatch`/`ResumeEdit`/`ResumeExportRequest` models on both
sides. Dropped from the DB: `job_analyses.match_suggestions` and `job_analyses.resume_id`.

JD-based resume tailoring lives **only** in Resume Builder now (see that section) - against the
builder's structured document, not a flat text blob. `reportlab` is still in `requirements.txt`
but no longer imported by anything now that `pdf_service.py` is gone; Resume Builder exports via
browser print instead.

Job Analysis is therefore JD-only: paste a JD, click Generate, get Job Explanation + Typical Day
(both JD-derived, neither takes a resume). `POST /jobs/{id}/analyze-all` correspondingly takes no
request body anymore.
## What's built (phases, roughly in order)

0. Scaffold — Supabase project + schema, FastAPI skeleton, Vite/React skeleton, `.claude/launch.json` dev-server configs
1. Resume upload + Gemini parsing, JD paste/save, minimal Supabase Auth UI (login/signup)
2. Job Explanation / Typical Day / Resume Match tabs (first version, later rewritten — see phase below)
3. Resume-match rewritten to span-based edits; highlight-click-apply UX; PDF export
4. Application tracker: Kanban board, application detail, timeline notes
5. Job Explanation + Typical Day rewritten to the exact 5-section specs the user provided;
   full frontend redesign to match `reference.png`; interview prep (Q&A generation + rounds UI)
6. Gmail sync (OAuth connect/callback, on-demand inbox scan + AI classification, review-before-
   apply UI) — code complete; hit and fixed a real bug (`supabase-py` rejecting the service-role
   key format, see gotchas below) during the user's first live connect attempt. Full round trip
   (connect → callback saves token → sync against a real inbox) still pending final confirmation
   from the user (see "Gmail sync" section above)
7. "Understand a Job" page overhaul: top nav replacing the sidebar (both pages now full
   viewport width); resume upload auto-saves on file select (no button, no keyword/skills
   display, just a small scrollable text preview - **superseded by phase 8**); JD generation
   moved from an automatic `useEffect` to an explicit "Generate" button; Job Explanation's
   translate control became a searchable language combobox with switchable saved translations and
   a top-right regenerate button; the analysis panel scrolls internally instead of growing the
   whole page; resume-match suggestions switched from click-to-open to hover-to-open with a
   grace-period close; PDF export rebuilt to render a structured resume template instead of a flat
   text dump; added a floating, context-aware chatbot (frontend-only history, backend re-derives
   context per request)
8. Second overhaul pass: Typical Day got the same translation UX as Job Explanation (see
   "Translation" above); resume upload UX changed to choose-file-then-explicit-Upload-button
   (no longer auto-uploads on file select) plus a dropdown to reuse any previously-uploaded
   resume; picking/uploading a resume while a job description is already loaded now auto-re-runs
   all three analyses for that resume (see "Generation trigger" above); Export-to-PDF button
   moved/styled as a clear final CTA below the summary; PDF export section order now mirrors the
   original resume instead of a fixed order (see the section-order gotcha above); the analysis
   tab bar is now always visible instead of hidden behind a gate message; added free LangSmith
   tracing support (env-var only, see "Tracing" above)
9. Third pass: resume preview replaced with a click-to-popout modal (`ResumePreviewModal.tsx`,
   see below) instead of a raw parsed-text dump; Generate no longer requires a resume - Job
   Explanation and Typical Day generate without one, only Resume Match needs it (and can still get
   one from its own independent resume picker); app shell rewritten to genuinely fill the viewport
   with no page-level scroll anywhere (`.page-fill`, see "Full-height layout" above) instead of
   the earlier `calc(100vh - Npx)` approximation; resume/JD boxes made asymmetric (resume hugs its
   content, JD absorbs the rest); Applications page's Gmail Sync and "track a new application"
   collapsed from always-visible cards into icon-triggered popovers (`IconPopover.tsx`) in the
   page header, so the 4-column board is the first thing visible instead of being pushed down;
   Gmail sync results are now auto-saved straight into the board instead of needing a manual
   accept/dismiss per detected email (see "Gmail sync" below)
10. Resume Builder: a third top-level tab, a from-scratch structured resume editor separate from
    the upload/parse flow (see "Resume Builder" below)
11. Resume Builder v2: five more section types (Projects, Awards, Languages, Volunteer,
    References, plus arbitrary user-defined Custom sections), a bigger curated font set, three
    more templates (5 total), and JD-based resume customization moved from the Job Analysis
    page's now-removed Resume Match tab into Resume Builder instead, adapted to work against the
    builder's structured document model rather than a flat text blob (see "Resume Builder" below)
14. Job Analysis stripped back to JD-only (resume upload/picker and the Resume Match tab removed,
    along with their agent, endpoints, PDF-export path and the `job_analyses.match_suggestions`/
    `resume_id` columns — see "Resume-match (removed entirely)"); Gmail sync's phantom "failed"
    fixed (concurrent message fetches + refresh-on-failure, see "Gmail sync"); Interview Questions
    added as a second tab beside Company Snapshot on the application detail page
13. Resume Builder v3: import an existing resume file (PDF/image → fully-populated builder
    document, new `resume_importer` agent); the JD flow's single "deep rebuild" split into two
    explicit choices — per-suggestion review-and-adopt against the current resume, or the existing
    wholesale build into a new one; fixed the "Building... forever" modal hang (see the
    `navigate()`-doesn't-unmount gotcha under "Resume Builder"); `chat_assistant`/`resume_enhancer`/
    `resume_customizer` moved off Gemini onto NVIDIA Nemotron 3 Ultra via OpenRouter, which needed
    a substantially blunter anti-fabrication prompt (see "OpenRouter / Nemotron")
15. **Landing page, dashboard and full visual redesign** ("orange" pass). A public marketing page
    at `/` modelled on a fintech landing-page reference the user supplied — hero with layered
    product cards (pure CSS/SVG, no images), an infinite marquee strip, feature grid, workflow
    steps on an ink band, tracker showcase, quotes, CTA band, footer — with a **Sign in** button in
    its nav. A new `/dashboard` as the signed-in home: stat tiles (applications / in interview /
    offers / resumes), a pipeline funnel, recent activity, upcoming interviews pulled out of
    timeline entries, and quick actions. Job Analysis moved from `/` to `/job-analysis`; routing
    rebuilt as a layout route with lazy-loaded protected pages (see "Routing + layout"). Design
    tokens and `components.css` rewritten to the orange/cream/ink palette with a new display face,
    keeping every existing class name. Login rebuilt as a split screen. Deploy prep: SPA rewrite
    configs for Vercel/Netlify, real page title + description/OG meta, a new favicon, and
    `VITE_DEV_AUTO_LOGIN` flipped to `false`.
12. Applications overhaul: Gmail sync rewritten to search-filter before classifying and to write
    directly into a new typed/editable timeline table instead of the old flat notes array; company
    name + position surfaced and editable on every application (previously only derivable from a
    linked JD, so Gmail-created applications were permanently "Unknown job"); Interview Prep
    (rounds + AI Q&A) removed and replaced with an AI-generated "Company Snapshot" panel (see
    "Applications overhaul" below)
16. **This session**: replaced JD-based resume tailoring end-to-end — deleted `resume_customizer.py`/
    `JDCustomizeModal.tsx`, built the JD Coach (`jd_coach.py`/`JDCoachPanel.tsx`, inline
    accept/dismiss hints on the preview, a bounded gap interview that only writes a confirmed claim
    — see "The JD Coach" under Resume Builder). Skills changed from a flat string list to categorized
    groups with a read-time upgrade path for old documents. Resume Builder's on-screen pagination was
    rewritten and three real bugs fixed along the way — duplicated content across a page break, the
    whole page scrolling into a large empty area, and an infinite `ResizeObserver` loop (see
    "Pagination" under Resume Builder). Interview prep rounds renamed `hr`/`technical` →
    `behavioural`/`hiring_manager`, stopped writing a scripted answer in favour of
    `answer_should_cover`/`draw_on` guidance, and gained a Resume Builder document picker for
    grounding. Fixed Gmail-derived interview/deadline times being stored as naive and misread as
    UTC (the browser's IANA timezone is now sent to `/gmail/sync` and used to localize them — see
    "Gmail sync" below). Removed the "Ask CareerPilot" chatbot and the old `/resumes/upload` +
    per-field "AI enhance" flows entirely (personal-statement generation is the one surviving
    "AI improves my text" affordance — see "Resume Builder"). Applications gained a loading skeleton
    and the detail page a back link. Backend `app/models/*.py`/`app/routers/*.py` renamed to
    `*_model.py`/`*_router.py` for consistency with the existing `*_service.py` convention. Added the
    first automated test suite (158 tests) — see "Testing approach".

## Gmail sync

Built in `app/services/gmail_service.py` + `app/routers/gmail_router.py` + `app/agents/email_classifier.py`,
frontend in `components/GmailSync.tsx` (mounted on the Applications page).

### "Sync now" said it failed but the data was there after a reload (fixed)

Real bug, worth understanding before touching this code. Every write in `sync_gmail` lands as it
goes (application, timeline entry, processed-marker, one message at a time). The whole thing ran
long enough that the browser gave up on the request before the server finished — so the frontend
surfaced a generic fetch failure while the backend quietly completed and committed everything. The
user saw "failed", reloaded, and found the updates already applied.

Two fixes, both needed: (1) `_get_message` is now called through a `ThreadPoolExecutor`
(`MAX_CONCURRENT_MESSAGE_FETCHES = 8`) instead of a sequential list comprehension — up to
`max_results` blocking Gmail HTTP round-trips were the dominant cost, not the AI step; (2)
`GmailSync.tsx`'s `handleSync` now refreshes status *and* the board in a `finally` block, so even a
request that dies in flight repaints the real, already-written state instead of looking like a
no-op. The error message also now says updates may still have been applied.

**Don't "fix" this by swapping the classifier to a smaller/cheaper model** — that was tried and
measured, and it makes things worse. Benchmarked on real classification prompts:
`gemini-flash-lite` did 12 emails in **4.2s**; OpenRouter's `mistralai/mistral-nemo` took **23.9s**
for the same batch and started returning provider 429/504s at concurrency 10. `openai/gpt-oss-20b`
and `google/gemma-3-12b-it` failed outright (reasoning tokens exhausted the token budget before
emitting the structured object) and `qwen/qwen3.7-flash` returned a provider 400. The AI step was
never the bottleneck. Separately, OpenRouter `:free` endpoints generally log/retain prompts — a bad
fit for classifying someone's actual inbox regardless of speed. `email_classifier` stays on Gemini.

Flow:

1. `GET /gmail/connect` (authenticated) returns a Google OAuth consent URL. The frontend does a
   full-page redirect (`window.location.href = url`), not a fetch — Google's consent screen
   can't be iframed/fetched.
2. State-CSRF protection: since Google's redirect back hits the backend directly with no bearer
   token available, the user's id is carried in the OAuth `state` param, HMAC-signed
   (`gmail_service.sign_state`/`verify_state`, keyed off `SUPABASE_SERVICE_ROLE_KEY`) so it can't
   be forged.
3. `GET /gmail/callback` (hit directly by Google, **not** authenticated via the normal
   `get_current_user` dependency) verifies the state, exchanges the code for tokens, fetches the
   Google email address, and saves the refresh token via `get_service_client()` — the **one**
   place in the codebase that intentionally uses the Supabase service-role key to bypass RLS,
   because there's no user JWT available in an OAuth-redirect context. Redirects back to
   `/applications?gmail_connected=true` (or `?gmail_error=...`).
4. `POST /gmail/sync` (authenticated, normal RLS-scoped client) — **rewritten** (see "Applications
   overhaul" below for the full before/after). `GMAIL_QUERY` now filters search-side (recent, not
   chat/promo/social, subject actually looks application-related) *before* anything is fetched or
   classified; a `gmail_processed_messages` dedup table means each message is classified at most
   once, ever, across all future syncs. `_get_message` fetches `format=full` (not `format=metadata`)
   so both the full body and any PDF attachment parts are available;
   `_extract_body_and_attachments` recursively walks the MIME `payload.parts` tree.
   `email_classifier.classify_emails` now also extracts `entry_type`/`summary`/`event_at`/
   `meeting_link`/`deadline` (see "Applications overhaul"). Companies are matched against
   `applications.company` directly (no longer requires a linked `job_description_id` — this was a
   real bug: Gmail-created applications never got one, so they could never be matched on a later
   sync). Returns a `GmailSyncResult` for the popover summary.

   **Two more real bugs fixed here**: (1) all messages in a batch used to be classified
   sequentially in Gmail's native newest-first order; `sync_gmail` now fetches every message
   first, sorts by `received_at` **oldest-first**, then classifies. Status-transition emails only
   make sense applied chronologically — processing newest-first could classify a rejection before
   the (older) application-confirmation email that should have created the application, silently
   dropping the rejection and then having the older "applied" email recreate/overwrite it as
   "applied" (this is exactly what happened to a real KUKA rejection in testing). (2) the
   create-vs-ignore branch used to require `detected_status == "applied"` to create a brand-new
   application — so a company whose *first-seen* email in a sync was `pending_interview`/
   `rejected`/`offer` (no prior "applied" confirmation ever landed, or it fell outside the 90-day
   window) was silently ignored entirely, even though the classifier correctly detected it. Now
   any job-related email with an identifiable company and no existing match creates an application
   (defaulting to the detected status, or "applied" if the email didn't clearly state one).
   **Classification is now also parallelized**: `email_classifier.classify_emails` batches all of a
   sync's messages through the structured-output runnable's `.batch(config={"max_concurrency": 5})`
   instead of one blocking Gemini call per message in a Python `for` loop — up to 5 concurrent
   classification calls at once, cutting wall-clock time roughly to `ceil(n/5)` call-durations
   instead of `n`. The per-application create/update/timeline-insert writes still happen
   sequentially afterward, in chronological order, since those need to observe each other (a later
   email in the same sync must see the application an earlier email in the same sync just
   created/updated).
5. **Writes now happen server-side, inside `sync_gmail` itself** (a deliberate change — previously
   `GmailSync.tsx handleSync` did the writes). For each classified, job-related, not-yet-processed
   message: create or update the matching application (`company`/`position`/`status`), insert a
   typed `application_timeline_entries` row (`content` = the classifier's one-line `summary`,
   `details` = `{meeting_link}` for interview / `{deadline, attachments}` for case_study — PDF
   attachments are downloaded via `_download_attachment` and uploaded to `application-attachments`
   before being referenced), and mark the message processed. `GmailSync.tsx` now just calls
   `syncGmail()` and shows the result summary — no client-side `createApplication`/
   `updateApplication` loop anymore. Still no per-item confirmation step (same "land straight in
   the board" decision as before), just relocated to the backend since there's now real per-entry
   content to persist atomically alongside the dedup marker, not just a status flip.
6. **Real bug fixed this session — interview/deadline times off by the user's UTC offset**:
   `email_classifier` extracts `event_at`/`deadline` as plain ISO strings with no timezone, because
   an email saying "your interview is at 3pm on Tuesday" gives it nothing to infer one from. That
   naive value going straight into a `timestamptz` column made Postgres read it as UTC — so a 3pm
   interview for a UTC+8 user displayed as 11pm. `POST /gmail/sync?timezone=<IANA name>` now takes
   the caller's timezone (the frontend sends `Intl.DateTimeFormat().resolvedOptions().timeZone`,
   the one thing that actually knows it), and `gmail_service._parse_iso(value, assume_tz)` attaches
   that zone to any value that arrives with no explicit offset (an explicit offset, or a trailing
   `Z`, is always respected over the caller's zone) — applied to both `event_at` and `deadline`, and
   falls back to UTC if the browser's zone name is missing or unrecognized rather than failing the
   whole sync. `zoneinfo` needs a real `tzdata` package on Windows and on slim Linux images (neither
   ships a system tz database) — added as an explicit `requirements.txt` dependency rather than an
   assumption; `tests/unit/test_gmail_timezones.py` pins the naive/explicit-offset/missing-zone cases.

Setup requires a Google Cloud OAuth client (Gmail API enabled, OAuth consent screen in Testing
mode with the user added as a test user, Web application credential type, redirect URI
`http://localhost:8000/gmail/callback`) — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in
`backend/.env`. **The actual "click through Google's consent screen and grant access" step
requires the user's real Google login and cannot be automated/tested by an agent** — everything
up to that boundary (`/gmail/connect` producing a well-formed auth URL, `/gmail/status`,
`/gmail/callback` failing gracefully on bad input) was verified with real credentials; the full
round-trip (callback actually saving a token, `/gmail/sync` against a real inbox) needs the user
to click "Connect Gmail" themselves at least once. The Gmail rewrite's MIME-parsing/attachment
logic (`_extract_body_and_attachments`, `_download_attachment`) and the dedup table were verified
directly — synthetic multipart MIME payload for the parser, real DB round-trip for
`gmail_processed_messages` — since there's no real inbox with matching mail in this dev
environment; still needs a real "Sync now" click with real mail to fully confirm end-to-end.

## Applications overhaul

**Loading state (added this session)**: `Applications.tsx` shows a skeleton board only on the
*first* load (`loading` state, cleared in `loadAll`'s `finally`) — a later reload (after a drag, a
delete, a Gmail sync) keeps the existing cards on screen rather than blanking a populated board,
since swapping real content for a spinner on every small change reads as the page breaking rather
than as progress. `ApplicationDetail.tsx` gained a `← Applications` back link, shown even while the
application is still loading or failed to load — a dead end with no way out is exactly when it's
most needed.

**Board card: drag-and-drop instead of a status `<select>`**: `Applications.tsx`'s board card no
longer has a status dropdown — cards are `draggable`, columns are drop targets
(`onDragOver`/`onDrop`), and dropping a card on a different column calls the same
`handleStatusChange`/`updateApplication` that the old dropdown called. Plain native HTML5 DnD, no
new frontend dependency (same "no drag-and-drop library" precedent as Resume Builder's ▲▼ section
reordering). Card layout is now company name (bold, links to the detail page), position beneath
it, then a bottom `Updated {date}` line (`applications.updated_at`) — replaced the old single
`applicationLabel()` combined-string title. `loadAll()` also now clears `error` on a successful
load (it previously only ever set it, never cleared it, so one transient failed request — e.g. the
dev server hot-reloading the backend mid-request — left a stale "Failed to load applications"
banner on screen indefinitely even after later loads succeeded).

**Company + position, editable, on every application**: `applications.company`/`.position` are
plain text columns, populated at creation (from the linked JD, or directly from Gmail's detected
`company`/`role` — previously discarded, see "Gmail sync" above) and editable inline on
`ApplicationDetail.tsx`'s header (click the name/position → text inputs → Save). `Applications.tsx`'s
board card (`applicationLabel()`) prefers these direct fields over the old JD-derived `jobLabel()`,
so a Gmail-created application (which never gets a linked `job_description_id`) shows a real
company/position instead of "Unknown job" once populated. `job.title`/`job.company` are still the
fallback for applications created the old way (linked-JD, no direct fields set) — nothing about
that path changed.

**Typed, editable timeline**: `application_timeline_entries` (see "Database" above) replaced the
flat `{date, note}` jsonb array. `ApplicationTimeline.tsx` renders every entry with a
type-appropriate compact display (`applied`/`rejected`/`note` = just `content`; `interview` =
date/time + a "Join meeting" link from `details.meeting_link` + notes; `case_study` = `details.
deadline` + description + attachment download links from `details.attachments[].url`, signed
per-request by `application_service._sign_attachments` the same way `resume_document_service.
_with_signed_url` signs `photo_url`) — every entry has an Edit (reuses the same form component the
"+ Add entry" type-picker uses, pre-filled) and Delete action, both real atomic per-row
operations (`PATCH`/`DELETE /applications/{id}/timeline/{entry_id}`), not read-modify-write on a
shared array like the old `add_timeline_entry` was.

**Company Snapshot replaces Interview Prep**: `agents/company_snapshot.py::generate_snapshot(
company, position, jd_text)` — same `get_llm().with_structured_output(...)` pattern and the same
explicit "this is general/estimated knowledge, not verified insider information, never invent
specific internal processes" caveat framing as `typical_day.py`'s "surprises" field (this content
is **not grounded in any fetched/live data** — pure model knowledge — so the honesty framing
matters here specifically). Result (`culture`, `core_values[]`, `engineering_focus`,
`interview_themes[]`) is cached on `applications.company_snapshot`; `CompanySnapshotCard.tsx` shows
a "Generate" CTA if empty, "Regenerate" once populated. The old Interview Prep panel (a standalone
rounds list + per-round AI Q&A) was removed at the time; its backend (`interview_rounds` table,
`models/services/routers/interview*.py`) was removed entirely in a later cleanup pass.
`agents/interview_qna.py` came back to life via the newer "Interview questions" tab described
below (reworked further this session — see there for the current `behavioural`/`hiring_manager`
round shape).

### Interview questions (right-hand tab, beside Company Snapshot)

`ApplicationDetail.tsx`'s right column is now a **tabbed card**: `Company Snapshot | Interview
Questions`. `CompanySnapshotCard.tsx` was changed to render *bare* (no wrapping `.card`, no own
`<h2>`) since the tab panel supplies both — if you reuse it elsewhere, wrap it yourself.

`InterviewQuestionsCard.tsx` optionally shows a Resume Builder document picker (`listResumeDocuments()`
— preselected if the user only has one), an optional saved-JD picker (`listJobDescriptions()`) or
paste box, and two buttons, **Generate behavioural round** and **Generate hiring manager round**
(round names changed this session — see below), which POST to `/applications/{id}/interview-questions`
with `{round_type, jd_text, resume_document_id}`. That calls
`application_service.generate_interview_questions`, which resolves the JD in priority order: pasted
`jd_text` → the application's linked `job_description.raw_text` → a synthesized `"Role: {position}
at {company}"` stub (so a Gmail-created application, which never gets a linked JD, still works).
Resume grounding prefers the chosen Resume Builder document (flattened via `jd_coach.
flatten_resume_content`) and falls back to the `resume_document_id` linked to the application;
with neither, the agent honestly hedges rather than inventing history.

**Rounds renamed `hr`/`technical` → `behavioural`/`hiring_manager` this session**, and the agent no
longer writes an answer for the candidate: `QnAItem` is now `{question, answer_should_cover[],
draw_on}` instead of `{question, suggested_answer}` — a script the candidate reads out is one they
can't defend under a follow-up and won't sound like them, so the prep is now "what a strong answer
needs to hit" plus "which specific thing on your resume to build it from", never prose to recite.
`behavioural` is grounded in the cached `company_snapshot` (if any) so its questions are tuned to
what that company seems to value, not generic; `hiring_manager` is grounded in JD/resume fit and past
decisions. `RoundType` (stored/legacy) still accepts `"hr"`/`"technical"` so rows saved before the
rename keep loading — `QnARoundType` (generatable) is the narrower `behavioural | hiring_manager`.

Results cache on `applications.interview_questions`, **keyed by round type**
(`{"behavioural": {...}, "hiring_manager": {...}}`) so generating one never clobbers the other and
both stay browsable via a second row of tabs. Same generate/regenerate/jsonb-on-the-row shape as
`company_snapshot`.

**On auto-fetching the JD from a company's careers page** (considered, deliberately not built):
career portals are JS-rendered, bot-protected, and structurally different per ATS
(Workday/Greenhouse/Lever/in-house), so a scraper returns nothing or the wrong role often enough
that it can't be the primary path — and a *wrong* JD silently produces plausible, useless prep.
Prefilling from the JD the app already stores gets the same benefit for free on every
Job-Analysis-created application. If scraping is ever added it should be a best-effort button that
fills the textarea for the user to eyeball, never a silent substitute for it.

**A real bug fixed along the way**: `add_timeline_entry`'s old read-modify-write (`SELECT` the
whole `timeline` array, append in Python, `UPDATE` the whole array back) had a latent race — two
concurrent writes (e.g. Gmail sync writing while the user adds a manual note) could silently
clobber each other. The new per-row table with atomic per-entry `UPDATE ... WHERE id = ?` doesn't
have this problem; worth remembering if any other jsonb-array-of-things pattern in this codebase
(there are a few) ever needs the same fix.

## Resume Builder

A from-scratch, form-based resume editor — deliberately **separate** from the upload/parse flow
(`resumes` table/`ResumeParsed`, used for job-matching). Different document shape, no shared code,
no interop with the JD-match resume picker. Two pages, mirroring the `Applications`/
`ApplicationDetail` split: `pages/ResumeLibrary.tsx` (`/resume-builder` — grid of saved documents,
rename/duplicate/delete via `IconPopover`) and `pages/ResumeEditor.tsx` (`/resume-builder/:documentId`
— the 3-pane editor: section list, live preview, style panel).

**Backend**: table `resume_documents` (`id, user_id, name, template_id, content jsonb, style jsonb,
photo_url, created_at, updated_at`), RLS owner-only policy identical in shape to `resumes`/
`job_descriptions`. Bucket `resume-photos` (private, same owner-scoped storage policies as the
`resumes` bucket), path convention `{user_id}/{doc_id}/{uuid}_{filename}`. Models in
`app/models/resume_document_model.py` (`ResumeContent` = basic_info (name/location/email/phone/
photo — **age and gender were removed this session**) + summary + work_experience[] + education[]
+ projects[] + skills (`SkillsSection{groups: SkillGroup[]}` — see "Skills are grouped by category"
below) + certificates[]/awards[]/languages[]/volunteer[]/references[] + custom_sections[] +
section_order + enabled_sections; `ResumeStyle` = accent color/margins/font family/name+heading+body
size **and color** (per-role colors added this session)/line height). Service
`resume_document_service.py` and router `resume_documents_router.py` are the **only** resume
CRUD path left in the app - the old flat "upload and parse once" flow (`resume_model.py`,
`resume_service.py`, `resumes_router.py`, the `resumes` table/storage bucket) was removed
entirely in a later cleanup pass. `duplicate_resume_document` deliberately does **not** copy the
photo object — two rows sharing one storage path would break on either row's delete/replace.

**Importing an existing resume**: `ResumeLibrary.tsx` offers an **"↑ Upload Resume"** card beside
"+ New Resume". It POSTs the file to `POST /resume-documents/import` →
`resume_document_service.import_resume_document` → `agents/resume_importer.py::import_resume`,
which creates a fully-populated `resume_documents` row and navigates straight into the editor.
PDF/PNG/JPEG/WEBP, 10MB cap. This is the app's **only** resume-parsing agent - the old
upload/matching flow's `resume_parser.py` (a flatter, separate `ResumeParsed` shape with no
projects/awards/languages/volunteer/certificates) was deleted earlier, and the `/resumes/*`
endpoints it left behind (`GET`/`POST /resumes`, `GET /resumes/{id}`) were removed in the same
later cleanup pass that dropped the `resumes` table - `applications.resume_id` became
`applications.resume_document_id`, pointing at `resume_documents` instead, and Interview
Questions' fallback (see below) now reads that column. `resume_importer` is still the one Resume
Builder agent on **Gemini** (`get_llm()`) rather than OpenRouter, because extraction is
multimodal and Nemotron is text-only.

Two structural details worth keeping: (1) the LLM-facing schema mirrors `ResumeContent`'s sections
but **omits every per-entry `id`** — ids are structural (the editor keys its forms off them), so
they're generated server-side in `to_resume_content` where the model can't emit duplicates or
collide. It also models each entry's `description` as `list[str]` (one item per genuine bullet) on
the LLM side, joined into the `"\n"`-delimited string `ResumeContent` stores — the model reliably
gets "is this a new bullet or a wrapped line" right when asked to emit a list item per bullet, and
unreliably right when asked to embed its own `\n` characters into one string. (2) Sections the
uploaded resume had nothing for are written back **disabled** rather than enabled-and-empty, so an
imported document doesn't open onto a wall of empty headings; the user re-enables any of them from
the section list to fill in by hand.

**Skills are grouped by category** (added this session, replacing a flat string list): `SkillsSection
= {groups: SkillGroup[]}`, `SkillGroup = {id, category, items[]}`. One group renders as one bullet —
`"Programming Languages: Python, C, Java"` — with an empty `category` rendering as a bare,
unlabelled list of items. `SkillsForm.tsx` edits one category at a time (label + comma-separated
items) rather than one skill per line. **Legacy documents upgrade on read, not via a migration**:
`SkillsSection`'s Pydantic `model_validator(mode="before")` (`resume_document_model.py`) detects the
old `{"items": [...]}` shape, splits any `"Category: a, b, c"`-looking string into a real group, and
collects anything else into one uncategorised group — so a document saved before this change reads
correctly the moment it's opened, and re-saves in the new shape the next time it's edited. If you
touch this validator, `tests/unit/test_skills_migration.py` pins the edge cases (long "category"
that's really a sentence with a colon in it, mixed old/new shapes, blank/non-string entries).

**Personal statement can be drafted from the rest of the resume**: `SummaryForm.tsx` shows a "Draft
from my resume" button **only while the field is empty** — generating over existing text the
candidate wrote would silently discard it. `POST /resume-documents/{id}/generate-summary` →
`agents/summary_generator.py::generate_summary`, which flattens the document (via `jd_coach.
flatten_resume_content`, not its own copy) and writes 2-4 sentences grounded in what's actually
there, reusing `jd_coach.NO_INVENTION_RULE` so it can't invent a target role/industry either. This
replaced the old per-field "AI enhance" button (`resume_enhancer.py`, deleted this session) —
work-experience bullets have no equivalent "improve this text" affordance any more; the JD Coach's
reframe hints (below) are the current path for wording changes on existing bullets.

**Frontend editor**: `components/resume-builder/` — `SectionList.tsx` (left pane: Basic Info always
first, then `content.section_order` with ▲▼ reorder buttons and enable/disable checkboxes per
section — **checkbox and the expand-toggle span are siblings, not nested inside one `<label>`**;
nesting them once caused clicking the section name to also silently flip the browser's implicit
label→checkbox click-forwarding, disabling the section — keep them as siblings if this is touched
again), one form component per section, `PhotoUpload.tsx` (upload/replace/remove + size
slider/shape toggle/border toggle, no crop tool), `ResumePreview.tsx` (center pane, renders the
active template into paginated on-screen sheets — see "Pagination" below), and a **collapsible right
rail** (`ResumeEditor.tsx`) with two tabs — **Style** (`StylePanel.tsx`) and **Tailor to JD**
(`JDCoachPanel.tsx`, see "The JD Coach" below) — replacing the old always-visible style-only right
column, since the coach conversation wants more room than a sidebar strip and the resume preview is
what the user is mostly looking at while working. Five templates live in `templates/`
(`ClassicTemplate`, `SidebarTemplate`, `CompactTemplate`, `TimelineTemplate`, `BannerTemplate`)
sharing presentational blocks from `templates/blocks.tsx` so only layout CSS differs between them,
not the data rendering. Reordering is plain ▲▼ buttons (array-swap-adjacent), not drag-and-drop.

Editor state autosaves (no explicit Save button): an 800ms-debounced `updateResumeDocument` PATCH
fires on any change to `name`/`template_id`/`content`/`style`, flushed on unmount; a `loadedRef` skips
the spurious save that would otherwise fire right after the initial load populates state. JD Coach
hints (below) are deliberately **not** part of this saved state — they're session-only proposals
that only touch the document once individually accepted.

### Pagination (rewritten this session — two real bugs fixed)

`.resume-page` is `794px` wide, A4 at 96dpi. The preview used to be a single `.resume-page` div
whose height just grew with content, relying on the browser's own print engine to paginate at
export time with no on-screen indication of where a page break would fall. It's now genuinely
paginated **on screen**: `ResumePreview.tsx` measures the full, unpaginated content off-screen,
computes where each page should end, and renders each page as its own fixed-size (`794×1123`) sheet
— clipped to *that page's actual content span*, not a uniform full-page window, via negative
`margin-top` + a `.resume-page-window` sized to `pageEnd - pageStart`. Getting the window sizing
wrong is exactly how the first version of this duplicated content across a page break (see bug 1
below), so if this is touched again, verify a page's window height still equals its own content
span, not a blanket `1123px`.

**`computeBreaks` picks where to end each page**: fill up to a full `PAGE_HEIGHT` (1123px), and only
pull the break back — to the start of whatever it landed inside — when it would otherwise slice
through a `.resume-entry`/`.resume-entry-compact` or a `.resume-bullet-list > li`, or strand a
section heading (`h2`) as the very last thing on a page with its content pushed to the next one
(a small `HEADING_KEEP_WITH_NEXT` clearance guards that). **Deliberately does NOT try to keep a
whole section on one page** — an earlier version of this logic preferred whole-section boundaries
first, which routinely bumped a short trailing section (e.g. a 3-line Languages section) almost
alone onto a near-empty new page while leaving a large, ugly blank gap at the bottom of the page
before it. Filling the page normally and only pulling back the minimum needed to avoid a mid-entry/
mid-bullet cut is both more space-efficient and closer to what real print engines do.

**Bug 1 — duplicated section content across the page break**: caused by the *first* version of the
clipping window always using a full `1123px` regardless of where the computed break actually landed
— content between the pulled-back break and the full 1123px mark would render at the bottom of page
1 (unclipped bleed) *and* again at the top of page 2 (since page 2's window also started fresh at
1123px from its own break). Fixed by sizing each page's window to its actual `[start, end)` span, as
described above — verified by checking the two windows are exactly contiguous (page N's end equals
page N+1's start) with no gap or overlap.

**Bug 2 — the whole Resume Builder page scrolled down into a large empty area with nothing in it**:
a real, separate CSS bug, not a pagination-math bug. `#resume-print-root` (the always-present,
`visibility:hidden`, `position:absolute` element that both measures the unpaginated content *and*
doubles as the actual print source — see below) had no *positioned* ancestor, so `position:absolute;
top:0; left:0` resolved against the page's initial containing block instead of the intended
`.resume-page-container` — pinning an invisible box as tall as the full resume (well over 1000px for
a multi-page one) to the top of the whole document, inflating `document.body`'s scrollable height by
that much with nothing visible rendered in the extra space. Fixed with `position: relative` on
`.resume-page-container`. **If `#resume-print-root`'s positioning is ever touched, verify
`document.documentElement.scrollHeight` still equals the viewport height for a short resume** — that
equality silently breaking is exactly this bug coming back.

**Bug 3 (found while fixing 1/2) — an infinite `ResizeObserver` ↔ `setState` loop**: `measure()` (the
`ResizeObserver` callback that reads `container.clientWidth`/`measureEl.scrollHeight`/`computeBreaks`)
used to call `setScale`/`setContentHeight`/`setBreaks` **unconditionally on every firing**, including
`computeBreaks`'s return value, which is a fresh array reference every call even when its contents are
identical. Every such `setState` re-renders, which re-writes `container`'s inline `height`, which is
itself an observed resize — so once the layout settled, the observer kept re-notifying itself forever
with byte-identical measurements, hitting React's dev-mode "Maximum update depth exceeded" guard and
rendering the whole preview blank (this is very likely also what a production build of the same bug
looked like in practice — no hard crash there since that guard is dev-only, just a silently-wrong,
possibly-oscillating layout). Fixed by comparing each new measurement against the last one applied
(`lastMeasured` ref) and skipping `setState` entirely when nothing actually changed. **Any future
`ResizeObserver` callback in this codebase that calls `setState` must do the same before/after
comparison** — this failure mode reproduced even for a guaranteed-single-page resume, so it is not
specific to multi-page content.

**Export is browser print, not a second backend renderer**: `frontend/src/styles/print.css`
(imported once in `main.tsx`) scopes `window.print()` to `#resume-print-root` via the standard
`visibility:hidden` on `body *` / `visibility:visible` on the subtree trick, `@page { margin: 0 }`,
and `transform: none !important`. `#resume-print-root` stays permanently `visibility:hidden`
on-screen now (it's the off-screen measurement source, not a visible page any more), so the print
media query forces it back to `visibility: visible !important` — a plain (non-`!important`) rule
would lose to that inline style. This is the **only** PDF path in the app. `break-inside: avoid`-style
guarding is now done in JS (`computeBreaks`, above) rather than pure CSS, since the on-screen preview
needs the *same* break decisions the print engine would make, not just "don't split this element"
left to each browser's own print layout.

**Known verification gaps** (both inherent to automated browser tooling, not app bugs): a native
`<input type="file">` picker can't be driven by the Claude Browser tool — photo upload was verified
by dispatching a synthetic `DataTransfer`/`change` event via `javascript_tool` instead of a real
click-through; `window.print()` opens a native OS dialog that can't be clicked through either — the
print stylesheet/`#resume-print-root` scoping was verified structurally, but the final "Export → Save
as PDF → open it" step needs a real manual check. The on-screen pagination fixes above, by contrast,
**were** verified end-to-end in a real browser (temporary test-harness route, deleted after use) —
DOM measurements confirming contiguous page windows, zero console errors on a clean tab, and
`document.documentElement.scrollHeight === window.innerHeight` for a short resume.

### The JD Coach (replaced the old "Customize for a JD" flow entirely)

The old flow — a **"✨ Customize for a JD"** button opening `JDCustomizeModal.tsx`, offering either
"Review suggestions" (`resume_customizer.suggest_edits`) or a wholesale "Build tailored resume"
(`resume_customizer.customize_content`) — is gone. `resume_customizer.py`, `JDCustomizeModal.tsx`,
and the `/jd-match`/`/jd-suggest`/`/jd-customize` endpoints are all deleted. In its place: a **Tailor
to JD** tab in the editor's right rail (`JDCoachPanel.tsx`, backed by `agents/jd_coach.py`), built
around one rule that shapes everything else about it — **a claim only ever reaches the resume after
the candidate has confirmed it themselves**, never by inference from the JD.

**1. Review** — paste a JD, or pick one already saved from Job Analysis (`listJobDescriptions()`,
same dropdown pattern as `InterviewQuestionsCard`) → `POST /resume-documents/{id}/jd-review` →
`jd_coach.review()`, which runs two independent LLM calls concurrently via `RunnableParallel` (same
pattern as `orchestrator.py`): `_evaluate` (match score 0-100, strengths, up to 5 gaps as
`{id, title, detail}`) and `_reframe` (per-*bullet* rewrite suggestions — every editable line of the
resume is enumerated as a numbered "slot", one slot per bullet/skill-group/summary, and the model
returns at most one edit per slot it actually wants to change). Both come back as `ResumeHint{id,
target, entry_id, bullet_index, mode: "replace", original_text, suggested_text, reason,
source: "reframe"}` and are shown as **highlighted inline marks directly on the resume preview** —
click one for a before/after/reason popover with Accept/Dismiss, rather than a separate list to read
against the resume. Nothing is written until accepted. See "OpenRouter / Nemotron" above for how
hard-won `REFRAME_PROMPT`'s current rules are (no cosmetic edits, no bolting the JD's domain onto
work that wasn't in that domain) and the missing-placeholder gotcha to watch for if it's edited again.

**2. Gaps → a bounded interview, not an inference**: each gap gets a "Do I have this?" button in the
panel. Clicking it starts a conversation — `POST /resume-documents/{id}/jd-gap-turn` →
`jd_coach.gap_turn()` — that asks **one question at a time, at most 5 total**, grounded only in what
the candidate has typed in that conversation (never in guesses from the JD or the resume). Each turn
returns one of three states:
- `"asking"` — one more question, shown in the panel; the conversation continues.
- `"declined"` — the candidate doesn't have the experience (or answers stayed too vague to write
  anything truthful). **No hints are ever produced here** — this is treated as a good outcome in the
  UI ("Left off"), not a failure, because it's the exact case the whole flow exists to protect.
- `"ready"` — enough was confirmed to write something honest. Returns `ResumeHint`s with
  `mode: "append"` (`source: "gap"`) — new bullets/skills, every fact in them traceable to something
  the candidate actually typed. These render as **dashed "ghost" bullets** directly in the resume
  preview (via a `HintProvider`/`useHintLayer` context threaded through `templates/blocks.tsx`, so
  every template gets this for free without each one wiring it individually) — still Accept/Dismiss,
  same as reframe hints, and **excluded from the printed PDF** even if left pending
  (`print.css`'s `.resume-hint-ghost` rule) so an unaccepted suggestion can never accidentally ship.

Hints are addressed by **target + entry_id + bullet_index + exact original text**, all four having to
still match for a "replace" hint to render or apply — not just entry_id/position, because the
candidate can keep editing the resume while hints are pending, and a stale hint applying itself to
whatever now sits at that position (after the user edited it) would silently corrupt unrelated text.
A hint whose match no longer holds simply stops rendering rather than guessing.

**Why two LLM calls per review instead of one**: evaluating "how well does this resume match" and
rewriting individual lines are genuinely different tasks with different failure modes — bundling them
into one call previously made the model's per-line edits worse at staying grounded. Running them
concurrently (rather than sequentially) is why review doesn't take twice as long for it.

## Not built yet (known backlog)

- Cover letter generator, ATS compatibility check, resume version history, funnel analytics,
  mock interview practice mode — all flagged as backlog ideas during initial planning, not
  started.

## Testing approach

Two layers, deliberately not overlapping in what they're responsible for:

**Automated (`backend/tests/`, 158 tests as of this session)** — added in a later phase, well after
the "manual E2E only" approach below was the norm; the file layout still reflects it (`tests/routers/
test_*.py` per router, `tests/unit/test_*.py` for pure-function/agent-helper coverage). The rule that
makes this tractable: **mock at the agent boundary, never the LLM call itself**. Router tests
`unittest.mock.patch` the *service* function a route calls and assert status codes / request-shape
plumbing (validation, 404s, argument forwarding) — never a real network call. Unit tests target pure
helpers inside agent modules that don't touch an LLM at all: `jd_coach`'s slot-building/formatting/
transcript helpers, the skills-migration validator, gmail timezone parsing, and similar. **No test
in this suite ever asserts on what an LLM actually returns** — that would be either flaky (real call)
or meaningless (mocked response, which just asserts the mock). Real-call verification for agent
*quality* (does the prompt actually produce grounded, non-fabricated output) is still the manual
discipline below, not something the automated suite claims to cover.

**Manual, real end-to-end** — the original, and still primary, way features get verified:
- Every agent has been smoke-tested with a real LLM call (not a stub) before being wired into the
  API — this catches wrong model names, prompt/schema mismatches, and quota issues that a mocked
  test structurally cannot catch.
- Every feature has been tested through the actual browser (Claude Browser tool) — either against
  the actual running backend + actual Supabase project (sign up/in a real temporary test user,
  drive the real UI, verify the real response, then delete the test user and any storage objects it
  created), or, for frontend-only changes with no backend dependency to stand up, against a small
  disposable test-harness route added to `App.tsx` for the duration of verification and deleted
  before the change is considered done (used this session to catch the pagination bugs above, which
  a purely-mocked test would never have exercised — it's real DOM layout/`ResizeObserver` behavior).

If you add a new agent or endpoint: real API call first, then either a mocked router/service test if
the plumbing is worth pinning, or a unit test if there's a pure helper worth pinning — then a real
browser click-through before calling a feature done. Neither layer replaces the other.

## Dev-only auto-login (currently OFF)

`frontend/.env` has `VITE_DEV_AUTO_LOGIN` plus `VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD` pointing
at a persistent Supabase user (`dev@careerpilot.local`, created via the admin API, not a
throwaway test user). `AuthContext.tsx` checks this flag when `getSession()` comes back empty
and silently signs in as that account instead of showing the Login page — real Supabase
Auth/RLS still runs underneath, only the manual login step is skipped.

**It is set to `false` as of phase 15** (deploy prep), so the app now shows the real landing page
and sign-in screen. Flip it back to `true` locally if you want the old skip-the-login dev loop;
never ship it as `true`. `.env.example` already defaults it to `false`.

## Deploying the frontend

`npm run build` emits a static `dist/`. Because the app uses client-side routing, the host must
serve `index.html` for every path or a hard refresh on `/dashboard` 404s — `frontend/vercel.json`
(rewrites) and `frontend/public/_redirects` (Netlify) both do this, so either host works with no
extra setup. The three `VITE_*` env vars must be set in the host's dashboard, with
`VITE_API_BASE_URL` pointing at the deployed FastAPI backend rather than `localhost:8000`; the
backend's CORS origins and the Google OAuth redirect URI (`/gmail/callback`) need the deployed
origins too.

## How to run locally

```bash
# Backend
cd backend
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
# .env needs SUPABASE_URL, SUPABASE_ANON_KEY (already filled from the Supabase project),
# SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY (user must supply these secrets)

# Frontend
cd frontend
npm run dev
# .env needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (already filled), VITE_API_BASE_URL
```

Or use `.claude/launch.json` with the `run`/preview tooling — two configs, `backend` and
`frontend`, both already set up.

## Gotchas hit during development (don't re-discover these)

- **Vite 8 (rolldown-vite)**: the initial `npm create vite@latest` scaffold defaulted to Vite 8,
  which needs Node ≥20.19; this machine has 20.17, so its native `@rolldown/binding-*` package
  silently failed to install. Downgraded to Vite 6 + `@vitejs/plugin-react` 4 (stable, no native
  binding issues). If `npm run dev` fails with a `rolldown-binding` / "Cannot find native
  binding" error, this is why — don't fight it, just pin Vite 6.
- **langchain-google-genai version**: pin `langchain==1.3.14` + `langchain-google-genai==4.3.3`
  together (both current majors as of this writing). Mismatched majors (e.g. old
  langchain-google-genai 2.x with langchain-core 1.x) throw dependency-resolution errors at
  import time.
- **Gemini model names churn** — see the quota gotcha above. Always verify a model name against
  `genai.Client(...).models.list()` for the actual API key before hardcoding it.
- **supabase-py 2.11.0 rejects new-format Supabase keys**: `SUPABASE_SERVICE_ROLE_KEY` in this
  project is in Supabase's newer `sb_secret_...` format (not a legacy JWT). supabase-py 2.11.0's
  `create_client()` validates the key against a JWT-shaped regex and raises
  `SupabaseException("Invalid API key")` for anything else — this broke `get_service_client()`
  (used by the Gmail OAuth callback) with every call silently caught by a bare `except Exception`
  and surfaced only as a generic `gmail_error=connect_failed`. Fixed by upgrading to
  `supabase==2.31.0`, which accepts the new key format. If any *other* new "Invalid API key" /
  silently-generic-failure shows up in something that touches a Supabase client, check the
  installed `supabase` version first before assuming the key itself is wrong.
- Git line-ending warnings (`LF will be replaced by CRLF`) on every commit are expected on this
  Windows checkout with no `.gitattributes` — harmless, not a bug.
