# CareerPilot — Project Context

This file exists so a new agent (or a human) can pick up this project cold. It describes what
has been built, how it's structured, and what decisions were made and why. Update it whenever
you complete a phase or change something a future reader would need to know.

## What this is

An AI career copilot with two halves:

1. **Understand a job** — upload a resume + paste a job description, get a plain-language job
   explanation and a "typical day" preview (translatable). Resume-vs-JD matching used to live here
   too (a third tab, click-to-apply edits, PDF export) — it was **removed** from this page and
   replaced by JD-based customization inside Resume Builder instead (see "Resume Builder" below);
   the old upload-flow resume-match agent/endpoint is still in the codebase but unused by any UI.
2. **Build a resume** — a from-scratch structured resume editor (library + 3-pane editor,
   multiple templates/fonts, AI-enhance, photo upload, print-to-PDF export, and JD-based
   customization) — see "Resume Builder" below.
3. **Track applications & prep for interviews** — a Kanban board of applications, a timeline of
   notes per application, AI-generated interview Q&A (grounded in the actual resume) per
   interview round, and Gmail sync to auto-detect application updates from your inbox (see
   "Gmail sync" below).

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
│   │   │   ├── resume.py         ResumeParsed (agent output), ResumeCreate/Out, ResumeExportRequest (resume_id + applied_edits)
│   │   │   ├── job.py            JobExplanation/TypicalDay (agent outputs), JobDescription*, JobAnalysisOut
│   │   │   ├── application.py    ApplicationCreate/Update/Out, TimelineEntryCreate
│   │   │   ├── interview.py      InterviewRound*, QnAItem, InterviewQnA
│   │   │   ├── chat.py           ChatMessage, ChatRequest{message, history, job_id?, resume_id?}, ChatResponse
│   │   │   └── resume_document.py  ResumeContent/ResumeStyle (Resume Builder document shape, separate from resume.py)
│   │   ├── routers/               FastAPI route handlers — thin, delegate to services
│   │   │   ├── resumes.py, jobs.py, applications.py, interviews.py, chat.py, resume_documents.py
│   │   ├── services/               business logic + Supabase queries
│   │   │   ├── resume_service.py, job_service.py, application_service.py, interview_service.py, chat_service.py, resume_document_service.py
│   │   └── agents/                 LangChain + Gemini calls, one file per AI task
│   │       ├── _llm.py             get_llm() — the ONE place the model name is set
│   │       ├── resume_parser.py    multimodal: PDF/image → ResumeParsed
│   │       ├── job_explainer.py    JD text → JobExplanation (5-section format, see below)
│   │       ├── typical_day.py      JD text → TypicalDay (5-section format, see below)
│   │       ├── translator.py       re-runs job_explainer's output through the model in another language
│   │       ├── interview_qna.py    JD + resume + round_type → InterviewQnA
│   │       ├── chat_assistant.py   plain (non-structured) chat, grounded in job/resume/analysis context
│   │       ├── resume_enhancer.py  "improve this text" for Resume Builder's AI-enhance buttons
│   │       └── resume_importer.py  multimodal: PDF/image → ResumeContent (Resume Builder import)
│   ├── tests/test_health.py       only automated test that exists (health check). Everything
│   │                               else has been verified by real, manual E2E runs — see "Testing approach".
│   ├── requirements.txt
│   └── .env.example                SUPABASE_URL/ANON_KEY (safe, public), SUPABASE_SERVICE_ROLE_KEY
│                                    and GEMINI_API_KEY (secrets — user fills in backend/.env, gitignored)
└── frontend/
    ├── src/
    │   ├── main.tsx, App.tsx        AppLayout wraps authenticated routes in the top nav; unauthenticated → Login
    │   ├── context/
    │   │   ├── AuthContext.tsx      session state via supabase.auth.onAuthStateChange
    │   │   └── ChatContext.tsx      ChatScopeProvider — {jobId?, resumeId?} the floating chatbot grounds itself in
    │   ├── components/
    │   │   ├── Topbar.tsx, ProtectedRoute.tsx
    │   │   ├── JobExplanationTab.tsx, TypicalDayTab.tsx   (the only 2 analysis tabs — Resume
    │   │   │                          Match was deleted, see "Resume-match (removed entirely)")
    │   │   ├── LanguageSelect.tsx    searchable language combobox used by JobExplanationTab's translate control
    │   │   ├── Chatbot.tsx           floating icon + pop-out panel, mounted globally in AppLayout
    │   │   ├── ResumePreviewModal.tsx  small centered modal, iframes a resume's signed file_url
    │   │   ├── IconPopover.tsx       generic icon-button-that-opens-a-panel (click-outside-to-close
    │   │   │                          baked in) — used by GmailSync.tsx and Applications.tsx's
    │   │   │                          "track a new application" trigger
    │   │   ├── GmailSync.tsx         icon (mounted via IconPopover) - see "Gmail sync" below
    │   │   ├── ApplicationTimeline.tsx  typed/editable timeline entries, see "Applications overhaul" below
    │   │   ├── CompanySnapshotCard.tsx  AI company culture/values card (renders bare - hosted in a tabbed card)
    │   │   ├── InterviewQuestionsCard.tsx  JD-grounded HR/technical interview Q&A, tab beside the snapshot
    │   │   └── resume-builder/       Resume Builder editor components (SectionList, per-section
    │   │       │                      forms, PhotoUpload, ResumePreview, StylePanel,
    │   │       │                      TemplatePickerModal) — see "Resume Builder" below
    │   │       └── templates/        ClassicTemplate.tsx, SidebarTemplate.tsx, blocks.tsx (shared)
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── JobUnderstanding.tsx  upload resume + paste JD, hosts the 3 tabs
    │   │   ├── Applications.tsx      Kanban board, icon-popover actions in the page header
    │   │   ├── ApplicationDetail.tsx  editable company/position header, typed timeline, Company Snapshot
    │   │   ├── ResumeLibrary.tsx     Resume Builder document list (/resume-builder)
    │   │   └── ResumeEditor.tsx      Resume Builder 3-pane editor (/resume-builder/:documentId)
    │   ├── lib/
    │   │   ├── supabaseClient.ts
    │   │   ├── languages.ts          static list of languages for LanguageSelect
    │   │   └── api.ts                ALL backend calls + all shared TS types live here
    │   ├── index.css                 design tokens (CSS custom properties) + base reset
    │   └── styles/
    │       ├── components.css        the design system: .card, .btn*, .input, .tabs, .badge*, .board*, .topbar*, .builder-*, etc.
    │       ├── resume-templates.css  Resume Builder template layouts (reads --resume-* custom properties)
    │       └── print.css             scopes window.print() to #resume-print-root, see "Resume Builder"
    └── .env.example                  VITE_SUPABASE_URL/ANON_KEY (safe), VITE_API_BASE_URL
