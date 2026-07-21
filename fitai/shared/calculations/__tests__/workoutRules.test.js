const { test } = require('node:test');
const assert = require('node:assert');
const { nextWorkoutLoad, checklistScore } = require('../workoutRules');

const targetReps = { min: 8, max: 12 };

test('hitting the top of the rep range earns +2.5kg', () => {
  const r = nextWorkoutLoad({ lastWeightKg: 60, lastReps: 12, targetReps, completedAllSets: true });
  assert.equal(r.weightKg, 62.5);
});

test('incomplete sets repeat the weight', () => {
  const r = nextWorkoutLoad({ lastWeightKg: 60, lastReps: 12, targetReps, completedAllSets: false });
  assert.equal(r.weightKg, 60);
});

test('mid-range reps hold the weight and ask for more reps', () => {
  const r = nextWorkoutLoad({ lastWeightKg: 60, lastReps: 9, targetReps, completedAllSets: true });
  assert.equal(r.weightKg, 60);
});

// Regression: weight_kg is nullable and bodyweight movements legitimately
// carry no load. null + 2.5 evaluates to 2.5, so the coach used to tell
// people to add 2.5kg to their push-ups.
test('a set logged with no weight does not invent a 2.5kg load', () => {
  const r = nextWorkoutLoad({ lastWeightKg: null, lastReps: 15, targetReps, completedAllSets: true });
  assert.equal(r.weightKg, null);
  assert.match(r.note, /no load recorded/i);
});

test('undefined weight is treated the same as null', () => {
  const r = nextWorkoutLoad({ lastWeightKg: undefined, lastReps: 15, targetReps, completedAllSets: true });
  assert.equal(r.weightKg, null);
});

test('checklistScore counts all six plan items', () => {
  const s = checklistScore({ workout_completed: true, protein_completed: true });
  assert.equal(s.total, 6);
  assert.equal(s.completed, 2);
  assert.ok(s.ratio > 0.33 && s.ratio < 0.34);
});
