/**
 * Turns the memory tiers into the compact object that goes into prompts.
 * This is what keeps token usage down per the architecture doc — the AI
 * never sees raw chat history, only summaries plus current state plus
 * learned exercise preferences, so the coach's answers stay grounded in
 * the user's own history.
 */
const { getFullMemoryContext } = require('./memoryRetriever');
const { resolveEffectiveDiet } = require('../plan/dietResolver');

function formatProfileForPrompt(memory) {
  const { permanent, semiPermanent, temporal, exercisePreferences, todayBriefing } = memory;
  if (!permanent) return { profile: {}, contextBlock: 'No profile on file.' };

  const profile = {
    age: permanent.age,
    sex: permanent.sex || undefined,
    heightCm: permanent.height_cm != null ? Number(permanent.height_cm) : undefined,
    weightKg: permanent.weight_kg != null ? Number(permanent.weight_kg) : undefined,
    targetWeightKg: permanent.target_weight_kg != null ? Number(permanent.target_weight_kg) : undefined,
    activityLevel: permanent.activity_level,
    // The PROFILE is authoritative, not user_state.current_phase.
    // current_phase is a snapshot written when the plan was generated; a
    // user who switches lose_fat -> build_muscle from the Profile page (which
    // deliberately does NOT regenerate the plan) left it stale, so the coach
    // went on advising for the abandoned goal — including telling someone on
    // a cut to eat in a surplus. The user's stated goal wins; current_phase
    // is only a fallback for rows that predate the column.
    goal: permanent.goal || semiPermanent?.current_phase || 'unspecified',
    // The deterministic nutrition figures, so every coaching surface argues
    // from the same numbers the dashboard shows.
    diet: resolveEffectiveDiet(permanent) || undefined,
    injuries: permanent.injuries ? permanent.injuries.split(',').map((s) => s.trim()) : [],
    dietaryRestrictions: permanent.dietary_restrictions || undefined,
    equipment: permanent.gym_availability,
    trainingDaysPerWeek: permanent.training_days_per_week || undefined,
    trainingStyle: permanent.training_style || undefined,
    dislikedExercises: exercisePreferences?.disliked?.length ? exercisePreferences.disliked : undefined,
    favoriteExercises: exercisePreferences?.favorite?.length ? exercisePreferences.favorite : undefined,
    // Pace comes from today's briefing — the same words the user saw on
    // their dashboard, so coach chat and briefing can never contradict.
    paceStatus:
      todayBriefing?.status && todayBriefing.status !== 'no_data'
        ? `${todayBriefing.status.replace(/_/g, ' ')} — ${todayBriefing.actualPace}`
        : undefined,
  };

  const lines = [
    semiPermanent?.current_program ? `Current program: ${semiPermanent.current_program}` : null,
    // Deliberately NOT semiPermanent.calorie_target: that is written at
    // plan-generation time and goes stale the moment the user edits their
    // profile or diet targets. profile.diet is resolved from the live plan
    // (or recomputed), so the coach quotes the number the user can see.
    profile.diet?.calorieTarget ? `Daily calorie target: ${profile.diet.calorieTarget} kcal` : null,
    temporal && temporal.workout_completed === false
      ? 'Has not completed the current workout yet.'
      : null,
  ].filter(Boolean);

  return { profile, contextBlock: lines.join('\n') };
}

async function buildContextForUser(userId) {
  const memory = await getFullMemoryContext(userId);
  const { profile, contextBlock } = formatProfileForPrompt(memory);
  return {
    profile,
    contextBlock,
    recentMemorySummaries: memory.conversational,
  };
}

module.exports = { buildContextForUser, formatProfileForPrompt };
