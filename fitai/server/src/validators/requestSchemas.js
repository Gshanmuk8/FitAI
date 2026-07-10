const { z } = require('zod');
const { GOALS, ACTIVITY_LEVELS, TUTOR_MODES } = require('../../../shared/constants');
const { WorkoutDaySchema } = require('../../../shared/schemas/aiSchemas');
const { DIET_EDIT_BOUNDS } = require('../../../shared/calculations/dietTargets');

const OnboardingSchema = z.object({
  age: z.number().int().min(13).max(100),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  targetWeightKg: z.number().min(30).max(300).optional(),
  goal: z.enum(GOALS),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  injuries: z.string().max(500, 'keep injuries under 500 characters').optional().default(''),
  dietaryRestrictions: z.string().max(500, 'keep dietary restrictions under 500 characters').optional().default(''),
  equipment: z.enum(['gym', 'home', 'minimal']).optional().default('gym'),
  gymAvailability: z.string().optional(),
  // How many days a week the user can actually train — their number, not a
  // heuristic's. The AI builds the split to exactly this frequency.
  trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  // Free text: "yoga and powerlifting", "calisthenics, some cardio" — the
  // plan is designed around whatever the user writes here.
  trainingStyle: z.string().max(500, 'keep training style under 500 characters').optional().default(''),
  sex: z.enum(['male', 'female', 'other']).optional().default('other'),
  // How fast the user wants to get there. Out-of-range values are accepted
  // here and clamped by paceTracking.resolveTimeframeWeeks with an
  // explanation — onboarding must never dead-end on ambition.
  timeframeWeeks: z.number().int().min(1).max(200).optional(),
  // IANA timezone from the browser (e.g. "Asia/Kolkata") — daily rollover
  // happens at the user's midnight. Invalid names degrade to server date.
  timezone: z.string().max(64).regex(/^[A-Za-z0-9_+/-]+$/).optional(),
});

// User edits to the live plan. Workout days reuse the same schema the AI's
// output is validated against — user input and AI output meet identical
// bounds. Diet overrides are range-checked against DIET_EDIT_BOUNDS.
const dietField = (key) => z.number().min(DIET_EDIT_BOUNDS[key].min).max(DIET_EDIT_BOUNDS[key].max);
const PlanUpdateSchema = z
  .object({
    days: z.array(WorkoutDaySchema).min(1).max(7).optional(),
    diet: z
      .object({
        calorieTarget: dietField('calorieTarget').optional(),
        proteinGrams: dietField('proteinGrams').optional(),
        waterMl: dietField('waterMl').optional(),
        stepsTarget: dietField('stepsTarget').optional(),
        sleepHours: dietField('sleepHours').optional(),
      })
      .optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((body) => body.days || body.diet || body.notes !== undefined, {
    message: 'Provide days, diet, or notes to update.',
  });

// Profile edits: any subset of the onboarding fields, at least one.
const ProfileUpdateSchema = OnboardingSchema.partial().refine(
  (body) => Object.values(body).some((v) => v !== undefined),
  { message: 'Provide at least one field to update.' }
);

// A meal saved to the diary — either confirmed from a photo analysis or
// typed manually. Bounds mirror FoodItemSchema's sanity ceilings.
const MealSchema = z.object({
  name: z.string().min(1).max(120),
  grams: z.number().positive().max(2000).optional(),
  calories: z.number().int().min(0).max(5000),
  protein: z.number().min(0).max(300).optional().default(0),
  carbs: z.number().min(0).max(500).optional(),
  fat: z.number().min(0).max(300).optional(),
  source: z.enum(['photo', 'manual']).optional().default('manual'),
});

const TutorRequestSchema = z.object({
  mode: z.enum(TUTOR_MODES),
  question: z.string().min(1).max(1000),
  // The current session's recent exchanges, so follow-ups ("what about
  // squats?") keep their context. Session-only — never persisted; durable
  // facts still flow through the memory summarizer.
  history: z
    .array(z.object({ role: z.enum(['user', 'coach']), text: z.string().min(1).max(600) }))
    .max(6)
    .optional()
    .default([]),
});

const ChecklistPatchSchema = z.object({
  field: z.enum(['workout_completed', 'protein_completed', 'water_completed', 'sleep_completed', 'steps_completed']),
  value: z.boolean(),
});

// Manual "Today's Mission" value entry — any subset, at least one. Bounds are
// sanity ceilings; entering a value auto-completes its checklist item.
const ChecklistValuesSchema = z.object({
  protein_grams: z.number().min(0).max(1000).optional(),
  water_ml: z.number().int().min(0).max(20000).optional(),
  sleep_hours: z.number().min(0).max(24).optional(),
  steps_count: z.number().int().min(0).max(100000).optional(),
  weight_kg: z.number().min(30).max(300).optional(),
  notes: z.string().max(1000).optional(),
}).refine((body) => Object.values(body).some((v) => v !== undefined), {
  message: 'Provide at least one value to log.',
});

// User-authored mission items — free text, capped at a label length that
// still renders as one checklist row.
const CustomItemAddSchema = z.object({
  label: z.string().trim().min(1, 'Write what you want to do.').max(120, 'Keep it under 120 characters.'),
});
const CustomItemPatchSchema = z.object({
  done: z.boolean(),
});

const LogSetSchema = z.object({
  exerciseName: z.string().min(1).max(120),
  weightKg: z.number().min(0).max(500),
  reps: z.number().int().min(0).max(100),
  setNumber: z.number().int().min(1).max(20),
  completedAllReps: z.boolean(),
});

module.exports = {
  OnboardingSchema,
  TutorRequestSchema,
  ChecklistPatchSchema,
  LogSetSchema,
  ChecklistValuesSchema,
  CustomItemAddSchema,
  CustomItemPatchSchema,
  PlanUpdateSchema,
  MealSchema,
  ProfileUpdateSchema,
};
