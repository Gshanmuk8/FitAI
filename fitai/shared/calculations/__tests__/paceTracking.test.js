const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTimeframeWeeks,
  minimumSafeTimeframeWeeks,
  expectedWeightAt,
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
