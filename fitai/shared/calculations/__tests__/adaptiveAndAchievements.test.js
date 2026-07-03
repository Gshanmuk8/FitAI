const test = require('node:test');
const assert = require('node:assert/strict');
const { adaptTodaysPlan } = require('../adaptivePlanner');
const { evaluateAchievements, goalProgressFraction } = require('../achievements');

const workoutEntry = (name) => ({ type: 'workout', weekday: 'Tuesday', day: { name, exercises: [] } });
const restEntry = { type: 'rest', weekday: 'Tuesday' };
const checklist = (overrides = {}) => ({
  workout_completed: true,
  protein_completed: true,
  water_completed: true,
  sleep_completed: true,
  steps_completed: true,
  soreness_level: null,
  ...overrides,
});

test('missed workout + rest day today = catch-up swap', () => {
  const r = adaptTodaysPlan({
    entryToday: restEntry,
    entryYesterday: workoutEntry('Push A'),
    yesterday: checklist({ workout_completed: false }),
  });
  assert.equal(r.entry.type, 'workout');
  assert.equal(r.entry.day.name, 'Push A');
  assert.equal(r.adaptations[0].code, 'catch_up_workout');
});

test('missed workout + workout day today = no doubling up', () => {
  const r = adaptTodaysPlan({
    entryToday: workoutEntry('Pull B'),
    entryYesterday: workoutEntry('Push A'),
    yesterday: checklist({ workout_completed: false }),
  });
  assert.equal(r.entry.day.name, 'Pull B');
  assert.equal(r.adaptations[0].code, 'missed_workout');
});

test('poor sleep reduces intensity', () => {
  const r = adaptTodaysPlan({
    entryToday: workoutEntry('Legs'),
    entryYesterday: restEntry,
    yesterday: checklist({ sleep_completed: false }),
  });
  assert.equal(r.intensity, 'reduced');
  assert.ok(r.adaptations.some((a) => a.code === 'reduced_intensity'));
});

test('perfect day earns a progression nudge, but not when intensity is reduced', () => {
  const good = adaptTodaysPlan({ entryToday: workoutEntry('Push'), entryYesterday: restEntry, yesterday: checklist() });
  assert.ok(good.adaptations.some((a) => a.code === 'progression_nudge'));

  const tired = adaptTodaysPlan({
    entryToday: workoutEntry('Push'),
    entryYesterday: restEntry,
    yesterday: checklist({ sleep_completed: false }),
  });
  assert.ok(!tired.adaptations.some((a) => a.code === 'progression_nudge'));
});

test('day one (no yesterday) adapts nothing', () => {
  const r = adaptTodaysPlan({ entryToday: workoutEntry('Push'), entryYesterday: null, yesterday: null });
  assert.equal(r.intensity, 'normal');
  assert.deepEqual(r.adaptations, []);
});

test('achievements unlock at thresholds', () => {
  const codes = evaluateAchievements({
    workoutDayCount: 12,
    weighInCount: 1,
    bestStreak: 8,
    startWeightKg: 90,
    targetWeightKg: 80,
    currentWeightKg: 84.5,
  }).map((a) => a.code);
  assert.deepEqual(codes.sort(), ['FIRST_WEIGH_IN', 'FIRST_WORKOUT', 'GOAL_HALF', 'GOAL_QUARTER', 'STREAK_7', 'WORKOUTS_10'].sort());
});

test('goalProgressFraction handles missing data and wrong-direction drift', () => {
  assert.equal(goalProgressFraction({ startWeightKg: null, targetWeightKg: 80, currentWeightKg: 85 }), null);
  // drifting away from target clamps to 0, not negative
  assert.equal(goalProgressFraction({ startWeightKg: 90, targetWeightKg: 80, currentWeightKg: 92 }), 0);
});
