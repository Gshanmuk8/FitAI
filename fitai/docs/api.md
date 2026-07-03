# API Reference (implemented routes only)

All pre-002 routes are unchanged — 002 is purely additive.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /health | no | liveness + DB reachability + uptime |
| POST | /api/onboarding | yes | saves profile (now incl. sex, timeframeWeeks, targetWeightKg), generates plan with diet layer + roadmap |
| GET | /api/onboarding | yes | returns saved profile + plan |
| POST | /api/ai/tutor | yes | { mode, question } -> tutor response, rate-limited; context now includes pace + learned preferences |
| POST | /api/nutrition/analyze | yes | multipart image upload -> food breakdown |
| GET | /api/checklist/today | yes | today's mission, generated from the live plan (workout day / rest day, concrete targets, adaptations); adds `items[]` + `plan_snapshot` |
| PATCH | /api/checklist/today | yes | { field, value } toggle one item (unchanged) |
| GET | /api/checklist/history?days=14 | yes | recent days (days clamped 1–90) |
| POST | /api/workout/log | yes | { exerciseName, weightKg, reps, setNumber, completedAllReps } |
| GET | /api/workout/progression/:exercise?repsMin=&repsMax= | yes | next-weight suggestion, rule-based, no AI |
| GET | /api/workout/history/:exercise | yes | last 10 logged sessions for that exercise |
| GET | /api/memory/summaries?limit=50 | yes | memory timeline; rows now carry `category` + `importance` |
| GET | /api/plan | yes | current plan + planStartedAt + timeframeWeeks |
| PUT | /api/plan | yes | edit workout days and/or diet targets (Zod-validated, bounded); learns exercise preferences from the diff; never resets the goal clock |
| GET | /api/progress | yes | intelligent progress report — computed at most once per 24h (lazy snapshot), invalidated by a new weigh-in |
| POST | /api/progress/weight | yes | { weightKg } — upserts today's weigh-in, invalidates today's snapshot |
| GET | /api/progress/weights?days=90 | yes | raw weigh-in series (days clamped 1–365) |
| GET | /api/reviews?period=weekly\|monthly | yes | last completed period's review, generated on first read (stats deterministic, narrative AI-with-fallback) |
| GET | /api/reviews/history?period=weekly&limit=12 | yes | previously generated reviews |
| GET | /api/achievements | yes | unlocked achievements (deterministic rules) |
| GET | /api/profile | yes | the saved profile row |
| PATCH | /api/profile | yes | partial profile update — never touches the plan or goal clock |
| POST | /api/plan/regenerate | yes | explicit "life changed" action: new plan from current profile, keeps learned preferences, RESTARTS the goal clock; rate-limited |
| POST | /api/nutrition/meals | yes | save a meal (photo-confirmed or manual); hitting the protein target auto-checks today's checklist item |
| GET | /api/nutrition/meals/today | yes | today's diary + totals vs plan targets |
| DELETE | /api/nutrition/meals/:id | yes | remove one of today's meals (history is immutable) |

All routes above are implemented and mounted in `server/src/app.js`.

## GET /api/progress response shape (abridged)

```json
{
  "goal":     { "type": "lose_fat", "startWeightKg": 90, "targetWeightKg": 80, "timeframeWeeks": 16, "targetDate": "2026-10-15" },
  "timeline": { "weeksElapsed": 5.2, "weeksRemaining": 10.8, "percentTimeElapsed": 33 },
  "weight":   { "currentKg": 86.4, "totalChangeKg": -3.6, "logCount": 22, "trend": [{ "date": "...", "weightKg": 88, "avg7": 88.2 }] },
  "expected": { "weightNowKg": 86.8, "weeklyRateKg": -0.45 },
  "actual":   { "weeklyRateKg": -0.52 },
  "pace":     { "status": "ahead", "deltaKg": -0.4, "riskLevel": "low", "projectedWeeksToTarget": 12.3,
                "message": "...", "explanations": [], "recommendations": [] },
  "adherence": { "last7": 0.8, "last28": 0.74, "workoutConsistency": 0.85, "nutritionConsistency": 0.7,
                 "sleepScore": 0.6, "recoveryScore": 0.68 },
  "streaks":  { "current": 4, "best": 11 },
  "progressPercent": 36,
  "roadmap":  [{ "week": 4, "expectedWeightKg": 87.5 }],
  "newAchievements": []
}
```
