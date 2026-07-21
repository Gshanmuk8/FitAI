/**
 * The ONE place that answers "what are this user's diet targets right now?"
 *
 * Why this exists: the answer used to be resolved independently in the plan
 * controller, the checklist snapshot builder and the coach's context
 * builder, and each did it slightly differently. That made behaviour depend
 * on which surface you were looking at AND on when the account's plan
 * happened to be generated — an account created last month got the calorie
 * explanation, one created last year did not, from the same code. Users do
 * not have vintages; every account must behave identically.
 *
 * The contract:
 *   - the user's own edited targets always win (they are the user's numbers)
 *   - the CONTEXT around them (maintenance, delta, direction) is always
 *     recomputed from the CURRENT profile, never trusted from storage —
 *     maintenance is a pure function of the body, so a stored copy is just a
 *     stale copy, and someone who has lost 6kg should see today's deficit
 *   - a profile too incomplete to compute a TDEE yields targets without the
 *     context rather than an invented maintenance figure
 */
const { buildDietTargets, withCalorieContext } = require('../../../../shared/calculations/dietTargets');
const logger = require('../../utils/logger');

function parsePlan(aiPlan) {
  if (!aiPlan) return null;
  try {
    return typeof aiPlan === 'string' ? JSON.parse(aiPlan) : aiPlan;
  } catch {
    return null;
  }
}

/**
 * profileRow: a raw users_profile row.
 * Returns the effective diet targets, or null when there is nothing to say.
 */
function resolveEffectiveDiet(profileRow, plan = undefined) {
  if (!profileRow) return null;
  const livePlan = plan !== undefined ? plan : parsePlan(profileRow.ai_plan);
  const stored = livePlan?.diet || null;

  let computed = null;
  try {
    computed = buildDietTargets({
      weightKg: profileRow.weight_kg != null ? Number(profileRow.weight_kg) : null,
      heightCm: profileRow.height_cm != null ? Number(profileRow.height_cm) : null,
      age: profileRow.age,
      sex: profileRow.sex || 'other',
      activityLevel: profileRow.activity_level,
      goal: profileRow.goal,
    });
  } catch (err) {
    // Incomplete legacy profile (no sex/activity). Not an error worth
    // failing a request over — the surfaces degrade to the stored targets.
    logger.warn('diet targets not computable for profile', { error: err.message });
  }

  if (!stored) return computed;
  if (!computed) return stored;

  // Stored targets win on the five editable fields; the derived context is
  // always fresh. withCalorieContext then re-derives delta/direction so an
  // edited target can never keep a label from before the edit.
  return withCalorieContext({
    ...computed,
    ...stored,
    bmr: computed.bmr,
    maintenanceCalories: computed.maintenanceCalories,
  });
}

module.exports = { resolveEffectiveDiet };
