/**
 * Achievement rules are a deterministic function of the user's history —
 * no AI involved, so unlocks are consistent, explainable, and free.
 * evaluateAchievements() is pure: it returns every achievement the input
 * data justifies; the caller diffs against what's already unlocked
 * (the DB's unique(user_id, code) makes double-awarding impossible anyway).
 */

const DEFINITIONS = {
  FIRST_WORKOUT: { name: 'First Workout Logged', description: 'Logged your first set.' },
  WORKOUTS_10: { name: 'Ten Sessions Strong', description: 'Logged sets on 10 different days.' },
  WORKOUTS_50: { name: 'Fifty Sessions', description: 'Logged sets on 50 different days.' },
  WORKOUTS_100: { name: 'Century Club', description: 'Logged sets on 100 different days.' },
  STREAK_7: { name: '7-Day Streak', description: 'Hit your daily mission 7 days in a row.' },
  STREAK_30: { name: '30-Day Streak', description: 'Hit your daily mission 30 days in a row.' },
  FIRST_WEIGH_IN: { name: 'On the Record', description: 'Logged your first body weight.' },
  WEIGH_INS_30: { name: 'Data-Driven', description: '30 body-weight logs — trends need data.' },
  GOAL_QUARTER: { name: '25% There', description: 'A quarter of the way to your target weight.' },
  GOAL_HALF: { name: 'Halfway Point', description: 'Halfway to your target weight.' },
  GOAL_REACHED: { name: 'Goal Reached', description: 'Hit your target weight. Time for a new goal.' },
};

/**
 * input: {
 *   workoutDayCount,     // distinct days with at least one logged set
 *   weighInCount,
 *   bestStreak,          // from paceTracking.checklistStreaks
 *   startWeightKg, targetWeightKg, currentWeightKg,
 * }
 * Returns [{ code, name, description }].
 */
function evaluateAchievements(input) {
  const earned = [];
  const add = (code) => earned.push({ code, ...DEFINITIONS[code] });

  if (input.workoutDayCount >= 1) add('FIRST_WORKOUT');
  if (input.workoutDayCount >= 10) add('WORKOUTS_10');
  if (input.workoutDayCount >= 50) add('WORKOUTS_50');
  if (input.workoutDayCount >= 100) add('WORKOUTS_100');

  if (input.bestStreak >= 7) add('STREAK_7');
  if (input.bestStreak >= 30) add('STREAK_30');

  if (input.weighInCount >= 1) add('FIRST_WEIGH_IN');
  if (input.weighInCount >= 30) add('WEIGH_INS_30');

  const progress = goalProgressFraction(input);
  if (progress != null) {
    if (progress >= 0.25) add('GOAL_QUARTER');
    if (progress >= 0.5) add('GOAL_HALF');
    if (progress >= 1) add('GOAL_REACHED');
  }

  return earned;
}

/** Fraction of the start→target weight distance covered so far, or null. */
function goalProgressFraction({ startWeightKg, targetWeightKg, currentWeightKg }) {
  if (!startWeightKg || !targetWeightKg || !currentWeightKg) return null;
  const total = targetWeightKg - startWeightKg;
  if (total === 0) return null;
  const covered = currentWeightKg - startWeightKg;
  return Math.max(0, covered / total);
}

module.exports = { evaluateAchievements, goalProgressFraction, ACHIEVEMENT_DEFINITIONS: DEFINITIONS };
