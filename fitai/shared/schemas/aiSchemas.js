const { z } = require('zod');

// Every schema the AI orchestrator validates output against.
// If Gemini's output doesn't parse against one of these, it gets retried
// or routed to the fallback engine — it never reaches the frontend raw.

// The length caps matter twice over. These schemas validate AI output, but
// WorkoutDaySchema is ALSO what PUT /api/plan validates user input against
// (see server/src/validators/requestSchemas.js) — user input and AI output
// deliberately meet identical bounds. Without a ceiling the only limit was
// the 2 MB JSON body, and the plan is re-read and JSON.parse'd on nearly
// every request, so one oversized plan would permanently tax that account's
// every call and the shared 10-connection pool. Sized well past any real
// exercise name so a legitimate plan never trips them.
// Models write set/rep targets the way coaches do — "8-12", "10", 12.0 —
// but everything downstream (set logging, completed-all-reps, the plan
// editor) does integer arithmetic on a single target. Normalize the
// notation here instead of rejecting an otherwise-personalized plan over
// it: a range collapses to its midpoint, numeric strings parse, floats
// round. Anything else still fails validation.
function coachingInt(v) {
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'string') {
    const range = v.trim().match(/^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i);
    if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
    if (/^\d+$/.test(v.trim())) return Number(v.trim());
  }
  return v;
}

const ExerciseSchema = z.object({
  name: z.string().min(1).max(80),
  sets: z.preprocess(coachingInt, z.number().int().min(1).max(10)),
  reps: z.preprocess(coachingInt, z.number().int().min(1).max(50)),
  restSeconds: z.preprocess(coachingInt, z.number().int().min(0).max(600)).optional(),
  notes: z.string().max(300).optional(),
});

const WorkoutDaySchema = z.object({
  name: z.string().min(1).max(60),
  exercises: z.array(ExerciseSchema).min(1).max(12),
});

const PlanSchema = z.object({
  goal: z.string().max(120),
  days: z.array(WorkoutDaySchema).min(1).max(7),
  notes: z.string().max(2000).optional(),
});

const FoodItemSchema = z.object({
  name: z.string(),
  grams: z.number().positive().max(2000), // sanity ceiling
  calories: z.number().nonnegative().max(3000),
  protein: z.number().nonnegative().max(300),
  carbs: z.number().nonnegative().max(500).optional(),
  fat: z.number().nonnegative().max(300).optional(),
});

const FoodAnalysisSchema = z.object({
  foods: z.array(FoodItemSchema),
  confidence: z.number().min(0).max(1),
});

const TutorResponseSchema = z.object({
  answer: z.string().min(1),
  mode: z.enum(['gym', 'diet', 'recovery']),
  confidence: z.number().min(0).max(1),
  recommendSeeProfessional: z.boolean().default(false),
});

// --- salvage helpers for model-authored display fields -----------------
// A hard max on a model-authored string must degrade to truncation, not
// rejection: a 594-char nutrition paragraph is a good answer 94 chars too
// long, and rejecting the WHOLE analysis over it turns a healthy provider
// into "coach unreachable". min(1) stays strict — empty means broken.
const clipped = (max) => z.preprocess(
  (v) => (typeof v === 'string' && v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v),
  z.string().min(1).max(max)
);
const clippedOpt = (max) => z.preprocess(
  (v) => (typeof v === 'string' && v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v),
  z.string().max(max).optional().nullable()
);
// Arrays of model-authored entries keep what validates and drop the rest
// (capped at maxLen) — one malformed chart or overlong bullet must never
// invalidate an otherwise sound analysis.
const salvagedArray = (entrySchema, maxLen) => z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((e) => entrySchema.safeParse(e).success).slice(0, maxLen) : v),
  z.array(entrySchema).max(maxLen).default([])
);

