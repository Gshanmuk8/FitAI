# FitAI — Hardening & Completion Plan

Work through phases in order. Each item has: **What / Where / How / Done when**.
Phases 1–2 make it secure and stable. Phase 3 makes it fully functional per the vision. Phase 4 keeps it that way.

---

## Phase 0 — Baseline (half a day)

**0.1 Pin real model names.**
- Where: `server/src/services/ai/platform/platformConfig.js`
- Problem: defaults `openai: 'gpt-5'`, `anthropic: 'claude-sonnet-5'` are speculative. If keys are set without model overrides, every call 400s (permanent failure; breaker routes around it silently — you lose quality without ever seeing an error).
- How: set defaults to models you have verified against each provider's live API; add a startup log line printing the resolved provider→model map.
- Done when: setting only `OPENAI_API_KEY` produces successful calls in `providerMetrics` logs.

**0.2 Environment audit.**
- Where: `server/src/config/env.js`, `config/db.js`
- Fix the hardcoded `SUPABASE_POOLER_REGION` default (`ap-northeast-1`) — require it explicitly or derive from `SUPABASE_URL`. Wrong region silently degrades DB connectivity.
- Add a boot-time check that logs (never throws) which of the 7 AI providers are configured, whether Redis cache is active, and which feature flags are on.
- Done when: a fresh clone with a minimal `.env` boots with a clear one-screen summary of its own configuration.

**0.3 Run the existing suite and freeze it green.**
- `npm test` from root (paceTracking, schedule, adaptivePlanner, aiPlatform matrix, db-scoping-guard). Everything below must keep this green.

---

## Phase 1 — Security hardening (1–2 days)

The posture is already strong (RLS deny-all, parameterized SQL, prompt sanitization, per-user cache keys, provider-identity collapse). These close the remaining gaps.

**1.1 Make `queryAs` scoping structural, not string-based.**
- Where: `server/src/db/userAccess.js`
- Problem: it only checks the SQL *string contains* `user_id`. A query mentioning `user_id` in a comment or unrelated column passes; the server connection bypasses RLS as owner.
- How (pick one, in order of strength):
  1. Best: run app queries as a non-owner Postgres role and use `SET LOCAL role` + `SET LOCAL request.jwt.claims` per transaction so RLS applies to the server too. Then RLS is the real boundary, not convention.
  2. Minimum: replace the substring check with a rule that every query must be built through a small query-builder helper that *injects* `WHERE user_id = $n` itself, so scoping can't be forgotten. Keep `db-scoping-guard.test.js` enforcing that nothing else touches the pool.
- Done when: a deliberately unscoped test query (`SELECT * FROM meals -- user_id`) fails in a new unit test.

**1.2 TLS to Postgres.**
- Where: `server/src/config/db.js`
- Problem: `ssl: { rejectUnauthorized: false }` disables cert validation (MITM-able in principle).
- How: download the Supabase CA cert, ship it, and set `ssl: { ca, rejectUnauthorized: true }`; keep the loose mode behind an explicit `DB_SSL_INSECURE=true` escape hatch for local dev.
- Done when: production boots with cert validation on.

**1.3 HTTP-layer headers and limits.**
- Where: `server/src/app.js`
- Add `helmet` (CSP can be report-only initially since the API serves no HTML), explicit CORS allowlist from env (never `*` with credentials), and `express.json({ limit: '1mb' })` globally with a larger limit *only* on `/api/nutrition/analyze` (image payloads). Reject oversized bodies before they reach controllers.
- Done when: responses carry security headers; a 10 MB POST to `/api/ai/tutor` is rejected with 413.

**1.4 Log hygiene.**
- Where: `server/src/utils/logger.js` and every `logger.*` call site
- Ensure no user free-text (tutor questions, notes, meal descriptions), no JWTs, and no AI prompt bodies are logged at info level in production. Log IDs and lengths, not content. Redact `Authorization` in any request logging.
- Done when: grep of a production log sample shows no PII/user content.

**1.5 Vision upload validation.**
- Where: `server/src/controllers/nutritionController.js`
- Validate magic bytes (JPEG/PNG/WebP), cap dimensions/size before base64-ing to providers, strip EXIF (location data in food photos is PII). Reject anything else with 415.
- Done when: a renamed `.txt` file and a 40 MP image are both rejected cleanly.

**1.6 Rate-limit and abuse rails on AI spend.**
- Where: `server/src/app.js` limiter config + `platform/usageTracker.js`
- You have per-user limits on AI routes and global budgets. Add: per-user *daily token budget* (not just global), so one abusive account degrades to fallback alone instead of draining the shared budget for everyone.
- Done when: a loop of 500 tutor calls from one test user degrades only that user to `source: 'fallback'`.

**1.7 Dependency + secret hygiene (recurring).**
- `npm audit` in CI failing on high/critical; secret scanning (gitleaks) in CI; confirm `.env` is gitignored and rotate any key that has ever been committed.

---

## Phase 2 — Bug fixes & drift removal (1–2 days)

**2.1 Backfill `plan_started_at`.**
- Where: `briefingService`, `progressAnalysisService`, new migration `009`
- Problem: `weeksElapsed` falls back to `updated_at`, so editing your profile can shift the perceived plan start.
- How: migration backfills `plan_started_at` from the earliest `daily_checklists` row per user (or `created_at`), then remove the `updated_at` fallback entirely.
- Done when: editing profile does not change the briefing's "week N" output.

**2.2 Resolve the `--gold` CSS variable.**
- Where: `client/src` styles + `Progress.jsx`
- Either define `--gold` in the root palette and add it to `docs/design-system.md` with a single meaning, or replace with the documented `--amber`. Charts must never reference an undefined variable.

