/**
 * Pure formula-based calculations. NEVER call the AI for these — they are
 * deterministic and the AI is slower, costs tokens, and can hallucinate
 * numbers. See docs/architecture.md "Rules Engine".
 */

function calculateBMR({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return Math.round(base + 5);
  if (sex === 'female') return Math.round(base - 161);
  // Mifflin-St Jeor has no validated "other" constant; average the two
  // offsets rather than silently defaulting to one sex.
  return Math.round(base - 78);
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  athlete: 1.9,
};

function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  if (!multiplier) {
    throw new Error(`Unknown activity level: ${activityLevel}`);
  }
  return Math.round(bmr * multiplier);
}

function calorieTargetForGoal(tdee, goal) {
  switch (goal) {
    case 'lose_fat':
      return Math.round(tdee - 500); // ~0.45kg/week deficit
    case 'build_muscle':
      return Math.round(tdee + 300);
    case 'maintain':
    case 'improve_endurance':
      return tdee;
    default:
      throw new Error(`Unknown goal: ${goal}`);
  }
}

module.exports = {
  calculateBMR,
  calculateTDEE,
  calorieTargetForGoal,
};
