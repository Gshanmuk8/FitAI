/**
 * The coach must never contradict the arithmetic, and must never ignore
 * what the user told it. Every case here is a bug that was actually
 * reported: a deficit plan described as a surplus, and a split that didn't
 * match the days the user said they could train.
 *
 * These are pure-function tests — no DB, no provider — because the failures
 * were all in prompt construction and plan assembly, which are pure.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { buildDietTargets } = require('../../shared/calculations/dietTargets');
const { buildPlanGenerationPrompt } = require('../../shared/prompts/templates');
const { formatProfileForPrompt } = require('../src/services/memory/contextBuilder');

// A large, very active man on a cut: TDEE lands near 3,200, so his deficit
// target is ~2,700 — a number big enough that a user reads it as "surplus"
// unless the maintenance figure is shown beside it. This is the exact
// profile shape behind the report.
const CUTTER = {
  weightKg: 95, heightCm: 185, age: 30, sex: 'male',
  activityLevel: 'very_active', goal: 'lose_fat',
};
const BULKER = { ...CUTTER, goal: 'build_muscle' };

test('a fat-loss goal always produces a deficit against maintenance', () => {
  const d = buildDietTargets(CUTTER);
  assert.ok(d.calorieTarget < d.maintenanceCalories,
    `target ${d.calorieTarget} must be below maintenance ${d.maintenanceCalories}`);
  assert.equal(d.calorieDirection, 'deficit');
  assert.ok(d.calorieDelta < 0, 'delta is signed negative on a cut');
});

test('a muscle-building goal always produces a surplus', () => {
  const d = buildDietTargets(BULKER);
  assert.ok(d.calorieTarget > d.maintenanceCalories);
  assert.equal(d.calorieDirection, 'surplus');
  assert.ok(d.calorieDelta > 0);
});

test('maintenance goals sit at maintenance', () => {
  const d = buildDietTargets({ ...CUTTER, goal: 'maintain' });
  assert.equal(d.calorieDirection, 'maintenance');
  assert.equal(d.calorieDelta, 0);
});

// The 1200 kcal floor must not silently turn a cut into a surplus for a
// very small profile — it should clamp, and the direction must stay honest.
test('the safety floor never flips a cut into a reported surplus', () => {
  const tiny = { weightKg: 42, heightCm: 150, age: 19, sex: 'female', activityLevel: 'sedentary', goal: 'lose_fat' };
  const d = buildDietTargets(tiny);
  assert.ok(d.calorieTarget >= 1200, 'floored for safety');
  // If the floor lifted the target above maintenance, the label must say so
  // rather than claiming a deficit that is not being run.
  if (d.calorieTarget > d.maintenanceCalories) {
    assert.equal(d.calorieDirection, 'surplus',
      'a floored target above maintenance must not be labelled a deficit');
  } else {
    assert.equal(d.calorieDirection, 'deficit');
  }
});

// ---- the prompt is where the contradiction actually reached the user ----

test('the plan prompt states the calorie target, maintenance and direction', () => {
  const diet = buildDietTargets(CUTTER);
  const prompt = buildPlanGenerationPrompt({ ...CUTTER, diet, trainingDaysPerWeek: 3 });

  assert.match(prompt, new RegExp(String(diet.calorieTarget)), 'target must be in the prompt');
  assert.match(prompt, new RegExp(String(diet.maintenanceCalories)), 'maintenance must be in the prompt');
  assert.match(prompt, /DEFICIT/, 'the direction must be stated unambiguously');
  assert.match(prompt, /never tell a user in a deficit to eat in a surplus/i);
});

test('a cut prompt never instructs the model to bulk', () => {
  const prompt = buildPlanGenerationPrompt({ ...CUTTER, diet: buildDietTargets(CUTTER), trainingDaysPerWeek: 4 });
  assert.doesNotMatch(prompt, /this is a SURPLUS/i);
  assert.match(prompt, /Do NOT describe this as a bulk, a surplus/i);
});

test('the plan prompt demands exactly the days the user committed to', () => {
  const prompt = buildPlanGenerationPrompt({ ...CUTTER, diet: buildDietTargets(CUTTER), trainingDaysPerWeek: 3 });
  assert.match(prompt, /EXACTLY 3 object\(s\)/);
  assert.match(prompt, /Not 4, not 2/, 'the boundary is spelled out, not implied');
});

test('training style reaches the prompt verbatim rather than being summarised away', () => {
  const prompt = buildPlanGenerationPrompt({
    ...CUTTER, diet: buildDietTargets(CUTTER), trainingDaysPerWeek: 3,
    trainingStyle: 'yoga and powerlifting, no machines',
  });
  assert.match(prompt, /yoga and powerlifting, no machines/);
  assert.match(prompt, /Do not default to a generic bodybuilding split/i);
});

// ---- the coach context: the columns that were silently missing ----

const memoryFor = (overrides = {}) => ({
  permanent: {
    age: 30, sex: 'male', height_cm: 185, weight_kg: 95, target_weight_kg: 85,
    activity_level: 'very_active', goal: 'lose_fat', injuries: '',
    training_days_per_week: 3, training_style: 'powerlifting', ai_plan: null,
    ...overrides,
  },
  semiPermanent: { current_phase: 'build_muscle', calorie_target: 3500 },
  temporal: null,
  exercisePreferences: { disliked: [], favorite: [] },
  todayBriefing: null,
});

test("the coach's goal comes from the profile, not the stale plan-time snapshot", () => {
  // The user switched to lose_fat from the Profile page, which deliberately
  // does not regenerate the plan — so user_state.current_phase still says
  // build_muscle. The coach must follow the user, not the stale row.
  const { profile } = formatProfileForPrompt(memoryFor());
  assert.equal(profile.goal, 'lose_fat');
});

test('the coach receives training days and style (both were always undefined)', () => {
  const { profile } = formatProfileForPrompt(memoryFor());
  assert.equal(profile.trainingDaysPerWeek, 3);
  assert.equal(profile.trainingStyle, 'powerlifting');
});

test('the coach receives the deterministic nutrition figures', () => {
  const { profile } = formatProfileForPrompt(memoryFor());
  assert.ok(profile.diet, 'a complete profile must yield a diet block');
  assert.equal(profile.diet.calorieDirection, 'deficit');
  assert.ok(profile.diet.maintenanceCalories > profile.diet.calorieTarget);
});

test('the quoted calorie target is the live one, not the stale user_state copy', () => {
  const { profile, contextBlock } = formatProfileForPrompt(memoryFor());
  assert.doesNotMatch(contextBlock, /3500/, 'the stale plan-time figure must not be quoted');
  assert.match(contextBlock, new RegExp(String(profile.diet.calorieTarget)));
});

test('an incomplete legacy profile degrades to no figures rather than wrong ones', () => {
  const { profile } = formatProfileForPrompt(memoryFor({ activity_level: null, weight_kg: null }));
  assert.equal(profile.diet, undefined, 'no diet block beats a fabricated one');
});

// ---- the day count is a commitment, and is now repaired server-side ----

const { enforceDayCount } = require('../../shared/calculations/planShape');

const planWith = (n) => ({
  goal: 'lose fat',
  days: Array.from({ length: n }, (_, i) => ({
    name: ['Push', 'Pull', 'Legs'][i % 3],
    exercises: [{ name: 'Bench Press', sets: 3, reps: 8 }],
  })),
});

test('a plan with too many days is trimmed to what the user committed to', () => {
  const out = enforceDayCount(planWith(5), { trainingDaysPerWeek: 3 });
  assert.equal(out.days.length, 3);
  assert.deepEqual(out.days.map((d) => d.name), ['Push', 'Pull', 'Legs'],
    'the first N are kept — they are ordered hardest-first');
});

test('a plan with too few days is filled out, with repeats numbered', () => {
  const out = enforceDayCount(planWith(2), { trainingDaysPerWeek: 4 });
  assert.equal(out.days.length, 4);
  assert.deepEqual(out.days.map((d) => d.name), ['Push', 'Pull', 'Push 2', 'Pull 2'],
    'a repeated day is numbered so it does not read as a duplication bug');
});

test('a correct plan is returned untouched', () => {
  const plan = planWith(3);
  assert.strictEqual(enforceDayCount(plan, { trainingDaysPerWeek: 3 }), plan,
    'no commitment broken, no object churn');
});

test('no stated commitment means the AI\'s own choice stands', () => {
  const plan = planWith(5);
  assert.strictEqual(enforceDayCount(plan, {}), plan);
});

test('a malformed plan is passed through rather than crashing generation', () => {
  assert.doesNotThrow(() => enforceDayCount({ days: null }, { trainingDaysPerWeek: 3 }));
  assert.doesNotThrow(() => enforceDayCount(null, { trainingDaysPerWeek: 3 }));
});

test('every filled day keeps real exercises', () => {
  const out = enforceDayCount(planWith(1), { trainingDaysPerWeek: 3 });
  assert.equal(out.days.length, 3);
  assert.ok(out.days.every((d) => d.exercises?.length > 0), 'no empty day may ship');
});

// ---- an edited target must never keep the old label ----

const { withCalorieContext } = require('../../shared/calculations/dietTargets');

test('raising an edited target above maintenance flips deficit -> surplus', () => {
  const base = buildDietTargets(CUTTER);          // deficit
  const edited = withCalorieContext({ ...base, calorieTarget: base.maintenanceCalories + 400 });
  assert.equal(edited.calorieDirection, 'surplus');
  assert.equal(edited.calorieDelta, 400);
});

test('lowering an edited target below maintenance flips surplus -> deficit', () => {
  const base = buildDietTargets(BULKER);          // surplus
  const edited = withCalorieContext({ ...base, calorieTarget: base.maintenanceCalories - 250 });
  assert.equal(edited.calorieDirection, 'deficit');
  assert.equal(edited.calorieDelta, -250);
});

test('editing to exactly maintenance reads as maintenance', () => {
  const base = buildDietTargets(CUTTER);
  const edited = withCalorieContext({ ...base, calorieTarget: base.maintenanceCalories });
  assert.equal(edited.calorieDirection, 'maintenance');
  assert.equal(edited.calorieDelta, 0);
});

test('withCalorieContext is idempotent and safe on legacy diets', () => {
  const base = buildDietTargets(CUTTER);
  assert.deepEqual(withCalorieContext(withCalorieContext(base)), withCalorieContext(base));
  // A pre-011 plan has no maintenance figure — pass it through untouched
  // rather than inventing a direction from a number we do not have.
  const legacy = { calorieTarget: 2000 };
  assert.deepEqual(withCalorieContext(legacy), legacy);
  assert.equal(withCalorieContext(null), null);
});
