# Upgrade 002 — Engineering Deliverables

Per-feature breakdown of the 002 upgrade: architecture, schema, API, UI,
migration, testing, compatibility, performance, extensibility. Everything
here is **additive and backwards compatible** — no endpoint was removed or
renamed, and every pre-002 request/response shape still works.

The one deliberate behavior change: `GEMINI_API_KEY` is no longer required
at boot. All five provider keys are optional; the cascade skips
unconfigured providers and the app runs entirely on the rules engine and
static templates with zero keys. (Previously a missing Gemini key crashed
the server at startup — a hard dependency the architecture doc's own
fallback design said shouldn't exist.)

---

## 1. Goal timeline (onboarding timeframe)

- **Architecture.** Onboarding now collects sex, target weight, equipment,
  dietary restrictions, and `timeframeWeeks`. The timeframe passes through
  `shared/calculations/paceTracking.resolveTimeframeWeeks`, which clamps to
  [4, 104] weeks and extends any request that would exceed a safe weekly
  rate (1.0 kg/wk loss, 0.5 kg/wk gain) — returning `{ weeks, adjusted,
  reason }` instead of rejecting, so onboarding can't dead-end. The plan
  object gains `timeframe` and a `roadmap` of 4-week expected-weight
  checkpoints (pure interpolation).
- **Schema.** `users_profile` + `sex`, `timeframe_weeks`, `plan_started_at`.
- **API.** `POST /api/onboarding` accepts the new optional fields.
- **UI.** Onboarding form gains the fields; an adjusted timeframe is
  surfaced to the user with the reason.
- **Testing.** Unit tests cover safe/unsafe/default/bounds cases.
- **Compatibility.** All new fields optional; old clients keep working.

## 2. Editable plans + preference learning

- **Architecture.** `GET/PUT /api/plan` (new `planController` +
  `planEditingService`). User edits are validated against the *same* Zod
  `WorkoutDaySchema` the AI's output must satisfy; diet overrides are
  bounded by `DIET_EDIT_BOUNDS` (e.g. calories 1200–6000) so an edit can't
  produce an unsafe plan. Edits set `customized: true` and never reset
  `plan_started_at` (`savePlan(..., { restartClock: false })`).
  The exercise-name diff feeds `user_exercise_preferences`: removals bump
  toward `disliked`, additions toward `favorite`; flipping sentiment resets
  the counter. Plan generation prompts name strength≥2 dislikes as
  "avoid". A behavior memory row records each meaningful edit.
- **Schema.** New `user_exercise_preferences (user_id, exercise_name,
  sentiment, strength)`.
- **UI.** New `/plan` editor page (days, exercises, diet targets).
- **Performance.** Diff is in-memory sets; learning runs fire-and-forget.

## 3. Daily planner (plan-aware checklist, 24h regeneration, adaptive)

- **Architecture.** `checklistService.getTodayEnriched` builds a
  `plan_snapshot` on the first request of each day: today's workout day
  from `shared/calculations/schedule.js` (plan days distributed
  Bresenham-style across a Monday-first week, rest days between), diet
  targets from the live plan (so user edits show up next morning), and
  adaptations from `shared/calculations/adaptivePlanner.js`:
  missed workout + rest day today → catch-up swap; poor sleep or high
  soreness → reduced intensity; perfect day → progression nudge.
  Deterministic and explainable — no AI on this path. Insert is
  `ON CONFLICT DO NOTHING` + re-select, so concurrent first requests are
  race-safe. Regeneration is lazy (first GET after midnight), which works
  on serverless deploys with no cron.
- **Schema.** `daily_checklists` + `plan_snapshot jsonb`.
- **API.** `GET /api/checklist/today` adds `items[]` (concrete labels) and
  `plan_snapshot`; the five boolean columns and PATCH are unchanged.
- **Compatibility.** Pre-002 rows have `plan_snapshot = null`; both server
  and client fall back to generic labels.

## 4. Intelligent progress dashboard (24h snapshot)

- **Architecture.** `progressService` composes pure functions from
  `paceTracking.js` over profile + weigh-ins + 28d checklist history +
  workout logs: expected-vs-actual weight (linear plan line, ±0.75kg
  tolerance), observed kg/week (min 5-day span so water weight can't fake
  a trend), pace status (ahead/on_track/behind; adherence-graded for
  maintain/endurance goals), risk level, deterministic explanations and
  recommendations when behind, projected weeks-to-target, adherence and
  consistency scores, streaks. Persisted once per day in
  `progress_snapshots` (lazy, race-safe); `POST /api/progress/weight`
  deletes today's row so new data recomputes immediately. Side effects run
  only on the computing request: achievement evaluation and a pace-change
  memory (e.g. "pace changed from on_track to behind") that the tutor
  sees in later chats.
- **Schema.** New `body_weight_logs` (unique user/date, upsert) and
  `progress_snapshots` (unique user/date).
- **UI.** Progress page rebuilt: pace card with explanations, stat grid,
  weigh-in form, recharts weight trend + 7-day average + target line,
  weekly review, achievements, 28-day consistency heat strip. Dashboard
  gains a compact progress card. Recharts is code-split (`React.lazy`).

## 5. Weekly / monthly reviews

- **Architecture.** `reviewService` generates lazily for the last
  *completed* Mon–Sun week or calendar month: stats are computed
  deterministically (adherence, workouts, sets, volume, weight change),
  then the AI cascade writes a narrative around them
  (`generateReviewNarrative`, schema-validated) with a deterministic
  fallback narrative when no provider is configured. Persisted immutably
  in `reviews` (unique user/period). Empty periods get a stub instead of
  an AI call about nothing.
- **API.** `GET /api/reviews?period=weekly|monthly`, `GET /api/reviews/history`.

## 6. Achievements

- **Architecture.** `shared/calculations/achievements.js` is a pure
  evaluator (workout-day counts, streaks, weigh-in counts, goal-progress
  fractions). Awarding is idempotent via `unique(user_id, code)` +
  `ON CONFLICT DO NOTHING`, evaluated during the daily snapshot compute.
  New unlocks write a progress memory.
- **API/UI.** `GET /api/achievements`; badges on the Progress page.

## 7. Long-term memory depth

- **Architecture.** `memory_summaries` rows gain `category`
  (injury/preference/constraint/progress/schedule/behavior/conversation)
  and `importance` (1–3). The AI summarizer prompt asks for both and its
  output is schema-validated (`MemorySummarySchema`). `memoryWriter.
  recordSystemMemory` is the no-AI write path used by plan edits, pace
  changes, and achievement unlocks. Retrieval orders importance-first, so
  an old injury note outlives recent chit-chat; `promptBuilder.
  enforceBudget` (which already understood scored summaries) now actually
  receives them and trims lowest-importance first. The tutor context block
  gains calorie target, current program, pace status, and learned exercise
  preferences. `user_state` (semi-permanent tier) is now written on every
  plan generation/edit — it existed but nothing populated it before.
- **Compatibility.** Legacy plain-string summaries still format correctly.

## 8. Engineering hardening

- Structured JSON logger (`utils/logger.js`), request-id aware.
- `env.js`: placeholder-aware validation; fails fast in production,
  warn-and-boot keyless in development; startup logs which providers are live.
- Feature flags (`config/featureFlags.js`), all default ON:
  `FEATURE_REVIEWS`, `FEATURE_ACHIEVEMENTS`, `FEATURE_ADAPTIVE_PLANNER`,
  `FEATURE_PREFERENCE_LEARNING`, `FEATURE_PROGRESS_SNAPSHOTS`.
- Graceful shutdown in `server.js` (SIGTERM/SIGINT → close server → drain
  pool → 10s force-exit backstop).
- `/health` now pings Postgres with a 1s budget and reports uptime.
- Prompt versioning (`PROMPT_VERSION`) + `sanitizeUserText` prompt-injection
  mitigation on all user-derived prompt inputs.
- Query-param clamping on history endpoints; all new bodies Zod-validated.
- Unit tests (`npm test`, node:test, zero new deps) for every pure module.
- Client: missing `index.html` / `vite.config.js` added (the client was
  previously unbuildable); dev-server proxy for `/api`; Progress page
  code-split.

## Migration steps

```
psql $DATABASE_URL -f server/migrations/001_memory_and_tracking_layer.sql   # if not already applied
psql $DATABASE_URL -f server/migrations/002_plans_pace_and_memory_depth.sql
```

002 is idempotent (IF NOT EXISTS everywhere) and additive-only; it can run
against a live 001 database with zero downtime. Pre-migration code keeps
running against a post-migration schema and vice versa (new code tolerates
missing 002 tables in read paths that feed the tutor).

## Testing strategy

- Pure business rules (pace, schedule, diet targets, adaptation,
  achievements) live in `shared/calculations` with node:test coverage —
  29 tests, `npm test`.
- Service/controller layers stay thin over models; integration tests
  against a disposable Postgres are the natural next step (not included —
  no CI/DB harness exists in this repo yet).
- Verified end-to-end: full server module graph loads with zero API keys;
  client production build passes.

## Deferred (roadmap, with intended extension points)

| Feature | Extension point |
|---|---|
| Push/smart notifications | checklist snapshot + progress snapshot already contain everything a notifier needs; add a delivery worker |
| Wearables (Apple Health / Google Fit) | write into `body_weight_logs` / `daily_checklists` via new import endpoints |
| Exercise intelligence (muscles, videos, alternatives) | add an `exercises` reference table; plan days already reference exercises by name |
| Meal-level nutrition (micronutrients, budget, shopping list) | extend `FoodAnalysisSchema`; nutrition route unchanged |
| Social/challenges/leaderboard, coach accounts, subscriptions | all per-user tables key on `auth.users(id)`; add org/role tables + RBAC middleware |
| Background job scheduler | reviews/snapshots are lazy-on-read today; a cron worker can call the same service functions unchanged |
