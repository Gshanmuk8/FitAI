/**
 * Plan assembly. The AI (or fallback template) contributes only the
 * workout days; everything numeric that matters — diet targets, the goal
 * timeframe, roadmap milestones — is layered on deterministically here, so
 * those values are exact formula output regardless of which provider (if
 * any) produced the training split.
 */
const { generatePlan } = require('../ai/aiOrchestrator');
const { buildPlanGenerationPrompt } = require('../../../../shared/prompts/templates');
const { buildDietTargets } = require('../../../../shared/calculations/dietTargets');
const { resolveTimeframeWeeks, expectedWeightAt, expectedWeeklyRateKg } = require('../../../../shared/calculations/paceTracking');
const { getExercisePreferences } = require('../memory/memoryRetriever');
const { upsertUserState } = require('../../models/UserState');
const logger = require('../../utils/logger');

/**
 * profile: { age, heightCm, weightKg, targetWeightKg, sex, goal,
 *            activityLevel, injuries[], equipment, dietaryRestrictions,
 *            requestedTimeframeWeeks, userId }
 * Returns the full plan object stored in users_profile.ai_plan.
 */
async function generateUserPlan(profile, { skipCache = false } = {}) {
  // Behavior memory feeds generation: exercises the user repeatedly
  // removed are named in the prompt as "avoid".
  const prefs = profile.userId
    ? await getExercisePreferences(profile.userId)
    : { disliked: [], favorite: [] };

  const timeframe = resolveTimeframeWeeks({
    requestedWeeks: profile.requestedTimeframeWeeks,
    weightKg: profile.weightKg,
    targetWeightKg: profile.targetWeightKg,
    goal: profile.goal,
  });

  const promptProfile = {
    ...profile,
    timeframeWeeks: timeframe.weeks,
    dislikedExercises: prefs.disliked,
    favoriteExercises: prefs.favorite,
  };
  const prompt = buildPlanGenerationPrompt(promptProfile);
  const aiPlan = await generatePlan({ profile: promptProfile, prompt, skipCache });

  return attachDeterministicLayers(aiPlan, profile, timeframe);
}

function attachDeterministicLayers(plan, profile, timeframe) {
  let diet = null;
  try {
    diet = buildDietTargets(profile);
  } catch (err) {
    // Missing sex/activity data on legacy profiles — plan still ships,
    // just without the diet layer rather than failing onboarding.
    logger.warn('diet targets unavailable for profile', { error: err.message });
  }

  return {
    ...plan,
    diet,
    timeframe: {
      weeks: timeframe.weeks,
      requestedWeeks: timeframe.requestedWeeks,
      adjusted: timeframe.adjusted,
      adjustedReason: timeframe.reason,
      expectedWeeklyRateKg: expectedWeeklyRateKg(profile.goal),
    },
    roadmap: buildRoadmap(profile, timeframe.weeks),
  };
}

// Checkpoints every 4 weeks plus the final week — pure interpolation.
// Only weight-directional goals get a roadmap: a maintain/endurance plan
// claiming "you'll be at 80kg by week 8" would contradict its own
// expectedWeeklyRateKg of 0.
function buildRoadmap(profile, timeframeWeeks) {
  if (!['lose_fat', 'build_muscle'].includes(profile.goal)) return [];
  if (!profile.weightKg || !profile.targetWeightKg) return [];
  const checkpoints = [];
  for (let week = 4; week < timeframeWeeks; week += 4) {
    checkpoints.push({
      week,
      expectedWeightKg: expectedWeightAt({
        startWeightKg: profile.weightKg,
        targetWeightKg: profile.targetWeightKg,
        timeframeWeeks,
        weeksElapsed: week,
      }),
    });
  }
  // The last checkpoint is always the goal itself — a 10-week plan must
  // show week 10 at the target, not stop at week 8.
  checkpoints.push({ week: timeframeWeeks, expectedWeightKg: profile.targetWeightKg });
  return checkpoints;
}

// One canonical mapping from a users_profile row to plan-generation input —
// onboarding and regeneration both use this, so they can never drift apart.
function generationInputFromProfileRow(userId, profile) {
  return {
    userId,
    age: profile.age,
    heightCm: profile.height_cm != null ? Number(profile.height_cm) : null,
    weightKg: profile.weight_kg != null ? Number(profile.weight_kg) : null,
    targetWeightKg: profile.target_weight_kg != null ? Number(profile.target_weight_kg) : null,
    sex: profile.sex || 'other',
    goal: profile.goal,
    activityLevel: profile.activity_level,
    injuries: profile.injuries ? profile.injuries.split(',').map((s) => s.trim()).filter(Boolean) : [],
    equipment: profile.gym_availability || 'gym',
    dietaryRestrictions: profile.dietary_restrictions,
    requestedTimeframeWeeks: profile.timeframe_weeks || undefined,
    trainingDaysPerWeek: profile.training_days_per_week || undefined,
    trainingStyle: profile.training_style || undefined,
  };
}

// Keep the semi-permanent memory tier in sync with whatever plan is live.
async function syncUserState(userId, plan, goal) {
  try {
    await upsertUserState(userId, {
      currentProgram: plan.days ? `${plan.goal || goal}: ${plan.days.length}-day split` : null,
      calorieTarget: plan.diet?.calorieTarget ?? null,
      currentPhase: goal,
    });
  } catch (err) {
    logger.error('user_state sync failed', { error: err.message });
  }
}

module.exports = { generateUserPlan, attachDeterministicLayers, syncUserState, generationInputFromProfileRow };
