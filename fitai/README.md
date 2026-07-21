# FitAI

An AI fitness coach: tell it who you are, your goal, and **by when** — it
builds a personalized workout + diet plan, then coaches you daily with an
adaptive mission, photo food logging, honest pace tracking, long-term
memory, and an AI-authored progress review.

**Works with zero AI keys.** Every AI feature degrades through a provider
cascade (Gemini → OpenAI → Anthropic → OpenRouter → Groq → Cerebras →
Cloudflare) down to a deterministic rules engine and templates — the app
never shows a blank screen because a provider is down or unconfigured.

## Stack

React (Vite) · Express · PostgreSQL (hosted Supabase for auth + data) ·
optional Redis cache. Monorepo: `client/`, `server/`, `shared/` (pure
business math used by both sides).

## Prerequisites

- Node.js ≥ 18 (developed on 24)
- A [Supabase](https://supabase.com) project (free tier is fine)
- Nothing else — AI keys and Redis are optional

## Setup

**1. Install dependencies**

```bash
npm install --workspaces
```

**2. Create the database schema**

Open your Supabase project → SQL Editor → paste the entire contents of
`scripts/supabase-setup.sql` → Run. (Idempotent; safe to re-run. It bundles
`server/migrations/000–011` in order.)

Only needed for a **fresh** database. An existing deploy applies pending
migrations itself: the Docker image runs `scripts/migrate.js` before booting,
and it skips anything already recorded in `schema_migrations`.

**3. Configure environment**

Copy the matching blocks from `.env.example` into two files and fill them in:

- `server/.env` — `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
  (Project Settings → Database / API; **service_role** key)
- `client/.env` — `VITE_API_URL=http://localhost:4000`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (**anon** key — never the
  service key)

AI provider keys are optional; add any subset whenever.

**4. Supabase auth settings** (dashboard → Authentication → URL Configuration)

- Site URL: `http://localhost:5173`
- Optionally disable "Confirm email" for friction-free local development.

**5. Run**

```bash
npm run dev:server   # API on :4000
npm run dev:client   # app on :5173
```

Open http://localhost:5173 → Get started → sign up → onboarding.
Sanity check: http://localhost:4000/health should return
`{"status":"ok","database":"ok",...}`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev:server` / `npm run dev:client` | development servers |
| `npm test` | unit tests: shared calculations + AI platform failure matrix (fake providers) |
| `npm run smoke` | end-to-end product test: boots an embedded Postgres, applies all migrations from scratch, walks the full user journey keyless |
| `npm run build:client` | production frontend build to `client/dist/` |
| `npm start --workspace=server` | production API server |
| `docker compose up` | Redis + server + client (dev-oriented) |

## Deployment

- **Frontend**: `npm run build:client`, serve `client/dist/` from any static
  host. Set the three `VITE_*` vars at build time; point `VITE_API_URL` at
  the deployed API.
- **Backend**: `node server.js` in `server/` (or the provided
  `server/Dockerfile`, built from the repo root: `docker build -f
  server/Dockerfile .`). Set `NODE_ENV=production` — boot then fails fast
  on placeholder config. Set `CORS_ORIGINS` to your frontend URL. The
  server shuts down gracefully on SIGTERM and exposes `/health` (checks DB)
  for load balancers.
- **Database**: run `scripts/supabase-setup.sql` against the production
  project (idempotent).
- **Scaling notes**: rate limiting and AI platform state (breaker, usage
  counters, non-Redis cache) are per-instance; set `REDIS_URL` and move
  those stores to Redis before running multiple instances. Rotate any keys
  that were used during development.

## Architecture

- `docs/architecture.md` — system overview and what's implemented
- `docs/ai-platform.md` — the AI gateway: cascade, retries, circuit
  breaker, budgets, telemetry, and how to add a provider in ~30 lines
- `docs/design-system.md` — the design language
- `docs/api.md` — every HTTP endpoint
- `docs/upgrade-002.md` — feature-by-feature engineering notes

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ERR_CONNECTION_REFUSED` on :5173 | dev servers not running — start both commands above |
| "Failed to fetch" on signup/login | `client/.env` still has placeholder Supabase values, or you edited env files without restarting the dev servers (env is read at startup) |
| `/health` says `"database":"unreachable"` | wrong `DATABASE_URL` (check password and that you copied the URI form) |
| Server exits at boot: "Missing required env var" | `server/.env` missing — copy from `.env.example` |
| Confirmation email lands on a dead page | set Supabase Site URL to `http://localhost:5173` |
| `permission denied for schema auth` in SQL editor | you're running an old migration bundle — use `scripts/supabase-setup.sql` (the auth shim is existence-guarded) |
| Plans look generic / templates | no AI provider key is valid — that's the deterministic fallback working; add a key (Gemini keys start with `AIza`) |
| Smoke test: "shared memory block still in use" | a zombie `postgres.exe` from an interrupted run — kill it and delete `.pgdata-smoke/` |

## Known gaps before production

- Structured logging exists, but no metrics/tracing/aggregation.
- Rate limiting is in-memory (single-instance).
- Push notifications and wearables are unstarted (see roadmap in
  `docs/upgrade-002.md`).
