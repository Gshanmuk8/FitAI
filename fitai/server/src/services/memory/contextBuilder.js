/**
 * Turns the memory tiers into the compact object that goes into prompts.
 * This is what keeps token usage down per the architecture doc — the AI
 * never sees raw chat history, only summaries plus current state, plus
 * (new in 002) the user's pace vs. their plan and learned exercise
 * preferences, so the coach's answers acknowledge how the plan is going.
 */
const { getFullMemoryContext } = require('./memoryRetriever');

function formatProfileForPrompt(memory) {
  const { permanent, semiPermanent, temporal, progressSnapshot, exercisePreferences } = memory;
  if (!permanent) return { profile: {}, contextBlock: 'No profile on file.' };

  const pace = progressSnapshot?.metrics?.pace;

  const profile = {
    age: permanent.age,
    weightKg: permanent.weight_kg != null ? Number(permanent.weight_kg) : undefined,
    targetWeightKg: permanent.target_weight_kg != null ? Number(permanent.target_weight_kg) : undefined,
    activityLevel: permanent.activity_level,
    goal: semiPermanent?.current_phase || 'unspecified',
    injuries: permanent.injuries ? permanent.injuries.split(',').map((s) => s.trim()) : [],
    dietaryRestrictions: permanent.dietary_restrictions || undefined,
    equipment: permanent.gym_availability,
    dislikedExercises: exercisePreferences?.disliked?.length ? exercisePreferences.disliked : undefined,
    favoriteExercises: exercisePreferences?.favorite?.length ? exercisePreferences.favorite : undefined,
    paceStatus: pace?.status && pace.status !== 'no_data' ? `${pace.status} (${pace.message})` : undefined,
  };

  const lines = [
    semiPermanent?.current_program ? `Current program: ${semiPermanent.current_program}` : null,
    semiPermanent?.calorie_target ? `Daily calorie target: ${semiPermanent.calorie_target} kcal` : null,
    temporal?.soreness_level ? `Today soreness level: ${temporal.soreness_level}` : null,
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
