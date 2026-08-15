# CareerPilot — frontend

React 19 + TypeScript + Vite. See the [repo root README](../README.md) for what this app does,
full setup instructions, and environment variables.

## Quick start

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the Vite dev server on `:5173` |
| `npm run build` | Type-check (`tsc -b`) then production-build to `dist/` |
| `npm run preview` | Serve the production build locally |

No UI framework — see `src/styles/components.css` for the design system.
