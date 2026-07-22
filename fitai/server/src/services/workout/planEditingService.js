const { withCalorieContext } = require('../../../../shared/calculations/dietTargets');
/**
 * User edits to the live plan: merge, persist, and learn from the diff.
 * "Learn" is deterministic behavior memory — an exercise the user removes
 * is bumped toward 'disliked', one they add toward 'favorite'. Strength
 * accumulates across edits; plan generation only avoids exercises at
 * strength >= 2 (see memoryRetriever.getExercisePreferences), so a
 * one-off substitution never becomes policy.
 */
const { getProfile, savePlan } = require('../../models/UserProfile');
const { bumpPreference } = require('../../models/ExercisePreference');
const { recordSystemMemory } = require('../memory/memoryWriter');
const { syncUserState } = require('./planService');
const { propagatePlanChange } = require('../plan/planChangeEffects');
const { FLAGS } = require('../../config/featureFlags');
const logger = require('../../utils/logger');

function exerciseNames(days) {
  const names = new Set();
  for (const day of days || []) {
    for (const ex of day.exercises || []) names.add(ex.name.trim().toLowerCase());
  }
  return names;
}

function diffExercises(oldDays, newDays) {
  const before = exerciseNames(oldDays);
  const after = exerciseNames(newDays);
  return {
    removed: [...before].filter((n) => !after.has(n)),
    added: [...after].filter((n) => !before.has(n)),
  };
}

async function applyPlanEdit(userId, edit) {
  const profile = await getProfile(userId);
  if (!profile?.ai_plan) {
    const err = new Error('No plan to edit — complete onboarding first.');
    err.status = 404;
    throw err;
  }
  const currentPlan = typeof profile.ai_plan === 'string' ? JSON.parse(profile.ai_plan) : profile.ai_plan;

  const merged = {
    ...currentPlan,
    ...(edit.days ? { days: edit.days } : {}),
    ...(edit.notes !== undefined ? { notes: edit.notes } : {}),
    // withCalorieContext re-derives delta/direction against the unchanged
    // maintenance figure, so an edited target can never keep the old label.
    // Stamp the goal the edit was made UNDER. Without it the resolver
    // cannot tell a deliberate user edit from a target left over from an
    // abandoned goal, and has to assume the unsafe case. With it, an edit
    // made under the current goal is trusted for as long as that goal holds.
    diet: edit.diet
      ? withCalorieContext({ ...currentPlan.diet, ...edit.diet, dietGoal: profile.goal })
      : currentPlan.diet,
    customized: true,
    lastEditedAt: new Date().toISOString(),
  };

  // Edits never restart the goal timeline.
  const updatedProfile = await savePlan(userId, merged, { restartClock: false });
  await syncUserState(userId, merged, profile.goal);
  // Today's mission + briefing must reflect the edit immediately, not at
  // midnight — awaited so the Plan page's save round-trip guarantees the
  // dashboard is already consistent when the user navigates back.
  await propagatePlanChange(userId);

  if (FLAGS.preferenceLearning && edit.days) {
    learnFromDiff(userId, diffExercises(currentPlan.days, edit.days)).catch((err) =>
      logger.error('preference learning failed', { error: err.message })
    );
  }

  // Target edits are durable facts about the user ("wants 180g protein") —
  // the coach should know without being told again.
  if (edit.diet && Object.keys(edit.diet).length) {
    const changes = Object.entries(edit.diet).map(([k, v]) => `${k}=${v}`).join(', ');
    recordSystemMemory(userId, {
      summary: `User adjusted their daily targets: ${changes}.`,
      category: 'preference',
      importance: 2,
    }).catch((err) => logger.error('diet-edit memory failed', { error: err.message }));
  }

  return { profile: updatedProfile, plan: merged };
}

async function learnFromDiff(userId, { removed, added }) {
  for (const name of removed) await bumpPreference(userId, name, 'disliked');
  for (const name of added) await bumpPreference(userId, name, 'favorite');

  if (removed.length || added.length) {
    const parts = [];
    if (removed.length) parts.push(`removed ${removed.join(', ')}`);
    if (added.length) parts.push(`added ${added.join(', ')}`);
    await recordSystemMemory(userId, {
      summary: `User edited their plan: ${parts.join('; ')}.`,
      category: 'behavior',
      importance: 2,
    });
  }
}

module.exports = { applyPlanEdit, diffExercises };
