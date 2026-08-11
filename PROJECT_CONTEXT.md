# CareerPilot — Project Context

This file exists so a new agent (or a human) can pick up this project cold. It describes what
has been built, how it's structured, and what decisions were made and why. Update it whenever
you complete a phase or change something a future reader would need to know.

## What this is

An AI career copilot with two halves:

1. **Understand a job & tailor a resume** — upload a resume + paste a job description, get a
   plain-language job explanation, a "typical day" preview, and a resume-match analysis with
   inline, applyable edit suggestions, then export the tailored resume to PDF.
2. **Track applications & prep for interviews** — a Kanban board of applications, a timeline of
   notes per application, and AI-generated interview Q&A (grounded in the actual resume) per
   interview round.

Not yet built: Gmail sync/auto-classification of applications (deferred — see "Not built yet"
below).

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
│   │   │   ├── resume.py         ResumeParsed (agent output), ResumeCreate/Out, ResumeExportRequest
│   │   │   ├── job.py            JobExplanation/TypicalDay/ResumeMatch (agent outputs), JobDescription*, JobAnalysisOut
│   │   │   ├── application.py    ApplicationCreate/Update/Out, TimelineEntryCreate
│   │   │   └── interview.py      InterviewRound*, QnAItem, InterviewQnA
│   │   ├── routers/               FastAPI route handlers — thin, delegate to services
│   │   │   ├── resumes.py, jobs.py, applications.py, interviews.py
│   │   ├── services/               business logic + Supabase queries
│   │   │   ├── resume_service.py, job_service.py, application_service.py, interview_service.py, pdf_service.py
│   │   └── agents/                 LangChain + Gemini calls, one file per AI task
│   │       ├── _llm.py             get_llm() — the ONE place the model name is set
│   │       ├── resume_parser.py    multimodal: PDF/image → ResumeParsed
│   │       ├── job_explainer.py    JD text → JobExplanation (5-section format, see below)
│   │       ├── typical_day.py      JD text → TypicalDay (5-section format, see below)
│   │       ├── resume_matcher.py   JD + resume text → ResumeMatch (span-based edits)
│   │       ├── translator.py       re-runs job_explainer's output through the model in another language
│   │       └── interview_qna.py    JD + resume + round_type → InterviewQnA
│   ├── tests/test_health.py       only automated test that exists (health check). Everything
│   │                               else has been verified by real, manual E2E runs — see "Testing approach".
│   ├── requirements.txt
│   └── .env.example                SUPABASE_URL/ANON_KEY (safe, public), SUPABASE_SERVICE_ROLE_KEY
│                                    and GEMINI_API_KEY (secrets — user fills in backend/.env, gitignored)
└── frontend/
    ├── src/
    │   ├── main.tsx, App.tsx        AppLayout wraps authenticated routes in the sidebar; unauthenticated → Login
    │   ├── context/AuthContext.tsx  session state via supabase.auth.onAuthStateChange
    │   ├── components/
    │   │   ├── Sidebar.tsx, ProtectedRoute.tsx
    │   │   ├── JobExplanationTab.tsx, TypicalDayTab.tsx, ResumeMatchTab.tsx   (the 3 analysis tabs)
    │   │   └── InterviewRounds.tsx   (list/add rounds + generate Q&A, used inside ApplicationDetail)
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── JobUnderstanding.tsx  upload resume + paste JD, hosts the 3 tabs
    │   │   ├── Applications.tsx      Kanban board + "track a new application" form
    │   │   └── ApplicationDetail.tsx  status, position, timeline, interview prep
    │   ├── lib/
    │   │   ├── supabaseClient.ts
    │   │   └── api.ts                ALL backend calls + all shared TS types live here
    │   ├── index.css                 design tokens (CSS custom properties) + base reset
    │   └── styles/components.css     the design system: .card, .btn*, .input, .tabs, .badge*, .board*, etc.
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
  `explanation` / `typical_day` / `match_suggestions` / `translations` (jsonb) get filled in
  independently as each tab is generated — see "Analysis lifecycle" below
- `applications` — status enum (`applied`/`pending_interview`/`offer`/`rejected`), timeline
  (jsonb array of `{date, note}`), links to job_description_id + resume_id
- `interview_rounds` — round_type, scheduled_at, link, notes, generated_qna (jsonb)
- `gmail_sync_state` — table exists (schema-stable for later), nothing reads/writes it yet

Storage: private `resumes` bucket, RLS policies scoped by `(storage.foldername(name))[1] =
auth.uid()::text` (i.e. objects live at `{user_id}/{uuid}_{filename}`). Reads go through a
signed URL generated on demand (`resume_service._with_signed_url`), 1 hour expiry.

### Analysis lifecycle (job_analyses)

