/**
 * Turns the memory tiers into the compact object that goes into prompts.
 * This is what keeps token usage down per the architecture doc — the AI
 * never sees raw chat history, only summaries plus current state plus
 * learned exercise preferences, so the coach's answers stay grounded in
 * the user's own history.
 */
const { getFullMemoryContext } = require('./memoryRetriever');

function formatProfileForPrompt(memory) {
  const { permanent, semiPermanent, temporal, exercisePreferences, todayBriefing } = memory;
  if (!permanent) return { profile: {}, contextBlock: 'No profile on file.' };

  const profile = {
    age: permanent.age,
    weightKg: permanent.weight_kg != null ? Number(permanent.weight_kg) : undefined,
    targetWeightKg: permanent.target_weight_kg != null ? Number(permanent.target_weight_kg) : undefined,
    activityLevel: permanent.activity_level,
    goal: semiPermanent?.current_phase || 'unspecified',
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
    semiPermanent?.calorie_target ? `Daily calorie target: ${semiPermanent.calorie_target} kcal` : null,
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
