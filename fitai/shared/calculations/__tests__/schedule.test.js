const test = require('node:test');
const assert = require('node:assert/strict');
const { weeklySchedule, todaysPlanEntry } = require('../schedule');
const { buildDietTargets, DIET_EDIT_BOUNDS } = require('../dietTargets');

const day = (name) => ({ name, exercises: [{ name: 'Squat', sets: 3, reps: 8 }] });

test('weeklySchedule spreads 3 workout days with rest between', () => {
  const slots = weeklySchedule([day('A'), day('B'), day('C')]);
  assert.equal(slots.length, 7);
  const workoutIdx = slots.map((s, i) => (s.type === 'workout' ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(workoutIdx, [0, 2, 4]); // Mon, Wed, Fri
  assert.equal(slots.filter((s) => s.type === 'rest').length, 4);
});

test('weeklySchedule handles empty and 7-day plans', () => {
  assert.equal(weeklySchedule([]).every((s) => s.type === 'rest'), true);
  const full = weeklySchedule([1, 2, 3, 4, 5, 6, 7].map((n) => day(`D${n}`)));
  assert.equal(full.every((s) => s.type === 'workout'), true);
});

test('todaysPlanEntry is deterministic per weekday', () => {
  const days = [day('Push'), day('Pull'), day('Legs')];
  const monday = new Date('2026-06-29T10:00:00'); // a Monday
  const tuesday = new Date('2026-06-30T10:00:00');
  assert.equal(todaysPlanEntry(days, monday).type, 'workout');
  assert.equal(todaysPlanEntry(days, monday).day.name, 'Push');
  assert.equal(todaysPlanEntry(days, tuesday).type, 'rest');
  assert.equal(todaysPlanEntry(days, tuesday).weekday, 'Tuesday');
});

test('buildDietTargets produces exact rules-engine numbers', () => {
  const t = buildDietTargets({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderately_active', goal: 'lose_fat' });
  // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780; TDEE = 1780*1.55 = 2759; -500 = 2259
  assert.equal(t.calorieTarget, 2259);
  assert.equal(t.proteinGrams, 145); // 80 * 1.8 = 144 -> rounded to nearest 5
  assert.equal(t.waterMl, 2750); // 80*35=2800 -> rounded to 250 step
  assert.equal(t.stepsTarget, 10000);
});

test('diet edit bounds exist for every editable field', () => {
  for (const key of ['calorieTarget', 'proteinGrams', 'waterMl', 'stepsTarget', 'sleepHours']) {
    assert.ok(DIET_EDIT_BOUNDS[key].min < DIET_EDIT_BOUNDS[key].max);
  }
});