`job_service._get_or_create_analysis` fetches the existing row for `(user_id, job_id)` or
creates an empty one. Each `generate_*` function then `UPDATE`s just its own column by row id.
This means: visiting the Job Explanation tab, then the Typical Day tab, then Resume Match tab
all accumulate onto the *same* analysis row rather than creating three separate rows or
clobbering each other. `GET /jobs/{id}/analysis` returns that single row (or null).

## AI agents — what each one does and how it's prompted

All agents use `app/agents/_llm.py::get_llm()`, currently `gemini-flash-lite-latest`. **Do not
casually swap this** — see "Gemini model/quota gotcha" below.

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
- **resume_matcher** — produces `ResumeMatch{match_score, matched_skills[], missing_skills[],
  edits[], summary}`. Each `edit` is `{original_text, suggested_text, reason}` where
  `original_text` must be an **exact substring of the resume's raw text** — the agent function
  filters out any edit where `original_text not in resume_text` before returning, because the
  frontend does literal `text.indexOf()` to render yellow highlights and needs exact matches.
  If you change the resume text format fed into this agent, re-verify this still holds.
- **translator** — re-runs `JobExplanation` through the model with a "translate every field into
  {language}" prompt, structured-output-parsed back into the *same* `JobExplanation` shape. Only
  translates the explanation (not typical day / resume match) — that's what was asked for.
- **interview_qna** — `InterviewQnA{questions: [{question, suggested_answer}]}`, prompted
  differently per `round_type` (hr / hiring_manager / technical / other — see `ROUND_FOCUS`
  dict). Explicitly told not to invent resume facts; if the resume is thin on something, the
  suggested answer should honestly hedge rather than fabricate.

### Gemini model/quota gotcha (read before changing `_llm.py`)

`gemini-flash-latest` currently resolves to a newer model with a **20-requests/day free-tier
cap**, which was hit mid-development. Switched to `gemini-flash-lite-latest`, which has a much
more generous free quota and has worked fine for everything built so far. If you hit
`RESOURCE_EXHAUSTED` again, check `google.genai.Client(...).models.list()` for what's currently
available to this API key before picking a replacement — model aliases and their tiers/quotas
have moved multiple times already during this project.

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
  `<mark>` for resume-match edits).

There is no component library (no MUI/Chakra/etc.) — just these class names applied directly in
JSX, occasionally mixed with inline `style={}` for one-off layout tweaks. Keep using this
pattern rather than introducing a UI library, unless the user asks for one.

Layout: `App.tsx`'s `AppLayout` renders `<Sidebar/>` + `<main className="main-content">` only
when a session exists; otherwise it renders children directly (so `Login` isn't wrapped in the
authenticated chrome). `Sidebar.tsx` has inline SVG icons (no icon package dependency).

## Resume-match "apply and export" flow (frontend-only state, not persisted)

`ResumeMatchTab.tsx` keeps a local `tailoredText` state seeded from the selected resume's
`parsed_text`. Clicking a yellow highlight opens a panel (Original/Suggestion/Reason); "Apply"
does `tailoredText.replace(edit.original_text, edit.suggested_text)` and marks that edit's index
as applied (so it stops being highlighted — matching is redone against the *current* tailoredText
on every render via `buildSegments`). None of this is persisted to the backend — "Export to PDF"
sends the current `tailoredText` straight to `POST /resumes/export-pdf` (reportlab, pure Python,
chosen specifically over WeasyPrint to avoid its native Cairo/Pango dependency on Windows) and
downloads the result. If a future phase wants tailored-resume history, that needs a new column/
table — nothing today saves intermediate tailoring state.

## What's built (phases, roughly in order)

0. Scaffold — Supabase project + schema, FastAPI skeleton, Vite/React skeleton, `.claude/launch.json` dev-server configs
1. Resume upload + Gemini parsing, JD paste/save, minimal Supabase Auth UI (login/signup)
2. Job Explanation / Typical Day / Resume Match tabs (first version, later rewritten — see phase below)
3. Resume-match rewritten to span-based edits; highlight-click-apply UX; PDF export
4. Application tracker: Kanban board, application detail, timeline notes
5. Job Explanation + Typical Day rewritten to the exact 5-section specs the user provided;
   full frontend redesign to match `reference.png`; interview prep (Q&A generation + rounds UI)

## Not built yet (known backlog)

- **Gmail sync** — deferred by design (see earlier planning discussion); `gmail_sync_state`
  table exists but nothing uses it. Would need Google OAuth (separate from Supabase Auth),
  Gmail API polling/History API, and a classifier agent to map emails → application status
  changes.
- Cover letter generator, ATS compatibility check, resume version history, ~~ funnel analytics,
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
- Git line-ending warnings (`LF will be replaced by CRLF`) on every commit are expected on this
  Windows checkout with no `.gitattributes` — harmless, not a bug.
