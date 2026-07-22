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
const { buildPlanGenerationPrompt, buildProgressAnalysisPrompt, buildBriefingPrompt } = require('../../shared/prompts/templates');
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

// ---- goal-derived targets must not outlive the goal ----
//
// The Profile page changes the goal WITHOUT regenerating the plan. Before
// this, the stored target (built for the old goal) won unconditionally, so a
// user who switched build_muscle -> lose_fat had a surplus target restated
// to the model as ground truth — the original reported bug, re-entered
// through a different door.

const { resolveEffectiveDiet } = require('../src/services/plan/dietResolver');

const BODY = { weight_kg: 80, height_cm: 180, age: 30, sex: 'male', activity_level: 'moderately_active' };
const planBuiltFor = (goal) => ({
  goal,
  diet: buildDietTargets({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderately_active', goal }),
});

test('switching bulk -> cut stops serving the old surplus target', () => {
  const d = resolveEffectiveDiet({ ...BODY, goal: 'lose_fat' }, planBuiltFor('build_muscle'));
  assert.equal(d.calorieDirection, 'deficit');
  assert.ok(d.calorieTarget < d.maintenanceCalories);
});

test('switching cut -> bulk stops serving the old deficit target', () => {
  const d = resolveEffectiveDiet({ ...BODY, goal: 'build_muscle' }, planBuiltFor('lose_fat'));
  assert.equal(d.calorieDirection, 'surplus');
});

test('the other goal-derived targets follow the goal too', () => {
  const d = resolveEffectiveDiet({ ...BODY, goal: 'lose_fat' }, planBuiltFor('build_muscle'));
  assert.equal(d.stepsTarget, 10000, 'lose_fat walks 10k, not the bulk 8k');
  assert.equal(d.proteinGrams, 145, '1.8 g/kg on a cut, not the bulk 2.0');
});

test('a plan still on its original goal keeps the user\'s edits', () => {
  const plan = planBuiltFor('lose_fat');
  plan.diet.calorieTarget = 1900;   // the user edited it down
  plan.diet.waterMl = 4000;
  const d = resolveEffectiveDiet({ ...BODY, goal: 'lose_fat' }, plan);
  assert.equal(d.calorieTarget, 1900, 'same goal -> the edit is honoured');
  assert.equal(d.waterMl, 4000);
});

test('goal-neutral edits survive even across a goal change', () => {
  const plan = planBuiltFor('build_muscle');
  plan.diet.waterMl = 4000;
  plan.diet.sleepHours = 9;
  const d = resolveEffectiveDiet({ ...BODY, goal: 'lose_fat' }, plan);
  assert.equal(d.waterMl, 4000, 'water is not derived from the goal');
  assert.equal(d.sleepHours, 9);
});

// ---- the safety floor must not read as permission to eat more ----

const TINY = { weightKg: 40, heightCm: 150, age: 40, sex: 'female', activityLevel: 'sedentary', goal: 'lose_fat' };

test('a floored target is flagged as floored', () => {
  const d = buildDietTargets(TINY);
  assert.equal(d.flooredForSafety, true);
  assert.ok(d.calorieTarget >= 1200);
});

test('a floored cut is never coached as a surplus', () => {
  const prompt = buildPlanGenerationPrompt({ ...TINY, diet: buildDietTargets(TINY), trainingDaysPerWeek: 3 });
  assert.doesNotMatch(prompt, /in a surplus there is recovery headroom/i,
    'telling a fat-loss user to bulk is the exact failure this guards');
  assert.match(prompt, /safety floor/i);
});

test('an ordinary target is not flagged as floored', () => {
  assert.equal(buildDietTargets(CUTTER).flooredForSafety, false);
});

test('editing a floored target upward clears the floor claim', () => {
  const d = withCalorieContext({ ...buildDietTargets(TINY), calorieTarget: 1800 });
  assert.equal(d.flooredForSafety, false, 'a chosen number is not a clamp');
});

// ---- a legacy diet with no direction must not crash prompt building ----

test('a stored diet lacking calorieDirection does not throw', () => {
  // dietResolver returns `stored` unchanged when the profile cannot produce
  // a TDEE, and that object has a target but no direction. An unguarded
  // .toUpperCase() on it 500s tutor, briefing AND progress.
  const legacy = { age: 30, goal: 'lose_fat', activityLevel: 'sedentary', diet: { calorieTarget: 2200, proteinGrams: 170 } };
  assert.doesNotThrow(() => buildPlanGenerationPrompt(legacy));
  const prompt = buildPlanGenerationPrompt(legacy);
  assert.doesNotMatch(prompt, /MEASURED FACTS/,
    'a half-populated diet yields no facts block rather than a misleading one');
});

// ---- coaching notation must not cost the user their personalized plan ----

// Providers write reps the way coaches do ("8-12"); the schema used to
// reject the whole plan over it, cascading every account to the same
// static template — the exact "AI ignores my profile" report.
test('rep-range notation is normalized, not rejected', () => {
  const { PlanSchema } = require('../../shared/schemas/aiSchemas');
  const r = PlanSchema.safeParse({
    goal: 'lose_fat',
    days: [{ name: 'Day A', exercises: [
      { name: 'Leg Press', sets: '3', reps: '8-12', restSeconds: '90' },
      { name: 'RDL', sets: 3, reps: '10 to 15' },
    ] }],
  });
  assert.ok(r.success, 'a rep range is notation, not junk');
  assert.equal(r.data.days[0].exercises[0].reps, 10, 'range collapses to its midpoint');
  assert.equal(r.data.days[0].exercises[0].sets, 3);
  assert.equal(r.data.days[0].exercises[0].restSeconds, 90);
  assert.equal(r.data.days[0].exercises[1].reps, 13);
});

test('non-numeric rep text still fails validation', () => {
  const { PlanSchema } = require('../../shared/schemas/aiSchemas');
  const r = PlanSchema.safeParse({
    goal: 'x',
    days: [{ name: 'D', exercises: [{ name: 'Y', sets: 3, reps: 'AMRAP' }] }],
  });
  assert.ok(!r.success, 'coercion is for notation, not for junk');
});

test('the plan prompt pins reps to a single integer', () => {
  const prompt = buildPlanGenerationPrompt({ ...CUTTER, trainingDaysPerWeek: 3 });
  assert.match(prompt, /SINGLE integer/,
    'the contract must forbid ranges at the source, not only repair them');
});

// ---- an incomplete profile must degrade, never ship plausible nonsense ----

// In JS `10 * null === 0`, so a null weight used to compute a 0kg body: a 0g
// protein target and, with height/age also missing, a calorie DIRECTION
// inverted to "surplus" on a cut. The callers' try/catch only degrades on a
// THROWN error, so the guard has to throw rather than return quietly.
test('diet targets throw (not silently zero) on a null weight', () => {
  assert.throws(
    () => buildDietTargets({ ...CUTTER, weightKg: null }),
    /weight|height|age/i,
    'a null weight must degrade to stored targets, not a 0g protein plan',
  );
});

test('diet targets throw when height and age are also missing', () => {
  assert.throws(() => buildDietTargets({ goal: 'lose_fat', sex: 'male', activityLevel: 'sedentary' }));
});

test('a complete profile still produces sane, positive targets', () => {
  const d = buildDietTargets(CUTTER);
  assert.ok(d.proteinGrams > 0, 'protein target is a real number');
  assert.ok(d.calorieTarget >= 1200);
  assert.equal(d.calorieDirection, 'deficit');
});

// ---- the Progress page must show the same graphs for every account ----

// Every graph used to be AI-authored, and the prompt said so outright ("YOUR
// charts are the only graphs the page has"). So an account whose analysis fell
// back, or whose model just skipped charts, saw NO graph while another account
// saw several — same code, different UI per account. The weight trend is drawn
// by the app from the user's own weigh-ins now; the coach covers other series.
test('the progress prompt no longer claims to be the only source of graphs', () => {
  const prompt = buildProgressAnalysisPrompt({
    profile: CUTTER,
    data: {
      asOfDate: '2026-07-22', firstLoggedDate: '2026-07-01',
      goal: { type: 'lose_fat' }, weighIns: [], checklist: [], training: [], nutrition: [],
    },
  });
  assert.doesNotMatch(prompt, /only graphs the page has/i,
    'the app draws every graph itself — the coach is no longer the source');
  assert.match(prompt, /OMIT this field entirely/i,
    'the coach must stop authoring charts, or the same data graphs differently each day');
});

// ---- the briefing must read the same way on every account ----

// The plan's expected pace is arithmetic, but the prompt used to say "work it
// out IN YOUR OWN WORDS". One account got "a gain of 0.33 kg per week,
// targeting 90kg in 30 weeks"; another, with an equally complete plan, got
// "You've just started your journey, stay consistent" and no figures at all.
const briefingFor = (goal) => buildBriefingPrompt({
  profile: CUTTER,
  data: { goal, weighIns: [], adherence: {}, today: null },
});

test('the briefing states the plan pace as a computed fact, not an exercise', () => {
  const prompt = briefingFor({ type: 'build_muscle', startWeightKg: 80, targetWeightKg: 90, timeframeWeeks: 30 });
  assert.match(prompt, /0\.33 kg per week/, 'the rate is arithmetic — the app owes the model the number');
  assert.match(prompt, /80kg to 90kg over 30 weeks/);
  assert.doesNotMatch(prompt, /work out two things IN YOUR OWN WORDS/i);
});

test('a weight-loss plan states its pace with the same shape', () => {
  const prompt = briefingFor({ type: 'lose_fat', startWeightKg: 100, targetWeightKg: 80, timeframeWeeks: 20 });
  assert.match(prompt, /loss of 1 kg per week/);
});

test('an incomplete goal yields no pace claim rather than a fabricated one', () => {
  const prompt = briefingFor({ type: 'maintain', startWeightKg: null, targetWeightKg: null, timeframeWeeks: null });
  assert.doesNotMatch(prompt, /kg per week/, 'no target weight means no pace sentence at all');
});
