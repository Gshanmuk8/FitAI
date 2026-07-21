# API Reference

Every route mounted in `server/src/app.js` is listed here, and nothing else is.
If you add a route, add a row.

Auth is a Supabase JWT in `Authorization: Bearer <token>` (`requireAuth`).
All `/api` responses are sent `Cache-Control: private, no-store` and ETags are
disabled — responses are per-user and must never be replayed to another.

Two rate limiters apply:

- `apiLimiter` — every `/api` route (`/health` is registered before it, so
  platform probes can't exhaust the budget).
- `aiLimiter` — the tighter budget, on routes that can trigger a provider call.

`validateBody` rejects malformed bodies with `400` and a field-level message
before the controller runs; the schema named in the table is the one applied
(all live in `server/src/validators/requestSchemas.js`).

## Routes

| Method | Path | Auth | AI limit | Body schema | Notes |
|---|---|---|---|---|---|
| GET | /health | no | no | — | liveness + DB reachability (3s budget) + uptime. `200 ok` / `503 degraded` |
| POST | /api/onboarding | yes | yes | `OnboardingSchema` | saves the profile and generates the plan; starts the goal clock |
| GET | /api/onboarding | yes | no | — | saved profile + plan, or onboarding status |
| POST | /api/ai/tutor | yes | yes | `TutorRequestSchema` | `{ mode, question, history? }` → tutor response. `history` is session-only, max 6 turns, never persisted |
| GET | /api/ai/briefing | yes | yes | — | today's coach briefing; one AI row per user per local day (see shape below) |
| POST | /api/nutrition/analyze | yes | yes | multipart | field `image`, max 8 MB, `image/*` only (`415` otherwise) → food breakdown |
| POST | /api/nutrition/meals | yes | no | `MealSchema` | save a meal → `{ meal, summary }`; syncs today's calorie/protein totals into the checklist (see below) |
| GET | /api/nutrition/meals/today | yes | no | — | `{ meals, summary }` for the user's local day |
| DELETE | /api/nutrition/meals/:id | yes | no | — | `{ status: "deleted", summary }`; only today's meals, history is immutable |
| GET | /api/checklist/today | yes | no | — | today's mission generated from the live plan, plus `items[]`, `plan_snapshot`, `score` |
| GET | /api/checklist/history?days=28 | yes | no | — | recent days; `days` defaults to 28, clamped 1–90 |
| PATCH | /api/checklist/today | yes | no | `ChecklistPatchSchema` | `{ field, value }` — toggle one plan item |
| PATCH | /api/checklist/today/values | yes | no | `ChecklistValuesSchema` | log actual figures (protein, calories, water, sleep, steps, **weight**, notes); any subset, at least one. Entering a value completes its item |
| POST | /api/checklist/today/custom | yes | no | `CustomItemAddSchema` | `{ label }` — add a user-authored mission item (≤120 chars) |
| PATCH | /api/checklist/today/custom/:id | yes | no | `CustomItemPatchSchema` | `{ done }` |
| DELETE | /api/checklist/today/custom/:id | yes | no | — | remove a custom item |
| POST | /api/workout/log | yes | no | `LogSetSchema` | `{ exerciseName, weightKg, reps, setNumber, completedAllReps }` |
| GET | /api/workout/progression/:exercise?repsMin=8&repsMax=12 | yes | no | — | next-weight suggestion, rule-based, no AI |
| GET | /api/workout/history/:exercise | yes | no | — | the last logged session for that exercise |
| GET | /api/workout/today-sets | yes | no | — | `{ [exerciseName]: setCount }` for today, so the UI can resume mid-session |
| GET | /api/memory/summaries?limit=50 | yes | no | — | memory timeline with `category` + `importance`; `limit` defaults to 50, clamped 1–200 |
| GET | /api/plan | yes | no | — | current plan + `planStartedAt` + `timeframeWeeks` |
| PUT | /api/plan | yes | no | `PlanUpdateSchema` | edit workout days and/or diet targets (bounded by `DIET_EDIT_BOUNDS`); learns exercise preferences from the diff; **never** resets the goal clock |
| POST | /api/plan/regenerate | yes | yes | — | explicit "life changed": new plan from the current profile, keeps learned preferences, **restarts** the goal clock |
| GET | /api/profile | yes | no | — | the saved profile row |
| PATCH | /api/profile | yes | no | `ProfileUpdateSchema` | partial profile update — never touches the plan or the goal clock |
| GET | /api/progress | yes | yes | — | the Progress page payload: raw logged data + the AI's analysis (see shape below) |

Unmatched paths return `404 {"error":"Not found"}`.

## The day boundary

Every date-keyed row (`daily_checklists`, `meals`, `workout_logs`,
`daily_briefings`, `progress_analyses`) is stamped with the **user's local
date**, derived from `profile.timezone`, not the server's `CURRENT_DATE`.

That date only ever moves **forward**. A timezone change can move a user's
local date backward — flying east to west — and following it backward would
send the day's writes onto an already-finished day, inflating its totals and
orphaning the real one. The resolved day is therefore ratcheted against the
latest day the user already has on file.

## Meal sync and value provenance

The meal diary keeps `daily_checklists.calories_kcal` / `protein_grams` in
step with the diary total, and re-derives the matching completion booleans.

It will not overwrite a figure the **user typed**. `values_source` records
who last wrote each of those two columns (`"manual"` or `"diary"`); once the
user has entered one through `PATCH /api/checklist/today/values`, the diary
stops writing that column for the rest of that day. The meal `summary`
carries `manualFields: string[]` so the UI can show the diary total beside
the user's own number rather than silently disagreeing with it.

If the sync itself fails the meal is still saved, and the response carries
`syncWarning: string` — the totals may lag until the next read.

## GET /api/progress

`data` is assembled from the user's rows and is **always** present. `analysis`
is written by the AI — the page has no rule engine of its own: every derived
number, stat tile and chart in `analysis` is the coach's own arithmetic over
`data`. At most one analysis per user per local day; a fingerprint of `data`
invalidates it as soon as anything new is logged.

```json
{
  "date": "2026-07-21",
  "fresh": true,
  "data": {
    "asOfDate": "2026-07-21",
    "firstLoggedDate": "2026-05-30",
    "goal": {
      "type": "lose_fat", "startWeightKg": 90, "targetWeightKg": 80,
      "timeframeWeeks": 16, "planStartedAt": "2026-05-30T09:12:00.000Z",
      "weeksElapsed": 7.4, "timeframeComplete": false,
      "dietTargets": { "calorieTarget": 2100, "proteinGrams": 150 },
      "roadmap": [{ "week": 4, "expectedWeightKg": 87.5 }]
    },
    "weighIns":    [{ "date": "2026-07-20", "kg": 86.4 }],
    "checklist":   [{ "date": "2026-07-20", "workout": true, "protein": true,
                      "calories": null, "water": false, "sleep": true, "steps": false }],
    "training":    [{ "date": "2026-07-20", "sets": 18, "exercises": 5, "volumeKg": 7420 }],
    "nutrition":   [{ "date": "2026-07-20", "calories": 2040, "protein": 148, "meals": 3 }],
    "dailyValues": [{ "date": "2026-07-20", "proteinGrams": 148, "caloriesKcal": 2040,
                      "waterMl": 2500, "sleepHours": 7.5, "stepsCount": 8400 }],
    "dailyNotes":  [{ "date": "2026-07-20", "note": "knee felt fine" }],
    "customItems": [{ "date": "2026-07-20", "label": "no sugar", "done": true }]
  },
  "analysis": {
    "headline": "Cutting to 80kg — week 7 of 16",
    "status": "on_track",
    "statusLabel": "On pace",
    "summary": "...", "weightTrend": "...", "trainingAnalysis": "...", "nutritionAnalysis": "...",
    "wins": [], "risks": [], "recommendations": [],
    "stats":  [{ "label": "Sessions (28d)", "value": "14", "detail": null, "tone": "emerald" }],
    "charts": [{ "title": "Weight", "type": "line", "unit": "kg",
                 "points": [{ "label": "07-05", "value": 87.2 }],
                 "targetValue": 80, "note": "..." }]
  }
}
```

Degraded responses — the page renders all three the same way:

| Case | Response |
|---|---|
| provider outage, an older analysis exists | that analysis, plus `"stale": true, "staleDate": "2026-07-19", "fresh": false` — real words about real data beat placeholder text |
| provider outage, user has never had one | `analysis` is the template fallback (`analysis.source === "fallback"`), never persisted |
| no profile | `404 {"error":"No profile found — complete onboarding first."}` |

## GET /api/ai/briefing

Same lazy-per-day + fingerprint + outage behaviour as `/api/progress`.

```json
{
  "date": "2026-07-21",
  "fresh": true,
  "status": "on_track",
  "currentPace": "0.6 kg/week is what the plan asks for",
  "actualPace": "you're averaging 0.5 kg/week over the last three weeks",
  "summary": "...",
  "focus": ["hit 150g protein", "8k steps", "push day: add 2.5kg to bench"]
}
```

A stale briefing carries `"stale": true`. `404` when the user has no profile.