// The AI's once-per-day progress briefing shown on the dashboard. The coach
// reads the plan + logged history and MEASURES the pace itself (both the
// planned/current pace and the actual measured pace are its words), then
// writes a short narrative — no deterministic math sits on this path.
const BriefingSchema = z.object({
  status: z.enum(['ahead', 'on_track', 'behind', 'no_data']),
  currentPace: clipped(200),                 // the pace the plan expects
  actualPace: clipped(200),                  // the pace the user is actually on
  summary: clipped(800),                     // the daily narrative
  focus: salvagedArray(clipped(200), 3),
});

// The Progress page's analysis: the coach reads the user's whole logged
// journey (weigh-ins, training, nutrition, their own habits) and writes the
// assessment ITSELF — trend, pace, wins, risks, what to change. There is no
// deterministic pace/risk rule engine behind this; the reasoning is the AI's.
//
// The stats and charts are the AI's too: every headline number and every
// plotted series is authored by the coach from the raw logs (implausible
// entries excluded by its own judgment), so a stat tile can never
// contradict the written analysis the way client-side arithmetic could.
const ProgressStatSchema = z.object({
  label: clipped(40),                                // e.g. "Sessions (28d)"
  value: clipped(24),                                // e.g. "2" / "1.2t" / "57%"
  detail: clippedOpt(140),                           // e.g. "excludes 1 implausible entry"
  // An off-palette tone ("green") degrades to neutral instead of costing
  // the whole stat tile.
  tone: z.preprocess(
    (v) => (['emerald', 'amber', 'red', 'cyan', 'neutral'].includes(v) ? v : 'neutral'),
    z.enum(['emerald', 'amber', 'red', 'cyan', 'neutral'])
  ),
});

const ProgressChartPointSchema = z.object({
  label: clipped(20),                                // short x label, e.g. "07-05" or "wk 2"
  value: z.number(),
});

// min(2) points stays a hard rule per chart — a one-point "trend" is not a
// chart. salvagedArray() below turns that from "reject the whole analysis"
// (what a week-1 account with a single weigh-in used to hit every time)
// into "drop that chart, keep the rest".
const ProgressChartSchema = z.object({
  title: clipped(80),
  type: z.enum(['line', 'bar']),
  unit: clippedOpt(20),                              // e.g. "kg", "kcal", "g", "%"
  points: z.preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, 40) : v),
    z.array(ProgressChartPointSchema).min(2).max(40)
  ),
  targetValue: z.number().optional().nullable(),     // dashed rule when a target applies
  note: clippedOpt(300),                             // one-line read of the chart
});

const ProgressAnalysisSchema = z.object({
  // The page's title line and status chip are the coach's words too — the
  // frontend has no goal-formatting or week math of its own. Optional so a
  // stored pre-v6 analysis (served stale during an outage) still validates.
  headline: clippedOpt(120),                         // e.g. "Cutting to 78kg — week 3 of 12"
  status: z.enum(['ahead', 'on_track', 'behind', 'no_data']),
  statusLabel: clippedOpt(40),                       // e.g. "Ahead of pace"
  summary: clipped(1000),                            // the journey so far, plainly
  weightTrend: clipped(500),                         // what the scale data actually shows
  trainingAnalysis: clipped(500),                    // consistency, volume, patterns
  nutritionAnalysis: clipped(500),                   // logging habits, protein/calorie reality
  wins: salvagedArray(clipped(200), 5),
  risks: salvagedArray(clipped(200), 5),
  recommendations: salvagedArray(clipped(250), 5),
  stats: salvagedArray(ProgressStatSchema, 6),
  charts: salvagedArray(ProgressChartSchema, 3),
});

// One-line durable memory extracted from a chat exchange.
const MemorySummarySchema = z.object({
  summary: z.string().min(1).max(300),
  category: z.enum(['injury', 'preference', 'constraint', 'progress', 'schedule', 'behavior', 'conversation']).default('conversation'),
  importance: z.number().int().min(1).max(3).default(1),
});

module.exports = {
  ExerciseSchema,
  WorkoutDaySchema,
  PlanSchema,
  FoodItemSchema,
  FoodAnalysisSchema,
  TutorResponseSchema,
  BriefingSchema,
  ProgressAnalysisSchema,
  MemorySummarySchema,
};