**2.3 Decide the orphaned tables (migration 002).**
- `body_weight_logs`, `progress_snapshots` → **keep**: Phase 3.1 uses them.
- `reviews` → **keep**: Phase 3.2 uses it.
- `achievements` → drop in migration `009` unless you commit to Phase 3.4; dead RLS-locked schema misleads contributors.

**2.4 Sync the docs to reality.**
- `docs/api.md`: remove `/api/reviews`, `/api/progress/weight[s]` (don't exist); add `GET /api/ai/briefing`, `PATCH /api/checklist/today/values`, checklist custom-item CRUD, `GET /api/workout/today-sets`; rewrite the `GET /api/progress` response shape to the actual `{data, analysis}` contract.
- `docs/ai-platform.md` / `architecture.md`: provider list must include openai + anthropic adapters.
- `docs/upgrade-002.md`: mark as historical ("superseded — see architecture.md") rather than editing it into lies of omission.
- Done when: every documented endpoint exists and every mounted route is documented (write a small test that diffs the Express route table against a JSON manifest — this keeps it true forever).

**2.5 Fix meal↔checklist sync failure visibility.**
- Where: `services/nutrition/mealDiaryService.js`
- Sync failure currently only logs. Return a `syncWarning` field to the client so the UI can show "meal saved, totals may lag" instead of silently diverging.

---

## Phase 3 — Fully functional per the vision (1–2 weeks)

**3.1 Deterministic floor under Progress (highest priority).**
- Where: new `shared/calculations/progressStats.js`, `services/progress/`, `Progress.jsx`
- Compute in code, always, no AI: current vs expected weight (`paceTracking.expectedWeightAt`), pace status (ahead/on/behind with thresholds), adherence % (checklist completion over trailing 14/30d), streaks (current + best), training volume trend from `workout_logs`, weight series with a 7-day rolling mean.
- Persist a nightly row per user into the existing `progress_snapshots` table (idempotent upsert per date); write weigh-ins from `checklist/today/values` through to `body_weight_logs` as the canonical series.
- `GET /api/progress` returns `{ stats: <deterministic, always present>, analysis: <AI, nullable> }`. The page must be fully useful with `analysis: null`.
- Done when: with zero AI providers configured, Progress shows pace, adherence, streaks, and charts.

**3.2 Weekly review.**
- Where: new `services/review/reviewService.js`, `GET /api/reviews/latest`, `reviews` table, card on Dashboard
- Deterministic weekly rollup (workouts done/planned, protein-hit days, weight delta vs expected, best streak) generated lazily on first request after Sunday (same lazy-generation pattern as `daily_briefings` — no cron needed) + one AI paragraph through the orchestrator with a template fallback.
- Done when: every user sees a review card each week, AI or not.

**3.3 Disengagement detection.**
- Where: `shared/calculations/engagement.js` (pure), consumed by `briefingService` and `adaptivePlanner`
- Rule-based score from logging gaps and missed workouts (e.g. no checklist writes for 2+ days = "at risk"). At-risk state switches the briefing prompt to a re-entry tone and makes the adaptive planner serve a deliberately light "restart day" instead of the scheduled session.
- Done when: unit tests cover the state transitions; a seeded at-risk user gets the restart briefing.

**3.4 (Optional) Achievements** — only if you kept the table: deterministic rules (first workout, 7-day streak, 5 kg milestone) evaluated on checklist/workout writes, surfaced in `Memory.jsx` timeline as `system` entries. Otherwise drop it (2.3).

**3.5 "Rescue my day" nutrition action** — the differentiator.
- Where: `Nutrition.jsx` button + `POST /api/nutrition/rescue` + orchestrator task
- Input: remaining macros (already computed), dietary restrictions, time-of-day. Output: 2–3 concrete meal suggestions fitting the remainder. Deterministic fallback: portion-math suggestions from the existing food constants so it works keyless.
- Done when: after logging a huge lunch, the rescue endpoint returns dinner options within remaining calories/protein for both AI and fallback paths.

---

## Phase 4 — Verification & operations (ongoing)

**4.1 Integration tests over real Postgres.**
- Docker `postgres:16` in CI, run all migrations, then test the highest-risk flows: meal add/delete ↔ checklist totals (both directions), plan edit → today's mission propagation, checklist values → completion derivation, timezone rollover (the day boundary bug class), RLS deny-all via a Supabase-anon-role connection.
- These flows are your most regression-prone logic and are currently only unit-tested.

**4.2 Route-contract test** (from 2.4) + **provider smoke test** (hit each configured provider with a 1-token ping on deploy, log to health monitor).

**4.3 Shared state before scaling past one instance.**
- Breaker, health, usage budgets, cache, and in-flight dedup are all in-memory per instance. Before running 2+ nodes: move cache + usage budgets to Redis (correctness), leave breaker/health per-instance (acceptable). Until then, pin to one instance.

**4.4 Ops floor:** uptime check on `/health`, error alerting (Sentry or logs), daily DB backups verified restorable, and a weekly glance at `providerMetrics` output to catch silent provider degradation (the 0.1 failure mode).

---

## Suggested order of execution

| Week | Items |
|---|---|
| 1 | 0.1–0.3, 1.1–1.3, 2.1–2.3 |
| 2 | 1.4–1.7, 2.4–2.5, 3.1 |
| 3 | 3.2, 3.3, 4.1 |
| 4 | 3.5, 4.2–4.4, optionally 3.4 |

After Phase 2 the app is secure and honest. After 3.1 + 3.2 it delivers the documented vision. 3.3 + 3.5 are what make it retain users.
