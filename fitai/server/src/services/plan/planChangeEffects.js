/**
 * Everything that must react THE MOMENT the plan changes — called by all
 * three plan-write paths (onboarding, user edit, regenerate) so no surface
 * keeps talking about a plan that no longer exists:
 *
 *   - Today's mission: the frozen snapshot is rebuilt from the new plan and
 *     value-based completions are re-derived against the new targets.
 *   - Today's briefing: deleted; the next dashboard load regenerates it from
 *     the new plan (the progress analysis needs no action — its input hash
 *     includes the plan's targets/timeframe, so it recomputes on next view).
 *
 * History is deliberately untouched: past checklist rows, meals, weigh-ins,
 * and workout logs are the user's record and the AI's ground truth across
 * plan generations — a regenerated plan starts a new timeline, not a new
 * account.
 *
 * Best-effort by design: a propagation failure must never fail the plan
 * save itself (the plan IS saved; the surfaces self-heal at next rollover).
 */
const { refreshTodaySnapshot } = require('../checklist/checklistService');
const DailyBriefing = require('../../models/DailyBriefing');
const { getUserToday } = require('../../utils/userDate');
const logger = require('../../utils/logger');

async function propagatePlanChange(userId) {
  try {
    await refreshTodaySnapshot(userId);
  } catch (err) {
    logger.error('plan change: today-snapshot refresh failed', { error: err.message });
  }
  try {
    await DailyBriefing.deleteToday(userId, await getUserToday(userId));
  } catch (err) {
    logger.error('plan change: briefing invalidation failed', { error: err.message });
  }
}

module.exports = { propagatePlanChange };
