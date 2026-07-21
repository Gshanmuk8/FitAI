/**
 * Progressive overload is deterministic, not a reasoning task.
 * Keep it out of the AI path entirely.
 */

function nextWorkoutLoad({ lastWeightKg, lastReps, targetReps, completedAllSets }) {
  // weight_kg is nullable, and bodyweight movements legitimately carry no
  // load. Without this, null + 2.5 evaluates to 2.5 and the coach tells
  // someone to add 2.5 kg to their push-ups.
  if (lastWeightKg == null) {
    return { weightKg: null, note: 'No load recorded last time — log the weight you use and progression starts from there.' };
  }
  if (!completedAllSets) {
    return { weightKg: lastWeightKg, note: 'Repeat weight — sets incomplete last session.' };
  }
  if (lastReps >= targetReps.max) {
    return { weightKg: Number((lastWeightKg + 2.5).toFixed(1)), note: 'Increase load 2.5kg.' };
  }
  return { weightKg: lastWeightKg, note: 'Same weight, aim for more reps in target range.' };
}

function checklistScore(checklist) {
  const keys = [
    'workout_completed',
    'protein_completed',
    'calories_completed',
    'water_completed',
    'sleep_completed',
    'steps_completed',
  ];
  const completed = keys.filter((k) => checklist[k]).length;
  return { completed, total: keys.length, ratio: completed / keys.length };
}

module.exports = { nextWorkoutLoad, checklistScore };
