// user_exercise_preferences — structured behavior memory. Strength counts
// how many times the signal repeated (removed running 3 times = strength 3);
// retrieval thresholds on strength so one-off edits don't become dogma.
const { pool } = require('../config/db');

async function bumpPreference(userId, exerciseName, sentiment) {
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) return null;
  const { rows } = await pool.query(
    `INSERT INTO user_exercise_preferences (user_id, exercise_name, sentiment, strength, updated_at)
     VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (user_id, exercise_name) DO UPDATE SET
       -- flipping sentiment resets the counter: "removed it twice, then
       -- added it back" should not read as strength-3 dislike
       strength = CASE WHEN user_exercise_preferences.sentiment = EXCLUDED.sentiment
                       THEN user_exercise_preferences.strength + 1 ELSE 1 END,
       sentiment = EXCLUDED.sentiment,
       updated_at = NOW()
     RETURNING *`,
    [userId, normalized, sentiment]
  );
  return rows[0];
}

module.exports = { bumpPreference };