```

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
  job_description_id + resume_id. Legacy `timeline` jsonb column (`{date,note}[]`) is left in place, unused — superseded
  by `application_timeline_entries` (below), migrated at cutover.
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
- `interview_rounds` — round_type, scheduled_at, link, notes, generated_qna (jsonb). The *table*
  and its `models/services/routers/interview*.py` are still unused by any frontend (the old
  Interview Prep panel is gone). `agents/interview_qna.py` however is **live again** — the new
  Interview Questions tab calls it directly and caches results on `applications.interview_questions`
  rather than resurrecting the rounds table.
- `gmail_sync_state` — refresh_token, google_email, last_synced_at (one row per user)

Storage: private `resumes` bucket, RLS policies scoped by `(storage.foldername(name))[1] =
auth.uid()::text` (i.e. objects live at `{user_id}/{uuid}_{filename}`). Reads go through a
signed URL generated on demand (`resume_service._with_signed_url`), 1 hour expiry. Same
private/owner-scoped pattern repeated for `resume-photos` (Resume Builder), and
`application-attachments` (path `{user_id}/{application_id}/{uuid}_{filename}` — case-study PDFs
auto-fetched from Gmail, see "Applications overhaul" below).

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
casually swap this** — see "Gemini model/quota gotcha" below. Three agents (`chat_assistant`,
`resume_enhancer`, `resume_customizer`) instead use the sibling factory `get_openrouter_llm()`
(NVIDIA Nemotron 3 Ultra via OpenRouter) — see "OpenRouter / Nemotron" below for why and its
gotchas.

- **resume_parser** — multimodal (PDF/image bytes, base64-inlined as a `{"type": "media", ...}`
  content block). Extracts `ResumeParsed{full_name, email, phone, location, summary, skills,
  experience[], education[], raw_text}`. `raw_text` is the plain-text transcription used
  everywhere else (matching, PDF export, etc.) — it is *not* re-OCR'd elsewhere.
- **job_explainer** — produces `JobExplanation` in a fixed 5-section shape the user specified
  exactly: `one_sentence_summary`, `top_responsibilities[]` (exactly 3), `requirements`
  (`hard_requirements`/`learnable`/`bonus`, each with requirement/why_it_matters/evidence quoted
  from the JD/explanation), `key_terms[]`, `likely_questions{hr_questions[], role_questions[]}`.
  The prompt text in `job_explainer.py` is close to verbatim what the user specified — don't
  paraphrase it away without checking with them first.
- **typical_day** — produces `TypicalDay`: `overview`, `day_breakdown{morning, afternoon,
  end_of_day}` each with approximate_time/activity/description/rationale,
  `time_allocation` (7 percentage buckets — **normalized server-side to sum to exactly 100** via
  `_normalize_time_allocation`, since the model doesn't reliably hit 100 on its own),
  `collaborators[]`, `surprises[]` (explicitly framed as estimates, not real company data).
- **orchestrator** — not a third analysis type, just fans out `job_explainer`/`typical_day`
  concurrently using LangChain's `RunnableParallel` (runs each branch in a thread pool; since every
  branch is a blocking Gemini HTTP call, this cuts wall-clock time to roughly the slowest single
  branch instead of their sum). Used only by the `analyze-all` path; the two single-section
  endpoints call their agents directly and don't go through this. `resume_matcher` used to be a
  third branch here and is now deleted outright.
- **translator** — re-runs `JobExplanation` through the model with a "translate every field into
  {language}" prompt, structured-output-parsed back into the *same* `JobExplanation` shape. Only
  translates the explanation (not typical day / resume match) — that's what was asked for.
- **interview_qna** — `InterviewQnA{questions: [{question, suggested_answer}]}`, prompted
  differently per `round_type` (hr / hiring_manager / technical / other — see `ROUND_FOCUS`
  dict). Explicitly told not to invent resume facts; if the resume is thin on something, the
  suggested answer should honestly hedge rather than fabricate.
- **chat_assistant** — the only agent that does *not* use `.with_structured_output(...)`, and the
  only one **not** on Gemini: it calls `get_openrouter_llm().invoke(prompt)` (NVIDIA Nemotron 3
  Ultra via OpenRouter, see "OpenRouter / Nemotron" below) for the floating chatbot, prompted with
  whatever context
  `chat_service._build_context` can assemble from the passed `job_id`/`resume_id` (JD raw text,
  resume raw text, and any already-generated `job_analyses` columns as JSON) plus the running
  chat history. **Gotcha**: unlike the structured-output agents, `result.content` here is not a
  plain string — this version of `langchain-google-genai` returns a list of content blocks
  (`[{"type": "text", "text": "..."}]`) for plain `invoke()` calls. `chat_assistant._extract_text`
  handles this; forgetting it means `ChatResponse{reply: str}` fails Pydantic validation and every
  chat request 500s with no useful client-side error (surfaces as a bare "Failed to fetch" — the
  browser can't distinguish a crashed response from a network failure). If you add another agent
  that skips structured output, extract text the same way.

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
traceback before assuming it's a CORS or frontend bug - same failure signature we already hit once
with the chat endpoint (see the `chat_assistant` entry above) for a completely different reason
(bad response parsing vs. exhausted billing), so "looks like CORS in the console" is not
diagnostic on its own.

### OpenRouter / Nemotron (chat_assistant only)

`app/agents/_llm.py::get_openrouter_llm(model="nvidia/nemotron-3-ultra-550b-a55b")` is a second,
separate LLM factory alongside `get_llm()` — `ChatOpenAI` pointed at OpenRouter's OpenAI-compatible
endpoint (`base_url="https://openrouter.ai/api/v1"`) rather than a dedicated OpenRouter SDK. Needs
`OPENROUTER_API_KEY` in `backend/.env` (`langchain-openai==1.4.3` added to `requirements.txt` for
this). Used by `chat_assistant`, `resume_enhancer`, and `resume_customizer` (both Resume Builder
agents — see "Resume Builder" below); every other agent (`job_explainer`, `typical_day`,
`interview_qna`, `email_classifier`, `company_snapshot`, `translator`, `resume_parser`,
`resume_importer`) stays on Gemini via `get_llm()` — and `email_classifier` stays there
deliberately, on measured evidence; see "Gmail sync". `.with_structured_output(...)` works fine against
it too (goes through OpenAI-style function calling under the hood) — verified with a real call
before switching `resume_enhancer`/`resume_customizer` over, same "real API call first" discipline
as everything else in this codebase.

**Gotcha 1 — max_tokens**: leaving it unset makes `ChatOpenAI` request this model's full
65536-token output ceiling on *every* call. OpenRouter's low-balance 402 (`"requires more credits,
or fewer max_tokens"`) rejects that outright — even for a two-sentence reply — instead of silently
capping to what the balance affords; hit this immediately in smoke-testing. `get_openrouter_llm`
defaults to `max_tokens=1024`; `resume_customizer.customize_content` passes `max_tokens=4096`
since it rewrites a summary plus one description per work-experience entry in one structured
response. If you add another OpenRouter-backed agent, size this to what it actually returns rather
than copying the default blindly.

