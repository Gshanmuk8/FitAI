const { z } = require('zod');

// Every schema the AI orchestrator validates output against.
// If Gemini's output doesn't parse against one of these, it gets retried
// or routed to the fallback engine — it never reaches the frontend raw.

const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(50),
  restSeconds: z.number().int().min(0).max(600).optional(),
  notes: z.string().optional(),
});

const WorkoutDaySchema = z.object({
  name: z.string().min(1),
  exercises: z.array(ExerciseSchema).min(1),
});

const PlanSchema = z.object({
  goal: z.string(),
  days: z.array(WorkoutDaySchema).min(1).max(7),
  notes: z.string().optional(),
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

// The AI's once-per-day progress briefing shown on the dashboard. The coach
// reads the plan + logged history and MEASURES the pace itself (both the
// planned/current pace and the actual measured pace are its words), then
// writes a short narrative — no deterministic math sits on this path.
const BriefingSchema = z.object({
  status: z.enum(['ahead', 'on_track', 'behind', 'no_data']),
  currentPace: z.string().min(1).max(200),   // the pace the plan expects
  actualPace: z.string().min(1).max(200),    // the pace the user is actually on
  summary: z.string().min(1).max(800),       // the daily narrative
  focus: z.array(z.string().min(1).max(200)).max(3).default([]),
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
  label: z.string().min(1).max(40),                  // e.g. "Sessions (28d)"
  value: z.string().min(1).max(24),                  // e.g. "2" / "1.2t" / "57%"
  detail: z.string().max(140).optional().nullable(), // e.g. "excludes 1 implausible entry"
  tone: z.enum(['emerald', 'amber', 'red', 'cyan', 'neutral']).default('neutral'),
});

const ProgressChartPointSchema = z.object({
  label: z.string().min(1).max(20),                  // short x label, e.g. "07-05" or "wk 2"
  value: z.number(),
});

const ProgressChartSchema = z.object({
  title: z.string().min(1).max(80),
  type: z.enum(['line', 'bar']),
  unit: z.string().max(20).optional().nullable(),    // e.g. "kg", "kcal", "g", "%"
  points: z.array(ProgressChartPointSchema).min(2).max(40),
  targetValue: z.number().optional().nullable(),     // dashed rule when a target applies
  note: z.string().max(300).optional().nullable(),   // one-line read of the chart
});

const ProgressAnalysisSchema = z.object({
  status: z.enum(['ahead', 'on_track', 'behind', 'no_data']),
  summary: z.string().min(1).max(1000),              // the journey so far, plainly
  weightTrend: z.string().min(1).max(500),           // what the scale data actually shows
  trainingAnalysis: z.string().min(1).max(500),      // consistency, volume, patterns
  nutritionAnalysis: z.string().min(1).max(500),     // logging habits, protein/calorie reality
  wins: z.array(z.string().min(1).max(200)).max(5).default([]),
  risks: z.array(z.string().min(1).max(200)).max(5).default([]),
  recommendations: z.array(z.string().min(1).max(250)).max(5).default([]),
  stats: z.array(ProgressStatSchema).max(6).default([]),
  charts: z.array(ProgressChartSchema).max(3).default([]),
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
