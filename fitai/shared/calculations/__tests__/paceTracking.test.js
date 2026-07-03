const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTimeframeWeeks,
  minimumSafeTimeframeWeeks,
  expectedWeightAt,
  actualWeeklyRateKg,
  movingAverage,
  paceStatus,
  projectedWeeksToTarget,
  checklistStreaks,
  weeksBetween,
} = require('../paceTracking');

test('resolveTimeframeWeeks keeps a safe request untouched', () => {
  const r = resolveTimeframeWeeks({ requestedWeeks: 16, weightKg: 90, targetWeightKg: 82, goal: 'lose_fat' });
  assert.equal(r.weeks, 16);
  assert.equal(r.adjusted, false);
});

test('resolveTimeframeWeeks extends an unsafe fat-loss timeframe', () => {
  // 20kg in 6 weeks would be >3kg/week — must clamp to >= 20 weeks (20kg / 1.0kg max rate)
  const r = resolveTimeframeWeeks({ requestedWeeks: 6, weightKg: 100, targetWeightKg: 80, goal: 'lose_fat' });
  assert.equal(r.weeks, 20);
  assert.equal(r.adjusted, true);
  assert.match(r.reason, /safe weekly rate/);
});

test('resolveTimeframeWeeks defaults to 12 when no request given', () => {
  const r = resolveTimeframeWeeks({ requestedWeeks: undefined, weightKg: 80, targetWeightKg: 78, goal: 'lose_fat' });
  assert.equal(r.weeks, 12);
});

test('resolveTimeframeWeeks enforces global bounds', () => {
  assert.equal(resolveTimeframeWeeks({ requestedWeeks: 1, goal: 'maintain' }).weeks, 4);
  assert.equal(resolveTimeframeWeeks({ requestedWeeks: 500, goal: 'maintain' }).weeks, 104);
});

test('minimumSafeTimeframeWeeks is null for goals without a weight dimension', () => {
  assert.equal(minimumSafeTimeframeWeeks({ weightKg: 80, targetWeightKg: 75, goal: 'maintain' }), null);
});

test('expectedWeightAt interpolates linearly and clamps at the target', () => {
  const args = { startWeightKg: 90, targetWeightKg: 80, timeframeWeeks: 10 };
  assert.equal(expectedWeightAt({ ...args, weeksElapsed: 0 }), 90);
  assert.equal(expectedWeightAt({ ...args, weeksElapsed: 5 }), 85);
  assert.equal(expectedWeightAt({ ...args, weeksElapsed: 25 }), 80); // past timeframe: clamp
});

test('actualWeeklyRateKg needs enough span to call it a trend', () => {
  const logs = [
    { date: '2026-06-01', weight_kg: 90 },
    { date: '2026-06-03', weight_kg: 89 },
  ];
  assert.equal(actualWeeklyRateKg(logs), null); // only 2 days apart
  logs.push({ date: '2026-06-15', weight_kg: 88 });
  assert.equal(actualWeeklyRateKg(logs), -1); // -2kg over 14 days = -1kg/week
});

test('movingAverage smooths and keeps length', () => {
  const out = movingAverage([80, 82, 81, 83], 2);
  assert.deepEqual(out, [80, 81, 81.5, 82]);
});

test('paceStatus: losing weight, under the plan line = ahead', () => {
  const r = paceStatus({ goal: 'lose_fat', expectedWeightNow: 85, currentWeightKg: 83 });
  assert.equal(r.status, 'ahead');
});

test('paceStatus: losing weight, over the plan line = behind', () => {
  const r = paceStatus({ goal: 'lose_fat', expectedWeightNow: 85, currentWeightKg: 87 });
  assert.equal(r.status, 'behind');
});

test('paceStatus: building muscle, over the plan line = ahead', () => {
  const r = paceStatus({ goal: 'build_muscle', expectedWeightNow: 72, currentWeightKg: 74 });
  assert.equal(r.status, 'ahead');
});

test('paceStatus: inside tolerance = on_track', () => {
  const r = paceStatus({ goal: 'lose_fat', expectedWeightNow: 85, currentWeightKg: 85.5 });
  assert.equal(r.status, 'on_track');
});

test('paceStatus: no weigh-ins = no_data with guidance', () => {
  const r = paceStatus({ goal: 'lose_fat', expectedWeightNow: 85, currentWeightKg: null });
  assert.equal(r.status, 'no_data');
});

test('paceStatus: maintain goal grades by adherence instead of weight', () => {
  assert.equal(paceStatus({ goal: 'maintain', adherenceRatio: 0.9 }).status, 'on_track');
  assert.equal(paceStatus({ goal: 'maintain', adherenceRatio: 0.4 }).status, 'behind');
  assert.equal(paceStatus({ goal: 'maintain', adherenceRatio: null }).status, 'no_data');
});

test('projectedWeeksToTarget returns null when trending away from target', () => {
  assert.equal(projectedWeeksToTarget({ currentWeightKg: 90, targetWeightKg: 80, actualRateKgPerWeek: 0.5 }), null);
  assert.equal(projectedWeeksToTarget({ currentWeightKg: 90, targetWeightKg: 80, actualRateKgPerWeek: -0.5 }), 20);
});

test('weeksBetween is 0 for invalid or reversed ranges', () => {
  assert.equal(weeksBetween('2026-07-01', '2026-06-01'), 0);
  assert.equal(weeksBetween('2026-06-01', '2026-06-15'), 2);
});

test('checklistStreaks counts current and best runs', () => {
  const done = { workout_completed: true, protein_completed: true, water_completed: true, sleep_completed: false, steps_completed: false };
  const missed = { workout_completed: false, protein_completed: false, water_completed: false, sleep_completed: false, steps_completed: false };
  const today = new Date('2026-07-03T12:00:00');
  const history = [
    { date: '2026-07-03', ...done },
    { date: '2026-07-02', ...done },
    { date: '2026-07-01', ...missed },
    { date: '2026-06-30', ...done },
    { date: '2026-06-29', ...done },
    { date: '2026-06-28', ...done },
  ];
  const { current, best } = checklistStreaks(history, { today });
  assert.equal(current, 2);
  assert.equal(best, 3);
});
