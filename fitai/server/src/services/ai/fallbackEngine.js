/**
 * Rules + templates that run when Gemini is unavailable or returns
 * something that fails validation after every retry. The user should
 * never see a blank screen or a raw error from this layer.
 */
const TEMPLATE_PLANS = {
  lose_fat_beginner: require("./templates/loseFat.beginner.json"),
  build_muscle_beginner: require("./templates/buildMuscle.beginner.json"),
  home_workout: require("./templates/homeWorkout.json"),
};

function fallbackPlan(profile) {
  const key = profile.equipment === "home" ? "home_workout" : `${profile.goal}_beginner`;
  const template = TEMPLATE_PLANS[key] || TEMPLATE_PLANS.lose_fat_beginner;
  return { ...template, generatedBy: "fallback_template", warning: "AI was unavailable — this is a general starter plan, not personalized." };
}

function fallbackTutorResponse(mode) {
  const fallbacks = {
    gym: "I cannot reach the AI coach right now. General rule: stop any exercise that causes sharp pain, and when in doubt about form, reduce the weight.",
    diet: "I cannot reach the AI coach right now. As a rough guide, aim for ~1.8g protein per kg bodyweight per day and prioritize whole foods.",
    recovery: "I cannot reach the AI coach right now. If soreness is sharp, localized to a joint, or lasts beyond 72 hours, treat it as a possible injury, not normal fatigue.",
  };
  return {
    answer: fallbacks[mode] || fallbacks.gym,
    mode,
    confidence: 0,
    recommendSeeProfessional: false,
    generatedBy: "fallback_template",
  };
}

function fallbackFoodAnalysis() {
  return {
    foods: [],
    confidence: 0,
    needsManualInput: true,
    prompt: "We could not read that image. What foods are on the plate, and roughly how much of each?",
  };
}

// Review narrative built purely from the deterministic stats — used when
// no AI provider is available. Reads templated but is factually exact.
function fallbackReviewNarrative(stats = {}) {
  const adherencePct = stats.adherence != null ? Math.round(stats.adherence * 100) : null;
  const wins = [];
  const focusNext = [];

  if (stats.workoutsCompleted > 0) wins.push(`Completed ${stats.workoutsCompleted} workout day(s).`);
  if (stats.weightChangeKg != null && stats.weightChangeKg !== 0) {
    wins.push(`Body weight moved ${stats.weightChangeKg > 0 ? '+' : ''}${stats.weightChangeKg}kg over the period.`);
  }
  if (adherencePct != null && adherencePct >= 70) wins.push(`Strong adherence: ${adherencePct}% of daily targets hit.`);

  if (adherencePct != null && adherencePct < 70) focusNext.push('Raise daily checklist completion — consistency beats intensity.');
  if (stats.proteinDaysHit != null && stats.daysTracked && stats.proteinDaysHit / stats.daysTracked < 0.7) {
    focusNext.push('Hit the protein target more days than you miss it.');
  }
  if (!focusNext.length) focusNext.push('Keep the current routine — momentum is on your side.');

  return {
    headline: adherencePct != null ? `Period summary: ${adherencePct}% adherence` : 'Period summary',
    wins: wins.length ? wins : ['You showed up — the streak continues from here.'],
    focusNext,
    recommendation:
      'This summary was generated from your logged data. For personalized coaching commentary, AI review will be available when a provider is configured.',
    generatedBy: 'fallback_template',
  };
}

module.exports = {
  fallbackPlan,
  fallbackTutorResponse,
  fallbackFoodAnalysis,
  fallbackReviewNarrative,
};
