/**
 * Deterministic daily diet/lifestyle targets derived from the profile via
 * the existing BMR/TDEE rules engine. This is the diet layer attached to
 * every plan — AI-generated or fallback — so diet targets are always
 * exact formula output, never a hallucinated number.
 */
const { calculateBMR, calculateTDEE, calorieTargetForGoal } = require('./bmrTdee');

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

/**
 * profile: { weightKg, heightCm, age, sex, activityLevel, goal }
 * Returns { calorieTarget, proteinGrams, waterMl, stepsTarget, sleepHours }.
 */
function buildDietTargets(profile) {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  // Floor at the same safety bound applied to user edits — small/young
  // profiles can otherwise compute a starvation-level deficit target
  // (e.g. TDEE 839 - 500 = 339 kcal), which must never ship on a plan.
  const calorieTarget = Math.max(
    DIET_EDIT_BOUNDS.calorieTarget.min,
    calorieTargetForGoal(tdee, profile.goal)
  );

  // The target on its own is a bare number, and a bare number invites the
  // wrong reading: a very active user on a cut gets ~2,700 kcal and
  // reasonably asks why their "deficit plan" is feeding them more than they
  // eat now. Shipping maintenance alongside it — and the signed delta from
  // it — lets every surface state the target as an ARGUMENT ("2,700, which
  // is 500 below your 3,200 maintenance") instead of an assertion. It also
  // gives the AI the same two numbers, so its prose can no longer contradict
  // the arithmetic.
  const calorieDelta = calorieTarget - tdee;
  // Did the 1200 kcal safety floor lift the target? If so the direction
  // below describes the FLOOR, not the goal — a very small profile on a cut
  // can end up nominally above maintenance. Downstream must be able to say
  // "clamped for safety" instead of picking the surplus branch and telling a
  // cutting user to bulk.
  const flooredForSafety = calorieTarget > calorieTargetForGoal(tdee, profile.goal);

  const proteinPerKg = profile.goal === 'build_muscle' ? 2.0 : 1.8;
  const proteinGrams = roundTo(profile.weightKg * proteinPerKg, 5);

  // ~35ml/kg, rounded to a glass; floor of 2L so light users still hydrate.
  const waterMl = Math.max(2000, roundTo(profile.weightKg * 35, 250));

  const stepsTarget = profile.goal === 'lose_fat' ? 10000 : 8000;

  return {
    calorieTarget,
    proteinGrams,
    waterMl,
    stepsTarget,
    sleepHours: 8,
    // Context, not targets. Never user-editable — they are derived facts.
    maintenanceCalories: tdee,
    bmr,
    calorieDelta,
    flooredForSafety,
    // The goal these targets were DERIVED from. Targets outlive the goal
    // that produced them — the Profile page changes the goal without
    // regenerating the plan — so without this stamp a plan built for a bulk
    // keeps feeding its surplus target to someone who is now cutting.
    dietGoal: profile.goal,
    // The direction the target actually cuts, stated once here so no
    // surface has to re-derive it from the goal enum and risk disagreeing.
    calorieDirection: calorieDelta < 0 ? 'deficit' : calorieDelta > 0 ? 'surplus' : 'maintenance',
  };
}

/**
 * Re-derive the calorie CONTEXT after a user edits their target.
 *
 * maintenance is a property of the body, so it survives an edit — but the
 * delta and the direction are relationships between the target and
 * maintenance, and both go stale the moment the target moves. Without this,
 * a user on a cut who raises their target above maintenance keeps being told
 * they are in "a 500 kcal deficit" while eating in a surplus: the same
 * contradiction the deterministic layer exists to prevent.
 *
 * Pure and idempotent — safe to run on any diet object, edited or not.
 */
function withCalorieContext(diet) {
  if (!diet || diet.calorieTarget == null || diet.maintenanceCalories == null) return diet;
  const calorieDelta = Math.round(Number(diet.calorieTarget) - Number(diet.maintenanceCalories));
  // A user-chosen target is their choice, not a safety clamp — so an edit
  // clears the floor flag rather than carrying a claim that no longer holds.
  const flooredForSafety = Boolean(diet.flooredForSafety) && Number(diet.calorieTarget) <= 1200;
  return {
    ...diet,
    flooredForSafety,
    calorieDelta,
    calorieDirection: calorieDelta < 0 ? 'deficit' : calorieDelta > 0 ? 'surplus' : 'maintenance',
  };
}

// Bounds for user-edited diet targets — the plan editor accepts overrides
// only inside these; anything outside is a safety problem, not a preference.
const DIET_EDIT_BOUNDS = {
  calorieTarget: { min: 1200, max: 6000 },
  proteinGrams: { min: 40, max: 400 },
  waterMl: { min: 1000, max: 8000 },
  stepsTarget: { min: 1000, max: 40000 },
  sleepHours: { min: 5, max: 12 },
};

module.exports = { buildDietTargets, withCalorieContext, DIET_EDIT_BOUNDS };
