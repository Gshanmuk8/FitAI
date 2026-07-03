/**
 * Pace tracking is deterministic, not a reasoning task — same policy as
 * bmrTdee.js and workoutRules.js: NEVER call the AI for these numbers.
 * Everything here is a pure function of (profile, logs, dates) so the
 * progress card renders identically with zero AI providers configured.
 *
 * Sign convention: rates are kg/week, negative = losing weight.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function weeksBetween(startDate, endDate) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return (end - start) / (7 * MS_PER_DAY);
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

/**
 * Observed rate from weigh-ins: earliest vs latest log, requiring at
 * least MIN_SPAN_DAYS between them so a two-day water-weight swing can't
 * masquerade as a trend. logs: [{ date, weight_kg }] any order.
 */
function actualWeeklyRateKg(logs, { minSpanDays = 5 } = {}) {
  if (!Array.isArray(logs) || logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanDays = (new Date(last.date) - new Date(first.date)) / MS_PER_DAY;
  if (spanDays < minSpanDays) return null;
  const deltaKg = Number(last.weight_kg) - Number(first.weight_kg);
  return Number(((deltaKg / spanDays) * 7).toFixed(2));
}

/**
 * Rolling mean over the trailing `window` entries per point — smooths
 * scale noise for the trend chart. values: number[] in date order.
 */
function movingAverage(values, window = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length;
    return Number(mean.toFixed(1));
  });
}

/**
 * Compares expected vs actual progress and classifies pace.
 * For weight-based goals: compares actual current weight against where the
 * linear plan says it should be, with a tolerance band.
 * For maintain/endurance goals: pace is adherence-based instead.
 * Returns { status: 'ahead'|'on_track'|'behind'|'no_data', deltaKg, message }.
 */
function paceStatus({ goal, expectedWeightNow, currentWeightKg, adherenceRatio, toleranceKg = 0.75 }) {
  const weightGoal = expectedWeeklyRateKg(goal) !== 0;

  if (!weightGoal) {
    if (adherenceRatio == null) {
      return { status: 'no_data', deltaKg: null, message: 'Complete a few daily checklists to measure your pace.' };
    }
    if (adherenceRatio >= 0.8) return { status: 'on_track', deltaKg: null, message: 'Consistency is on target — keep the streak alive.' };
    if (adherenceRatio >= 0.5) return { status: 'behind', deltaKg: null, message: 'Adherence is slipping — aim to close out more daily items.' };
    return { status: 'behind', deltaKg: null, message: 'Most daily targets are being missed — consider simplifying the plan.' };
  }

  if (expectedWeightNow == null || currentWeightKg == null) {
    return { status: 'no_data', deltaKg: null, message: 'Log your body weight so pace can be measured against the plan.' };
  }

  // Positive delta = heavier than plan. Whether that's ahead or behind
  // depends on direction: losing wants to be under plan, gaining over it.
  const deltaKg = Number((currentWeightKg - expectedWeightNow).toFixed(1));
  const direction = expectedWeeklyRateKg(goal) < 0 ? -1 : 1;
  const signedProgress = deltaKg * direction; // > 0 = further along than plan

  if (Math.abs(deltaKg) <= toleranceKg) {
    return { status: 'on_track', deltaKg, message: 'Right on the planned pace.' };
  }
  if (signedProgress > 0) {
    return { status: 'ahead', deltaKg, message: `Ahead of plan by ${Math.abs(deltaKg)}kg — don't rush past the safe rate.` };
  }
  return { status: 'behind', deltaKg, message: `Behind plan by ${Math.abs(deltaKg)}kg — tighten adherence this week.` };
}

/**
 * If the user keeps moving at their observed rate, how many more weeks to
 * the target? null when there's no usable trend or it points away from
 * the target.
 */
function projectedWeeksToTarget({ currentWeightKg, targetWeightKg, actualRateKgPerWeek }) {
  if (!currentWeightKg || !targetWeightKg || !actualRateKgPerWeek) return null;
  const remainingKg = targetWeightKg - currentWeightKg;
  if (remainingKg === 0) return 0;
  const weeks = remainingKg / actualRateKgPerWeek;
  if (!Number.isFinite(weeks) || weeks < 0) return null; // trending the wrong way
  return Number(weeks.toFixed(1));
}

/**
 * Checklist streaks. history: [{ date, ...boolean fields }] newest-first
 * (the shape GET /api/checklist/history returns). A day "counts" when at
 * least minRatio of its items are done. The current streak tolerates
 * today being incomplete (the day isn't over yet).
 */
function checklistStreaks(history, { minRatio = 0.6, today = new Date() } = {}) {
  const FIELDS = ['workout_completed', 'protein_completed', 'water_completed', 'sleep_completed', 'steps_completed'];
  const dayCounts = (row) => FIELDS.filter((f) => row[f]).length / FIELDS.length >= minRatio;

  const countedDays = new Set(
    (history || []).filter(dayCounts).map((row) => startOfDay(new Date(row.date)))
  );

  // Current streak: walk backwards day by day from today. Today itself is
  // allowed to be incomplete (the day isn't over), in which case the walk
  // starts from yesterday.
  let cursor = startOfDay(today);
  if (!countedDays.has(cursor)) cursor -= MS_PER_DAY;
  let current = 0;
  while (countedDays.has(cursor)) {
    current += 1;
    cursor -= MS_PER_DAY;
  }

  // Best streak: longest run of consecutive counted days anywhere.
  let best = 0;
  for (const dayTs of countedDays) {
    if (countedDays.has(dayTs - MS_PER_DAY)) continue; // not a run start
    let run = 1;
    while (countedDays.has(dayTs + run * MS_PER_DAY)) run += 1;
    best = Math.max(best, run);
  }
  return { current, best };
}

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

module.exports = {
  GOAL_WEEKLY_RATE_KG,
  MAX_SAFE_WEEKLY_RATE_KG,
  TIMEFRAME_BOUNDS_WEEKS,
  expectedWeeklyRateKg,
  minimumSafeTimeframeWeeks,
  resolveTimeframeWeeks,
  weeksBetween,
  expectedWeightAt,
  actualWeeklyRateKg,
  movingAverage,
  paceStatus,
  projectedWeeksToTarget,
  checklistStreaks,
};
