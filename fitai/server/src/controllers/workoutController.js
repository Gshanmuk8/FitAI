const { logSet, getLastSessionForExercise, todaySetCounts } = require('../models/WorkoutLog');
const { suggestNextLoad } = require('../services/workout/progressionService');
const { getUserToday } = require('../utils/userDate');

async function postLogSet(req, res, next) {
  try {
    const { exerciseName, weightKg, reps, setNumber, completedAllReps } = req.body;
    // Stamped with the user's local day, not the DB server's, so the set
    // rehydrates on the same day the user believes they trained.
    const row = await logSet({
      userId: req.user.id,
      exerciseName,
      weightKg,
      reps,
      setNumber,
      completedAllReps,
    }, await getUserToday(req.user.id));
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function getProgression(req, res, next) {
  try {
    const { exercise } = req.params;
    const targetReps = { min: Number(req.query.repsMin) || 8, max: Number(req.query.repsMax) || 12 };
    const suggestion = await suggestNextLoad(req.user.id, exercise, targetReps);
    res.json(suggestion);
  } catch (err) {
    next(err);
  }
}

async function getExerciseHistory(req, res, next) {
  try {
    const history = await getLastSessionForExercise(req.user.id, req.params.exercise);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

// { "Bench Press": 3, ... } — sets logged today, for session rehydration.
async function getTodaySets(req, res, next) {
  try {
    const rows = await todaySetCounts(req.user.id, await getUserToday(req.user.id));
    res.json(Object.fromEntries(rows.map((r) => [r.exercise_name, r.sets])));
  } catch (err) {
    next(err);
  }
}

module.exports = { postLogSet, getProgression, getExerciseHistory, getTodaySets };
