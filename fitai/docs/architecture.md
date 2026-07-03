# Architecture

This restructures `fitai-complete.zip` (a ~30-file MVP: direct
Express -> Gemini calls, no cache, no fallback, no memory) into the
layered system described in the planning docs.

> **Upgrade 002** (see `docs/upgrade-002.md` for full deliverables) added:
> goal timeframes with a safety clamp, editable plans with preference
> learning, a plan-aware daily checklist that regenerates every 24h and
> adapts to yesterday's outcome, an intelligent progress dashboard backed
> by daily snapshots, weekly/monthly reviews, achievements, categorized/
> importance-ranked memory, and engineering hardening (structured logging,
> env validation, feature flags, graceful shutdown, prompt versioning,
> unit tests). All AI keys — including Gemini — are now optional: the app
> is fully functional on the rules engine and templates alone.

## What's real in this tree vs. scaffolded

**Fully implemented:**
- `shared/calculations` — BMI/BMR/TDEE/calorie-target/progression formulas. Pure functions, no AI.
- `shared/schemas` — Zod schemas every AI response is validated against.
- `shared/prompts` — centralized prompt templates.
- `server/src/services/ai/*` — the orchestrator pipeline: cache -> provider cascade (Gemini -> OpenRouter free tier -> Groq -> Cerebras -> Cloudflare Workers AI, health-monitor reordered, each with internal retry) -> schema validation -> last-known-good cache -> rules engine -> static templates. See `aiOrchestrator.js`. All fallback providers are optional — the cascade simply skips any provider whose API key isn't set in `.env`.
- `server/src/services/memory/*` — four-tier memory (permanent/semi-permanent/temporal/conversational), retrieval, and AI-assisted summarization with a cheap heuristic gate so trivial messages never trigger a Gemini call.
- All routes: onboarding (incl. GET to fetch the saved plan), AI tutor, food image analysis, daily checklist, workout logging + progression, memory timeline.
- `client/src/services`, `contexts/AuthContext`, `hooks/useChecklist`, and every page in the requested tree plus Login/Signup/Onboarding (missing from the original tree, added because the app can't function without them) — wired end-to-end to the backend above.
- `server/migrations/001_memory_and_tracking_layer.sql` — extends the original `supabase/schema.sql` with the new tables this layer needs.

**Scaffolded / explicitly TODO** (marked in-file, not silently stubbed):
- `client/src/pages/Profile`, `pages/Progress` — functional but rough; no real visual design pass (no premium-card treatment, no chart library wired into Progress yet — it renders a plain list).
- Analytics, monitoring, notifications, plan-regeneration-on-life-change — not started. These were already flagged as gaps in the original product audit and aren't touched here.
- No automated tests anywhere in this tree.

## AI reliability pipeline

```
Request -> cache lookup -> provider cascade, health-monitor ordered
  (Gemini -> OpenRouter free models -> Groq -> Cerebras -> Cloudflare
  Workers AI; each provider gets its own retry/timeout, a 429 puts it on
  a 2-minute cooldown so the next request skips straight past it)
  -> Zod validation per provider response
  -> [if every provider fails or is unconfigured] last-known-good cache
  -> rules engine (where the task doesn't need AI at all, e.g. BMR/TDEE)
  -> static templates (e.g. a generic workout plan)
  -> user always gets a usable response, never a blank screen.
```

The response object returned to the frontend never names a provider —
`aiOrchestrator`'s `sanitize()` step collapses `gemini`/`openrouter`/
`groq`/`cerebras`/`cloudflare` down to a generic `source: "ai"`, leaving
only `"cache"` and `"fallback"` as the other possible values. A provider
outage, rate limit, or malformed response is never surfaced to the
client — it's logged server-side and the cascade just moves to the next
provider. `providerHealthMonitor.js` / `providerMetrics.js` track
success rate and latency per provider in memory so a degraded provider
sinks to the back of the cascade instead of being retried first on every
request; `GET`-able health data isn't exposed over HTTP anywhere yet, it's
log/metrics-only.

## Memory tiers

| Tier | Table | Notes |
|---|---|---|
| Permanent | `users_profile` | age, injuries, restrictions — rarely changes |
| Semi-permanent | `user_state` | current program, calorie target |
| Temporal | `daily_checklists` | expires daily, archived by date |
| Conversational | `memory_summaries` | one-line AI-generated summaries, not raw transcripts |

No vector DB — plain SQL is sufficient at this scale, per the original design doc.
