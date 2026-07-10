/**
 * Goal-timeframe safety math — deterministic, never an AI task. Used by
 * plan generation to clamp over-ambitious timeframes and to interpolate
 * roadmap checkpoints.
 *
 * Sign convention: rates are kg/week, negative = losing weight.
 */

// Physiologically sensible weekly rates per goal. lose_fat mirrors the
// ~500kcal/day deficit the rules engine already prescribes (~0.45kg/wk).
const GOAL_WEEKLY_RATE_KG = {
  lose_fat: -0.45,
  build_muscle: 0.25,
  maintain: 0,
  improve_endurance: 0,
};

// Hard safety ceilings — faster than this is a red flag, not ambition.
const MAX_SAFE_WEEKLY_RATE_KG = {
  lose_fat: 1.0,
  build_muscle: 0.5,
};

const TIMEFRAME_BOUNDS_WEEKS = { min: 4, max: 104 };

function expectedWeeklyRateKg(goal) {
  return GOAL_WEEKLY_RATE_KG[goal] ?? 0;
}

/**
 * The shortest timeframe that reaches targetWeightKg without exceeding the
 * safe weekly rate for the goal. Returns null when the goal has no weight
 * dimension (maintain/endurance) or no target is set.
 */
function minimumSafeTimeframeWeeks({ weightKg, targetWeightKg, goal }) {
  const maxRate = MAX_SAFE_WEEKLY_RATE_KG[goal];
  if (!maxRate || !weightKg || !targetWeightKg) return null;
  const deltaKg = Math.abs(targetWeightKg - weightKg);
  if (deltaKg === 0) return TIMEFRAME_BOUNDS_WEEKS.min;
  return Math.max(TIMEFRAME_BOUNDS_WEEKS.min, Math.ceil(deltaKg / maxRate));
}

/**
 * Validates the timeframe the user asked for during onboarding against
 * safety bounds. Never rejects — clamps and explains, so onboarding can't
 * dead-end on an over-ambitious answer.
 * Returns { weeks, requestedWeeks, adjusted, reason }.
 */
function resolveTimeframeWeeks({ requestedWeeks, weightKg, targetWeightKg, goal }) {
  const fallbackWeeks = 12;
  let weeks = Number.isFinite(requestedWeeks) ? Math.round(requestedWeeks) : fallbackWeeks;
  let adjusted = false;
  let reason = null;

  if (weeks < TIMEFRAME_BOUNDS_WEEKS.min) {
    weeks = TIMEFRAME_BOUNDS_WEEKS.min;
    adjusted = true;
    reason = `Timeframes under ${TIMEFRAME_BOUNDS_WEEKS.min} weeks don't allow measurable adaptation.`;
  } else if (weeks > TIMEFRAME_BOUNDS_WEEKS.max) {
    weeks = TIMEFRAME_BOUNDS_WEEKS.max;
    adjusted = true;
    reason = `Timeframes are capped at ${TIMEFRAME_BOUNDS_WEEKS.max} weeks — re-plan after that.`;
  }

  const minSafe = minimumSafeTimeframeWeeks({ weightKg, targetWeightKg, goal });
  if (minSafe && weeks < minSafe) {
    weeks = minSafe;
    adjusted = true;
    reason = `Reaching your target that fast would exceed a safe weekly rate — extended to ${minSafe} weeks.`;
  }

  return { weeks, requestedWeeks: requestedWeeks ?? null, adjusted, reason };
}

/**
 * Where the user's weight *should* be at weeksElapsed, assuming linear
 * progress from startWeightKg to targetWeightKg over timeframeWeeks.
 * Clamped at the target — being past the timeframe doesn't extrapolate.
 */
function expectedWeightAt({ startWeightKg, targetWeightKg, timeframeWeeks, weeksElapsed }) {
  if (!startWeightKg || !targetWeightKg || !timeframeWeeks || timeframeWeeks <= 0) return null;
  const fraction = Math.min(Math.max(weeksElapsed / timeframeWeeks, 0), 1);
  return Number((startWeightKg + (targetWeightKg - startWeightKg) * fraction).toFixed(1));
}

module.exports = {
  expectedWeeklyRateKg,
  minimumSafeTimeframeWeeks,
  resolveTimeframeWeeks,
  expectedWeightAt,
};
