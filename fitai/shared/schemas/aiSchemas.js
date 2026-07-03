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

// Weekly/monthly review narrative. The stats themselves are computed
// deterministically server-side — the AI only writes the coaching words,
// so a hallucinated number can never appear in a review.
const ReviewNarrativeSchema = z.object({
  headline: z.string().min(1).max(200),
  wins: z.array(z.string()).max(5),
  focusNext: z.array(z.string()).max(5),
  recommendation: z.string().min(1),
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
  ReviewNarrativeSchema,
  MemorySummarySchema,
};