**Gotcha 2 — needs a much blunter anti-fabrication prompt than Gemini did**: a polite "never invent
facts: do not add technologies that are not already present" (which is all `resume_matcher`/
`resume_enhancer` ever needed on Gemini) is **not enough for this model**. Against a resume with no
FastAPI/AWS experience and a JD demanding both, Nemotron wrote "5 years building scalable APIs...
**including experience with FastAPI and AWS cloud services**", and in the suggestion path invented
"microservices using **FastAPI on AWS (ECS, Lambda, RDS)**" — naming specific cloud services the
candidate had never touched. For a resume tool that is a serious failure: the user gets interviewed
on whatever the resume claims.

Both `CUSTOMIZE_PROMPT` and `SUGGEST_PROMPT` now open with an explicit, concrete `CRITICAL - do not
invent experience` block that names the failure mode ("if the JD asks for FastAPI and the resume
only shows Flask, keep Flask") rather than stating the rule abstractly. That change alone fixed it
across repeated runs — verified by asserting no forbidden token appears in the output. **Keep that
bluntness if these prompts are edited**; softening it back to the abstract phrasing reintroduces the
fabrication. A residual, subtler risk survives: one run produced "Snowflake-**compatible**
warehouses" for a BigQuery user — technically hedged, still misleading. The "review suggestions"
path is the structural mitigation, since the user reads each change and its reason before accepting.

The `skills` list is the one part that's safe by construction regardless of the prompt — both
`customize_content` and `suggest_edits` filter the model's returned skills against the original
skill set, so an invented skill can never reach the document. `summary`/`work_experience[]
.description` are free text with no equivalent guardrail, so they stay the place to look first if
fabrication resurfaces.

**Gotcha 3 — echoes the prompt's own formatting back into content**: `_flatten_content` feeds each
experience entry to the model as `- {position} at {company} ({dates}): {description}`, and Nemotron
sometimes returns that entire line as the rewritten *description* — which would render the title/
company/dates twice, since the template already draws them from their own fields. Reproduced with a
3-entry resume (a 1-entry resume didn't trigger it). `_strip_echoed_header` removes the prefix, but
only when the leading segment really is that entry's own header, so a legitimate description
containing a colon survives untouched.

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

Modeled on a reference dashboard screenshot (`reference.png` at repo root — a course-platform
UI called "Focotech"): warm cream background (`--color-bg: #f7f3ec`), coral/orange primary
accent (`--color-primary: #ff6b3d`), white rounded cards (`--radius-lg: 20px`), pill-shaped nav
items and buttons, soft shadows. Font is Google Fonts "Plus Jakarta Sans" (loaded via `<link>`
in `index.html`, not self-hosted).

Everything lives in two files:
- `src/index.css` — CSS custom properties (colors, radii, shadows) + base element resets
- `src/styles/components.css` — the actual reusable classes: `.card`, `.btn`/`.btn-primary`/
  `.btn-secondary`/`.btn-ghost`, `.input`, `.field`, `.tabs`/`.tab-button`, `.badge` +
  color variants, `.board`/`.board-column`/`.board-card` (Kanban), `.progress-track`/
  `.progress-fill` (time-allocation bars), `.subcard` + `.tier-hard`/`.tier-learnable`/
  `.tier-bonus` (colored left-border boxes for requirement tiers), `.highlight` (the yellow
  `<mark>` for resume-match edits), `.topbar*` (top nav), `.lang-select*` (language combobox),
  `.chat-fab`/`.chat-panel`/`.chat-message-*` (chatbot),
  `.icon-btn`/`.icon-popover*` (generic icon-button-that-opens-a-panel pattern — Gmail sync and
  "track a new application" on the Applications page, see `IconPopover.tsx` below),
  `.menu-item`/`.menu-item-danger`/`.menu-separator` (compact action menus).

`IconPopover` takes a `variant` prop: `"panel"` (default, the wide form-shaped popover) or
`"menu"`, which adds `.icon-popover-menu` — `width: max-content`, small padding, meant for short
action lists like the resume library's Rename/Duplicate/Delete. Use `.menu-item` rows inside it
(hover background, inline SVG icon, `.menu-item-danger` for destructive actions) rather than the
bare `.link-button`s it used to hold, which rendered as loose text in an oversized card.

There is no component library (no MUI/Chakra/etc.) — just these class names applied directly in
JSX, occasionally mixed with inline `style={}` for one-off layout tweaks. Keep using this
pattern rather than introducing a UI library, unless the user asks for one.

Layout: `App.tsx`'s `AppLayout` renders `<Topbar/>` + `<main className="main-content">` +
`<Chatbot/>` only when a session exists; otherwise it renders children directly (so `Login` isn't
wrapped in the authenticated chrome). Both pages are full-viewport-width — there's no sidebar
eating horizontal space, which is what lets `JobUnderstanding.tsx`'s two-column layout size
itself against the actual viewport (see "Scrollable split layout" below). `Topbar.tsx` has inline
SVG icons (no icon package dependency), same pattern the old `Sidebar.tsx` used.

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

## Chatbot (frontend-only history, backend is stateless)

Floating icon (`Chatbot.tsx`, mounted once in `AppLayout` so it's on every page) toggles a
pop-out panel. Conversation state is a local `useState` array — **nothing is persisted**, no new
DB table, matching the pattern below of keeping ephemeral UI state off the backend. Each send
POSTs the full `history` + new `message` to `POST /chat` along with optional `job_id`/`resume_id`;
the backend does not remember anything between requests itself, it just re-derives context from
those ids every time via `chat_service._build_context` (JD text, resume text, any generated
`job_analyses` columns) — see the `chat_assistant` entry above for the response-parsing gotcha.

`ChatContext.tsx`'s `ChatScopeProvider` (wrapping the whole app in `App.tsx`) is how the chatbot
knows what's "currently open" without prop-drilling: `JobUnderstanding.tsx` calls `setScope({jobId,
resumeId})` in a `useEffect` whenever its resume/job state changes, and `Chatbot.tsx` reads that
same scope when sending. On pages that never call `setScope` (Applications, ApplicationDetail),
the chatbot just sends no ids and the backend answers without job/resume grounding.

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
12. Applications overhaul: Gmail sync rewritten to search-filter before classifying and to write
    directly into a new typed/editable timeline table instead of the old flat notes array; company
    name + position surfaced and editable on every application (previously only derivable from a
    linked JD, so Gmail-created applications were permanently "Unknown job"); Interview Prep
    (rounds + AI Q&A) removed and replaced with an AI-generated "Company Snapshot" panel (see
    "Applications overhaul" below)

## Gmail sync

Built in `app/services/gmail_service.py` + `app/routers/gmail.py` + `app/agents/email_classifier.py`,
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
per-request by `application_service._sign_attachments` the same way `resume_service.
_with_signed_url` signs `file_url`) — every entry has an Edit (reuses the same form component the
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
a "Generate" CTA if empty, "Regenerate" once populated. Interview Prep (rounds list + per-round AI
Q&A grounded in the resume) was **removed, not relocated** — confirmed with the user, no successor
for the Q&A generation. Backend (`models/services/routers/interview*.py`, `agents/interview_qna.py`)
is left in place unused, same precedent as `resume_matcher.py` after the Resume Match tab removal —
`InterviewRounds.tsx` (frontend) was deleted since it's genuinely dead once its only caller is gone.

### Interview questions (right-hand tab, beside Company Snapshot)

`ApplicationDetail.tsx`'s right column is now a **tabbed card**: `Company Snapshot | Interview
Questions`. `CompanySnapshotCard.tsx` was changed to render *bare* (no wrapping `.card`, no own
`<h2>`) since the tab panel supplies both — if you reuse it elsewhere, wrap it yourself.

`InterviewQuestionsCard.tsx` takes a JD in a textarea and offers two buttons, **Generate HR
questions** and **Generate technical questions**, which POST to
`/applications/{id}/interview-questions` with `{round_type, jd_text}`. That calls
`application_service.generate_interview_questions`, which resolves the JD in priority order:
pasted `jd_text` → the application's linked `job_description.raw_text` → a synthesized
`"Role: {position} at {company}"` stub (so a Gmail-created application, which never gets a linked
JD, still works). Resume text is pulled from the linked `resume_id` when there is one, so answers
stay grounded; with no resume the agent honestly hedges rather than inventing history — that
discipline is already in `agents/interview_qna.py`'s prompt, which this **reuses rather than
reimplements** (it was written for the removed Interview Prep panel and only ever needed a caller).

Results cache on `applications.interview_questions`, **keyed by round type** (`{"hr": {...},
"technical": {...}}`) so generating one never clobbers the other and both stay browsable via a
second row of tabs. Same generate/regenerate/jsonb-on-the-row shape as `company_snapshot`.

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

**Backend**: new table `resume_documents` (`id, user_id, name, template_id, content jsonb, style
jsonb, photo_url, created_at, updated_at`), RLS owner-only policy identical in shape to `resumes`/
`job_descriptions`. New bucket `resume-photos` (private, same owner-scoped storage policies as the
`resumes` bucket), path convention `{user_id}/{doc_id}/{uuid}_{filename}`. Models in
`app/models/resume_document.py` (`ResumeContent` = basic_info + summary + work_experience[] +
education[] + skills + certificates[] + section_order + enabled_sections; `ResumeStyle` = accent
color/margin/font family/heading+body size/line height). Service `resume_document_service.py` and
router `resume_documents.py` follow the exact CRUD + `_with_signed_url` pattern from
`resume_service.py`/`resumes.py`. `duplicate_resume_document` deliberately does **not** copy the
photo object — two rows sharing one storage path would break on either row's delete/replace.

**Importing an existing resume**: `ResumeLibrary.tsx` offers an **"↑ Upload Resume"** card beside
"+ New Resume" (a styled `<label>` wrapping a hidden native file input — same pattern as the
Understand a Job page, since a bare `<input type="file">` can't be styled). It POSTs the file to
`POST /resume-documents/import` → `resume_document_service.import_resume_document` →
`agents/resume_importer.py::import_resume`, which creates a fully-populated `resume_documents` row
and navigates straight into the editor. PDF/PNG/JPEG/WEBP, 10MB cap, mirroring `/resumes/upload`.

`resume_importer` is **deliberately a separate agent from `resume_parser`** rather than a reuse of
it: `resume_parser` targets the upload/matching flow's flatter `ResumeParsed` (plus its `raw_text`
transcription), which has no projects/awards/languages/volunteer/certificates — routing the import
through it would silently drop half of what the builder can represent. It is also the one Resume
Builder agent still on **Gemini** (`get_llm()`), because extraction is multimodal and Nemotron is
text-only; see "OpenRouter / Nemotron" above.

Two structural details worth keeping: (1) the LLM-facing schema mirrors `ResumeContent`'s sections
but **omits every per-entry `id`** — ids are structural (the editor keys its forms off them), so
they're generated server-side in `to_resume_content` where the model can't emit duplicates or
collide. (2) Sections the uploaded resume had nothing for are written back **disabled** rather than
enabled-and-empty, so an imported document doesn't open onto a wall of empty headings; the user
re-enables any of them from the section list to fill in by hand.

**AI enhance**: `agents/resume_enhancer.py::enhance_text(text, context)` — same
`.with_structured_output(...)` pattern as `translator.py`, same "never invent facts, only
tighten wording" discipline as `resume_matcher.py`, but runs on `get_openrouter_llm()` (Nemotron)
rather than Gemini — see "OpenRouter / Nemotron" above. Exposed at `POST /resume-documents/enhance-text`
(declared before `/{doc_id}` in the router so FastAPI doesn't swallow the path as a doc id). Used by
the Personal Statement field and each work-experience entry's description (grounded with
`"{position} at {company}"` as context).

**Frontend editor**: `components/resume-builder/` — `SectionList.tsx` (left pane: Basic Info always
first, then `content.section_order` with ▲▼ reorder buttons and enable/disable checkboxes per
section — **checkbox and the expand-toggle span are siblings, not nested inside one `<label>`**;
nesting them once caused clicking the section name to also silently flip the browser's implicit
label→checkbox click-forwarding, disabling the section — keep them as siblings if this is touched
again), one form component per section (`BasicInfoForm`, `SummaryForm`, `WorkExperienceForm`,
`EducationForm`, `SkillsForm`, `CertificatesForm`), `PhotoUpload.tsx` (upload/replace/remove + size
slider/shape toggle/border toggle, no crop tool), `ResumePreview.tsx` (right pane, renders the active
template into `<div id="resume-print-root">`), `StylePanel.tsx` (right-most pane), and
`TemplatePickerModal.tsx`. Two templates live in `templates/` (`ClassicTemplate.tsx` single-column,
`SidebarTemplate.tsx` two-column with a colored rail) sharing presentational blocks from
`templates/blocks.tsx` so only layout CSS differs between them, not the data rendering. Reordering
is plain ▲▼ buttons (array-swap-adjacent), not drag-and-drop — no new frontend dependency was added
for this feature.

Editor state autosaves (no explicit Save button): an 800ms-debounced `updateResumeDocument` PATCH
fires on any change to `name`/`template_id`/`content`/`style`, flushed on unmount; a `loadedRef` skips
the spurious save that would otherwise fire right after the initial load populates state.

**The preview page is a true A4 sheet**: `.resume-page` is `794px × min-height 1123px` — A4 at
96dpi, aspect ratio 1.414. The width was always A4-accurate but the height used to be
content-driven, so a short resume previewed as a stub that looked nothing like the exported page.
`print.css` deliberately resets `min-height` back to `0` for the print media query: keeping the
full-page min-height during printing rounds the content box past the printable area and emits a
trailing blank page, and the paper is already A4 via `@page { size: A4 }` regardless of how far
the content reaches. If you touch either rule, check both a *short* and an *overflowing* resume —
the failure modes are opposite (stub page vs. phantom second page).

**Export is browser print, not a second backend renderer**: `frontend/src/styles/print.css`
(imported once in `main.tsx`) scopes `window.print()` to `#resume-print-root` via the standard
`visibility:hidden` on `body *` / `visibility:visible` on the subtree trick, `@page { margin: 0 }`,
and `transform: none !important` to undo any on-screen fit-to-pane scaling. This means the live
preview *is* the export — a template only needs to be built once as CSS
(`styles/resume-templates.css`). This is now the **only** PDF path in the app; the upload-flow's
reportlab renderer (`pdf_service.py`) was deleted with Resume Match. `break-inside: avoid` on each repeatable entry keeps
single experience/education/certificate blocks from splitting across a page boundary.

**Known verification gaps** (both inherent to automated browser tooling, not app bugs): a native
`<input type="file">` picker can't be driven by the Claude Browser tool — photo upload was verified
by dispatching a synthetic `DataTransfer`/`change` event via `javascript_tool` instead of a real
click-through; `window.print()` opens a native OS dialog that can't be clicked through either — the
print stylesheet/`#resume-print-root` scoping was verified structurally (media-query presence, DOM
content), but the final "Export → Save as PDF → open it" step needs a real manual check.

### v2: more sections, more templates/fonts, JD-based customization

**More sections**: `ResumeContent` (`app/models/resume_document.py`) grew from 5 fixed section
keys to 10 — `projects`, `awards`, `languages`, `volunteer`, `references` joined the original
`summary`/`work_experience`/`education`/`skills`/`certificates` — plus arbitrary **custom
sections** (`content.custom_sections: CustomSection[]`, each addressed in `section_order`/
`enabled_sections` by a synthetic `"custom:{id}"` key rather than a fixed literal, so custom
sections interleave with fixed ones in the same single ordering list). `section_order`/
`enabled_sections` changed type from `list[SectionKey]`/`dict[SectionKey,bool]` to `list[str]`/
`dict[str,bool]` to allow those synthetic keys. **Backward compat for resumes saved before this
change**: their stored `section_order` only has the original 5 keys — `lib/api.ts::
getEffectiveSectionOrder(content)` appends any of the 10 fixed keys missing from the stored order
(defaulting to enabled), used by both `SectionList.tsx` (so the 5 new sections still show up as
toggleable rows on an old resume) and `templates/blocks.tsx::SectionBlocks` (so an old resume's
*rendered* order is backward-compatible too). No DB migration/backfill needed — verified by
hand-inserting an old-shaped row via SQL and confirming all 10 sections appeared in the editor.

**More templates (5 total)**: `ClassicTemplate`/`SidebarTemplate` (original) plus `CompactTemplate`
(tight single-column, no heading underline), `TimelineTemplate` (single-column with a left rail
dot+line on every entry via `.resume-timeline-rail`), `BannerTemplate` (colored header band + a
narrow right rail for skills/languages/certificates). All five are thin layout wrappers around one
shared dispatcher, `templates/blocks.tsx::renderSectionBlock(key, content)` — every template
(including `SidebarTemplate`/`BannerTemplate`, which split sections into two regions) calls this
same function per section key instead of each maintaining its own switch, so a new section type
only ever needs to be taught to render in one place.

**More fonts**: `frontend/index.html`'s Google Fonts link grew from one family (Plus Jakarta Sans)
to a curated set spanning sans/serif/mono (Inter, Roboto, Lato, IBM Plex Sans, Source Sans 3, Space
Grotesk, Merriweather, Playfair Display, Georgia, Arial, JetBrains Mono) — `StylePanel.tsx`'s
`FONT_OPTIONS` mirrors the same list.

**JD-based customization moved here from Job Analysis**: the old Resume Match tab (upload-flow,
exact-substring point-edits against a flat text blob) is gone — see the "Resume-match" section
above. In its place, a **"✨ Customize for a JD"** button at the top of `SectionList.tsx` opens
`JDCustomizeModal.tsx`: paste a JD → `POST /resume-documents/{id}/jd-match`
(`app/agents/resume_customizer.py::evaluate_match`, returns `{match_score, strengths[], gaps[]}`,
no DB write) → then **two ways to apply it**, deliberately offered side by side because they differ
in both blast radius and which document they touch:

1. **"Review suggestions"** (the hint path) → `POST /resume-documents/{id}/jd-suggest`
   (`resume_customizer.suggest_edits`) → a list of `ResumeSuggestion{target, entry_id, entry_label,
   original_text, suggested_text, reason}` rendered one card at a time with its reason, current
   text, and proposed text, each independently **Apply**/**Undo**-able against the **currently open**
   resume. The proposed text sits in an **editable textarea**, not static markup — the model's
   wording is a starting point the user rewrites before (or after) accepting it, which is also the
   practical mitigation for the fabrication risk documented under "OpenRouter / Nemotron". Two
   pieces of state make that work: `drafts` (what's in the textarea) and `appliedText` (what was
   actually written into the document). Keeping them separate is what lets the card distinguish
   *not yet applied* → "Apply this change", *applied and unchanged* → "✓ Applied", and *edited
   again since applying* → "Apply your edit" — collapsing them into one flag would silently let the
   textarea drift out of sync with the resume. "Reset to suggestion" restores the model's original
   wording. Spiritually the successor to the old Resume Match tab's per-edit accept UX, but addressed
   by `entry_id` rather than by exact substring match (structured JSON, not a flat blob) — and by id
   rather than list position specifically so the user can reorder or delete entries while the modal
   is open. Accepted edits flow through `onContentChange` into `ResumeEditor`'s normal 800ms-debounced
   autosave; there is no separate save step and no DB write on the suggest call itself.
   `lib/api.ts::applyResumeSuggestion` is the single pure function that maps a suggestion onto a
   `ResumeContent` (and Undo reuses it with `suggested_text`/`original_text` swapped).
2. **"Build tailored resume"** (the wholesale path, unchanged behaviour) → `POST
   /resume-documents/{id}/jd-customize` (`resume_customizer.customize_content`) → **creates a
   brand-new resume document** (name suffixed `" (JD tailored)"`, same `template_id`/`style`, photo
   not copied — same reasoning as `duplicate_resume_document`) and navigates straight to it; the
   original resume is never modified.

**Gotcha already hit once — `navigate()` does not unmount the editor**: "Build" appeared to hang
forever on "Building..." even though the backend had *already* succeeded and created the tailored
document (the give-away: a stray `... (JD tailored)` row sitting in the library). Navigating to
`/resume-builder/{newId}` only changes the `:documentId` route param, so `ResumeEditor` — and with
it `SectionList`, which owns the modal's open/closed state — **stays mounted**; nothing ever reset
the modal, so it kept rendering its `adopting` spinner over the newly-loaded resume.
`handleBuild` now calls `onClose()` before `navigate()`. Any future "navigate to a sibling route
param" flow in this app needs the same treatment — the component tree is not rebuilt for you.
This is a **new, purpose-built agent**, not a reuse of `resume_matcher.py` — that agent's grounding
model (an `original_text` must be an exact substring of a flat text blob) doesn't map onto
structured JSON, and the desired UX here is a wholesale grounded rewrite of a few known fields, not
a short list of quoted point-edits. `customize_content` asks the LLM to rewrite only `summary.text`,
each `work_experience[].description` (zipped back onto existing entries by index, so ids/company/
dates never change), and to reorder/select from the *existing* skills list (filtered post-hoc to
only skills that were already present — same "can't invent" discipline as `resume_matcher`'s
substring filter, and the one part of this agent's output that's technically guaranteed safe
regardless of what the model does) — never a full-document regeneration. `resume_matcher` and the
`match_suggestions` column it wrote to are both gone entirely now (see "Resume-match (removed
entirely)"), so `orchestrator.run_full_analysis` fans out two branches, not three. Both
`evaluate_match` and `customize_content` run on `get_openrouter_llm()` (Nemotron), not Gemini —
see "OpenRouter / Nemotron" above, including a real fact-invention inconsistency observed in
`customize_content`'s free-text fields (`summary`/`work_experience[].description`, which have no
filter equivalent to the skills-list one) that's worth re-checking if this is touched again.

## Not built yet (known backlog)

- Cover letter generator, ATS compatibility check, resume version history, funnel analytics,
  mock interview practice mode — all flagged as backlog ideas during initial planning, not
  started.
- No automated test suite beyond the health check — see below.

## Testing approach (why there's only one automated test)

This project has been verified almost entirely through **real, manual, end-to-end runs**, not
mocks and not a unit test suite:
- Every agent has been smoke-tested with a real Gemini API call (not a stub) before being wired
  into the API.
- Every feature has been tested through the actual browser (Claude Browser tool) against the
  actual running backend + actual Supabase project: sign up/in a real (temporary) test user via
  Supabase's admin API, drive the real UI, verify the real response, then delete the test user
  and any storage objects it created.
- `backend/tests/test_health.py` is the only pytest test; it exists to prove the app boots and
  the dependency graph imports cleanly, not as a substitute for the above.

If you add a new agent or endpoint, follow the same pattern: real API call first (catches wrong
model names, prompt/schema mismatches, quota issues) before wiring it into routes; real browser
click-through before calling a feature done.

## Dev-only auto-login (remove before shipping)

`frontend/.env` has `VITE_DEV_AUTO_LOGIN=true` plus `VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD` pointing
at a persistent Supabase user (`dev@careerpilot.local`, created via the admin API, not a
throwaway test user). `AuthContext.tsx` checks this flag when `getSession()` comes back empty
and silently signs in as that account instead of showing the Login page — real Supabase
Auth/RLS still runs underneath, only the manual login step is skipped. Set the flag to `false`
(or delete those three lines from `.env`) before shipping or demoing real auth; `.env.example`
already defaults it to `false`.

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
