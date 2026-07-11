/**
 * Progressive overload is deterministic, not a reasoning task.
 * Keep it out of the AI path entirely.
 */

function nextWorkoutLoad({ lastWeightKg, lastReps, targetReps, completedAllSets }) {
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
