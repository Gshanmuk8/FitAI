const { logSet, getLastSessionForExercise } = require('../models/WorkoutLog');
const { suggestNextLoad } = require('../services/workout/progressionService');

async function postLogSet(req, res, next) {
  try {
    const { exerciseName, weightKg, reps, setNumber, completedAllReps } = req.body;
    const row = await logSet({
      userId: req.user.id,
      exerciseName,
      weightKg,
      reps,
      setNumber,
      completedAllReps,
    });
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

module.exports = { postLogSet, getProgression, getExerciseHistory };
