// Wraps the pure rule function with the DB lookups it needs. Progressive
// overload itself stays formula-based (shared/calculations/workoutRules.js) —
// this file's only job is fetching last session data, never calling the AI.
const { getLastSessionForExercise } = require('../../models/WorkoutLog');
const { nextWorkoutLoad } = require('../../../../shared/calculations/workoutRules');

async function suggestNextLoad(userId, exerciseName, targetReps) {
  const lastSessions = await getLastSessionForExercise(userId, exerciseName);
  if (lastSessions.length === 0) {
    return { weightKg: null, note: 'No prior data — start at a comfortable weight for 12-15 reps.' };
  }
  const last = lastSessions[0];
  return nextWorkoutLoad({
    lastWeightKg: last.weight_kg,
    lastReps: last.reps,
    targetReps,
    completedAllSets: last.completed_all_reps,
  });
}

module.exports = { suggestNextLoad };
