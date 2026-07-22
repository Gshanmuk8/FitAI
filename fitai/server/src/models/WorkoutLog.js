// workout_logs — the piece the original MVP was missing entirely.
// Records completed sets/reps so progressive overload has real data to act on.
const { queryAs } = require('../db/userAccess');

// `date` is the user's local day (migration 011). logged_at stays the exact
// instant, but every "which day was this?" question must use `date`:
// logged_at::date is the DATABASE server's day, and for anyone not on UTC
// that is the wrong day for part of every day.
async function logSet({ userId, exerciseName, weightKg, reps, setNumber, completedAllReps }, date = null) {
  const { rows } = await queryAs(userId,
    `INSERT INTO workout_logs (user_id, exercise_name, weight_kg, reps, set_number, completed_all_reps, logged_at, date)
     VALUES ($1,$2,$3,$4,$5,$6, NOW(), COALESCE($7::date, CURRENT_DATE)) RETURNING *`,
    [userId, exerciseName, weightKg, reps, setNumber, completedAllReps, date]
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
     WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)
     GROUP BY exercise_name`,
    [userId, date]
  );
  return rows;
}

// Per-day training summary for the progress analysis: how often the user
// actually trained and how much work each session held. Volume treats
// bodyweight sets (weight 0) as 0 kg — the sets/exercises counts carry them.
// Buckets by the user's local `date`, so a session appears on the same day
// as the checklist tick that recorded it — the progress prompt asks the AI
// to measure consistency off these calendar days, and a session filed under
// the wrong day reads to it as training on a rest day.
// `days` is an INCLUSIVE calendar window ending on `today`: days=28 returns
// today plus the 27 prior days. The `-(days-1)` is deliberate — `- days`
// would span days+1 calendar days, one wider than the caller's label.
async function trainingDaySummary(userId, days = 28, today = null) {
  const { rows } = await queryAs(userId,
    `SELECT date,
            COUNT(*)::int AS sets,
            COUNT(DISTINCT exercise_name)::int AS exercises,
            COALESCE(SUM(weight_kg * reps), 0)::float AS volume_kg
     FROM workout_logs
     WHERE user_id = $1 AND date >= COALESCE($3::date, CURRENT_DATE) - ($2 - 1)::int
     GROUP BY date
     ORDER BY date`,
    [userId, days, today]
  );
  return rows;
}

// Per-exercise strength history, so the coach can talk about what the user
// actually lifts ("your bench went 60 -> 70kg") instead of only how many sets
// they did. Heaviest and most recent working weight per exercise.
async function strengthByExercise(userId, days = 56, today = null) {
  const { rows } = await queryAs(userId,
    // Grouped case-insensitively: "Bench Press" and "bench press" are the same
    // lift to the user, and splitting them hides the progression.
    `SELECT MAX(exercise_name)                  AS exercise_name,
            COUNT(*)::int                       AS sets,
            MAX(weight_kg)::float               AS best_kg,
            MAX(date)                           AS last_date,
            (ARRAY_AGG(weight_kg ORDER BY date DESC, id DESC))[1]::float AS last_kg,
            (ARRAY_AGG(weight_kg ORDER BY date ASC, id ASC))[1]::float   AS first_kg
     FROM workout_logs
     WHERE user_id = $1 AND date >= COALESCE($3::date, CURRENT_DATE) - ($2 - 1)::int
     GROUP BY LOWER(TRIM(exercise_name))
     ORDER BY sets DESC
     LIMIT 12`,
    [userId, days, today]
  );
  return rows;
}

module.exports = { logSet, getLastSessionForExercise, todaySetCounts, trainingDaySummary, strengthByExercise };
