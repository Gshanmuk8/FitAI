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
const ProgressAnalysisSchema = z.object({
  status: z.enum(['ahead', 'on_track', 'behind', 'no_data']),
  summary: z.string().min(1).max(1000),              // the journey so far, plainly
  weightTrend: z.string().min(1).max(500),           // what the scale data actually shows
  trainingAnalysis: z.string().min(1).max(500),      // consistency, volume, patterns
  nutritionAnalysis: z.string().min(1).max(500),     // logging habits, protein/calorie reality
  wins: z.array(z.string().min(1).max(200)).max(5).default([]),
  risks: z.array(z.string().min(1).max(200)).max(5).default([]),
  recommendations: z.array(z.string().min(1).max(250)).max(5).default([]),
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
