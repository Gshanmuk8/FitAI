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

  const proteinPerKg = profile.goal === 'build_muscle' ? 2.0 : 1.8;
  const proteinGrams = roundTo(profile.weightKg * proteinPerKg, 5);

  // ~35ml/kg, rounded to a glass; floor of 2L so light users still hydrate.
  const waterMl = Math.max(2000, roundTo(profile.weightKg * 35, 250));

  const stepsTarget = profile.goal === 'lose_fat' ? 10000 : 8000;

  return { calorieTarget, proteinGrams, waterMl, stepsTarget, sleepHours: 8 };
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

module.exports = { buildDietTargets, DIET_EDIT_BOUNDS };
