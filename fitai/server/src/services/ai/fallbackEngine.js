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
  // 'home' and 'minimal' both mean no gym machines -> bodyweight template.
  // Goals without a dedicated template (maintain, improve_endurance) borrow
  // the full-body split but keep the USER'S goal — storing the template's
  // goal would corrupt profile metadata ("lose_fat" on a maintain account).
  const key = ["home", "minimal"].includes(profile.equipment)
    ? "home_workout"
    : `${profile.goal}_beginner`;
  const template = TEMPLATE_PLANS[key] || TEMPLATE_PLANS.lose_fat_beginner;
  return {
    ...template,
    goal: profile.goal || template.goal,
    generatedBy: "fallback_template",
    warning: "AI was unavailable — this is a general starter plan, not personalized.",
  };
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

// Shown when the AI coach can't be reached for the daily briefing. Honest
// and non-committal — it never fabricates a pace it did not measure.
function fallbackBriefing() {
  return {
    status: 'no_data',
    currentPace: 'Your target pace is set in your plan.',
    actualPace: 'Your coach could not be reached to measure your pace right now.',
    summary: 'We could not generate your AI briefing at the moment. Keep logging your daily checklist and weigh-ins — your pace update will be here on the next try.',
    focus: ['Complete today\'s checklist', 'Log today\'s weigh-in'],
    generatedBy: 'fallback_template',
  };
}

// The Progress page when the coach is unreachable — honest about it, and
// never a fabricated analysis. The page still shows the raw data (charts,
// adherence); only the interpretation is missing.
function fallbackProgressAnalysis() {
  return {
    status: 'no_data',
    summary: 'Your coach could not be reached to analyze your progress right now — your logged data below is safe and this analysis will refresh on the next visit.',
    weightTrend: 'Analysis unavailable at the moment.',
    trainingAnalysis: 'Analysis unavailable at the moment.',
    nutritionAnalysis: 'Analysis unavailable at the moment.',
    wins: [],
    risks: [],
    recommendations: ['Keep logging weigh-ins, meals and workouts — the analysis reads everything when it\'s back.'],
    generatedBy: 'fallback_template',
  };
}

module.exports = {
  fallbackPlan,
  fallbackTutorResponse,
  fallbackFoodAnalysis,
  fallbackBriefing,
  fallbackProgressAnalysis,
};
