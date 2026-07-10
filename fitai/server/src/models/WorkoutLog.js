// workout_logs — the piece the original MVP was missing entirely.
// Records completed sets/reps so progressive overload has real data to act on.
const { queryAs } = require('../db/userAccess');

async function logSet({ userId, exerciseName, weightKg, reps, setNumber, completedAllReps }) {
  const { rows } = await queryAs(userId,
    `INSERT INTO workout_logs (user_id, exercise_name, weight_kg, reps, set_number, completed_all_reps, logged_at)
     VALUES ($1,$2,$3,$4,$5,$6, NOW()) RETURNING *`,
    [userId, exerciseName, weightKg, reps, setNumber, completedAllReps]
  );
  return rows[0];
}

async function getLastSessionForExercise(userId, exerciseName) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM workout_logs WHERE user_id = $1 AND exercise_name = $2
     ORDER BY logged_at DESC LIMIT 10`,
    [userId, exerciseName]
  );
  return rows;
}

// Sets already logged today, grouped by exercise — how the Workout page
// rehydrates a session after a refresh instead of restarting at 0/N.
async function todaySetCounts(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT exercise_name, COUNT(*)::int AS sets
     FROM workout_logs
     WHERE user_id = $1 AND logged_at::date = COALESCE($2::date, CURRENT_DATE)
     GROUP BY exercise_name`,
    [userId, date]
  );
  return rows;
}

// Per-day training summary for the progress analysis: how often the user
// actually trained and how much work each session held. Volume treats
// bodyweight sets (weight 0) as 0 kg — the sets/exercises counts carry them.
async function trainingDaySummary(userId, days = 28) {
  const { rows } = await queryAs(userId,
    `SELECT logged_at::date AS date,
            COUNT(*)::int AS sets,
            COUNT(DISTINCT exercise_name)::int AS exercises,
            COALESCE(SUM(weight_kg * reps), 0)::float AS volume_kg
     FROM workout_logs
     WHERE user_id = $1 AND logged_at >= CURRENT_DATE - $2::int
     GROUP BY logged_at::date
     ORDER BY logged_at::date`,
    [userId, days]
  );
  return rows;
}

module.exports = { logSet, getLastSessionForExercise, todaySetCounts, trainingDaySummary };
