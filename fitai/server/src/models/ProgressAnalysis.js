// progress_analyses — the AI's daily progress review, one row per user per
// local day. input_hash fingerprints the data the analysis was computed
// from; a new weigh-in/workout/meal the same day changes the hash and the
// next GET recomputes instead of serving a stale read of the journey.
const { queryAs } = require('../db/userAccess');

async function getToday(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM progress_analyses WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)`,
    [userId, date]
  );
  return rows[0] || null;
}

async function upsertToday(userId, { analysis, inputHash }, date = null) {
  const { rows } = await queryAs(userId,
    `INSERT INTO progress_analyses (user_id, date, input_hash, analysis)
     VALUES ($1, COALESCE($4::date, CURRENT_DATE), $2, $3)
     ON CONFLICT (user_id, date) DO UPDATE SET
       input_hash = EXCLUDED.input_hash, analysis = EXCLUDED.analysis, created_at = NOW()
     RETURNING *`,
    [userId, inputHash, JSON.stringify(analysis), date]
  );
  return rows[0];
}

module.exports = { getToday, upsertToday };
