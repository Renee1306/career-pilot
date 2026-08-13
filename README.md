# CareerPilot

An AI career copilot that covers the whole job hunt loop: decode a job description, tailor a
resume against it, track every application, and prep for the interview — grounded in your actual
resume, not invented experience.

**Live backend**: https://career-pilot-q180.onrender.com (free tier — the first request after
15 minutes idle takes ~30-60s to wake up)

## What it does

- **Job Analysis** — paste a job description and get a plain-language summary, the three real
  responsibilities, and requirements split into hard/learnable/bonus tiers, each backed by a
  quote from the posting. A "typical day" tab estimates how the hours actually break down.
  Translate either into another language on demand.
- **Resume Builder** — a structured, from-scratch resume editor: five templates, a curated font
  set, photo upload, AI-assisted enhancement, and print-perfect A4 export. Import an existing
  resume (PDF/image) to auto-populate it, or paste a job description and review suggested edits
  one at a time — nothing changes until you accept it.
- **Application tracker** — a drag-and-drop Kanban board (Applied / Interview / Offer / Rejected)
  with a typed, editable timeline per application (interviews, case studies, deadlines,
  attachments). Connect Gmail and the board files updates from your inbox automatically.
- **Interview prep** — HR and technical question sets generated from the job description and your
  resume, plus an AI-generated company snapshot (culture, values, likely interview themes).
- **Dashboard** — pipeline stats, recent activity, and quick actions, with a dismissible
  first-time-user guide.
- **Auth** — email/password or Google/GitHub OAuth via Supabase Auth; every backend request is
  scoped to the caller's own JWT, so Postgres RLS enforces per-user data isolation end to end.

## Tech stack

| | |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, react-router-dom, `@supabase/supabase-js`. No UI framework — a small hand-rolled design system. |
| **Backend** | Python, FastAPI, LangChain, Gemini (`gemini-flash-lite-latest`) for structured extraction, NVIDIA Nemotron via OpenRouter for the chatbot/resume-rewrite agents. |
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

### Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate      # Windows; use ./.venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY at minimum
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
| `GEMINI_API_KEY` | Yes | Structured extraction agents (resume parsing, job analysis, interview Q&A) |
| `OPENROUTER_API_KEY` | For chatbot & resume AI-enhance | NVIDIA Nemotron via OpenRouter |
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

`backend/tests/test_health.py` is the only automated test — it exists to prove the app boots and
the dependency graph imports cleanly. Everything else has been verified through real, manual
end-to-end runs against the actual API and a real Supabase project rather than mocks; see
`PROJECT_CONTEXT.md` for why.
