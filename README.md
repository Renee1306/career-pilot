# CareerPilot

An AI career copilot that covers the whole job hunt loop: decode a job description, tailor a
resume against it, track every application, and prep for the interview — grounded in your actual
resume, not invented experience.

**Live demo**: https://career-pilot-my.pages.dev/

**Live backend**: https://career-pilot-q180.onrender.com (free tier — the first request after
15 minutes idle takes ~30-60s to wake up, which the demo above will hit on its first load too)

## What it does

- **Job Analysis** — paste a job description and get a plain-language summary, the three real
  responsibilities, and requirements split into hard/learnable/bonus tiers, each backed by a
  quote from the posting. A "typical day" tab estimates how the hours actually break down.
  Translate either into another language on demand.
- **Resume Builder** — a structured, from-scratch resume editor: five templates, a curated font
  set, photo upload, AI-assisted enhancement, and print-perfect A4 export. Import an existing
  resume (PDF/image) to auto-populate it, or paste a job description and review suggested edits
  one at a time — nothing changes until you accept it. Generate a cover letter tailored to the
  job description and grounded in the resume's actual content, and export it as a formatted Word
  document.
- **Application tracker** — a drag-and-drop Kanban board (Applied / Interview / Offer / Rejected)
  with a typed, editable timeline per application (interviews, case studies, deadlines,
  attachments). Connect Gmail and the board files updates from your inbox automatically.
- **Interview prep** — behavioural and hiring-manager question sets generated from the job
  description and your resume (each question comes with what a strong answer should cover, not a
  scripted answer), plus an AI-generated company snapshot (what the company does, industry, scale,
  culture, and core values) to orient you before interviews.
- **Dashboard** — pipeline stats, recent activity, and quick actions.
- **Auth** — email/password or Google/GitHub OAuth via Supabase Auth; every backend request is
  scoped to the caller's own JWT, so Postgres RLS enforces per-user data isolation end to end.

## Tech stack

| | |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, react-router-dom, `@supabase/supabase-js`. No UI framework — a small hand-rolled design system. |
| **Backend** | Python, FastAPI, LangChain. Two interchangeable structured-output providers: Gemini (`gemini-3.1-flash-lite`) for interview prep, resume import, company snapshots, and translation; Alibaba DashScope serving DeepSeek (`deepseek-v4-flash-0731`, stepping up to `deepseek-v4-pro-0813` for the resume JD-coach) for JD analysis, summaries, cover letters, and email classification. `python-docx` renders the cover letter export. |
| **Data** | Supabase (Postgres + Auth + Storage), Row Level Security on every table. |
| **Deployment** | Render (backend), Cloudflare Pages (frontend). |

## Project structure

```
career-pilot/
├── backend/            FastAPI app
│   ├── app/
│   │   ├── routers/        thin HTTP handlers
│   │   ├── services/       business logic + Supabase queries
│   │   ├── agents/         one LangChain agent per AI task
│   │   └── models/         Pydantic request/response schemas
│   └── requirements.txt
└── frontend/           React + Vite app
    └── src/
        ├── pages/           routed pages (Landing, Dashboard, Job Analysis, Applications, Resume Builder...)
        ├── components/      shared and feature components
        ├── context/         auth session + chatbot scope
        └── lib/             API client, Supabase client, shared types
```

See [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) for the full architecture writeup — data model,
agent prompts, auth model, and the reasoning behind non-obvious decisions.

## Getting started

### Prerequisites

- Node.js 20+
- Python 3.12
- A [Supabase](https://supabase.com) project (Postgres + Auth + Storage)
- A [Google AI Studio](https://ai.studio) API key (Gemini)
- An [Alibaba Model Studio](https://modelstudio.console.alibabacloud.com) (DashScope) API key

### Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate      # Windows; use ./.venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY, ALIBABA_API_KEY at minimum
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
```

The app is now running at `http://localhost:5173`, talking to the API at `http://localhost:8000`.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Yes | Supabase project connection |
| `SUPABASE_SERVICE_ROLE_KEY` | For Gmail sync | Bypasses RLS only for the OAuth callback, which has no user JWT yet |
| `GEMINI_API_KEY` | Yes | Interview Q&A, resume import, and translation agents |
| `ALIBABA_API_KEY` | Yes | DashScope (DeepSeek) — job analysis, resume JD-coach, resume summaries, company snapshot, email classification |
| `CORS_ORIGINS` | Yes | Comma-separated list of allowed frontend origins |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | For Gmail sync | Google Cloud OAuth client |
| `FRONTEND_URL` | For Gmail sync | Where to redirect after the OAuth callback |
| `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT` | No | Optional free LangSmith tracing |

### Frontend (`frontend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Yes | Supabase client (safe to expose — protected by RLS, not secrecy) |
| `VITE_API_BASE_URL` | Yes | Backend base URL |
| `VITE_DEV_AUTO_LOGIN`, `VITE_DEV_EMAIL`, `VITE_DEV_PASSWORD` | No | Dev-only: skip the login screen locally. Must be `false` in any deployed build. |

## Deployment

**Backend → Render**: connect the repo, set root directory to `backend`, build command
`pip install -r backend/requirements.txt`, start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend`. Pin `PYTHON_VERSION=3.12.7`
as an env var — Render otherwise defaults to whatever its latest Python image is, which may not
have prebuilt wheels for every pinned dependency. Set the backend env vars above as service env
vars.

**Frontend → Cloudflare Pages**: connect the repo via Cloudflare's GitHub integration, root
directory `frontend`, build command `npm run build`, output directory `dist`. Set the frontend
env vars above as build-time environment variables (Vite bakes them into the static bundle, so
they must be set before the build runs). `frontend/public/_redirects` already handles SPA
routing so client-side routes survive a hard refresh.

After both are live, update the backend's `CORS_ORIGINS` and `FRONTEND_URL` to the deployed
frontend URL — Gmail sync and any cross-origin request will fail against a `localhost` value.

## Testing

**Backend**: `cd backend && pytest` runs the suite in `backend/tests/` — unit tests for pure logic
(bullet-splitting and per-bullet hint addressing in the JD coach, Gmail timezone handling, the
legacy skills-schema migration, typical-day helpers), router tests for jobs/applications/resume
endpoints (mocked at the service boundary), an auth-middleware test, and a health check. The
agents' own LLM calls (`jd_coach.review`, `gap_turn`, and the rest) are deliberately left out of
this suite and verified through real end-to-end runs against the actual API and a live Supabase
project instead — see `PROJECT_CONTEXT.md` for why.

**Frontend**: no automated tests yet.
