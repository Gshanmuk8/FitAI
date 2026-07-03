// workout_logs — the piece the original MVP was missing entirely.
// Records completed sets/reps so progressive overload has real data to act on.
const { pool } = require('../config/db');

async function logSet({ userId, exerciseName, weightKg, reps, setNumber, completedAllReps }) {
  const { rows } = await pool.query(
    `INSERT INTO workout_logs (user_id, exercise_name, weight_kg, reps, set_number, completed_all_reps, logged_at)
     VALUES ($1,$2,$3,$4,$5,$6, NOW()) RETURNING *`,
    [userId, exerciseName, weightKg, reps, setNumber, completedAllReps]
  );
  return rows[0];
}

async function getLastSessionForExercise(userId, exerciseName) {
  const { rows } = await pool.query(
    `SELECT * FROM workout_logs WHERE user_id = $1 AND exercise_name = $2
     ORDER BY logged_at DESC LIMIT 10`,
    [userId, exerciseName]
  );
  return rows;
}

// Distinct training days — the unit achievements and consistency use
// ("logged sets on N days"), not raw set count.
async function countDistinctWorkoutDays(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT logged_at::date)::int AS count FROM workout_logs WHERE user_id = $1`,
    [userId]
  );
  return rows[0].count;
}

// Aggregate training stats for a date range (weekly/monthly reviews):
// distinct training days, total sets, and total volume (kg × reps).
async function statsBetween(userId, startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT logged_at::date)::int AS workout_days,
            COUNT(*)::int AS total_sets,
            COALESCE(SUM(weight_kg * reps), 0)::float AS total_volume_kg
     FROM workout_logs
     WHERE user_id = $1 AND logged_at::date >= $2 AND logged_at::date <= $3`,
    [userId, startDate, endDate]
  );
  return rows[0];
}

module.exports = { logSet, getLastSessionForExercise, countDistinctWorkoutDays, statsBetween };
