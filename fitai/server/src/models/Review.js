// reviews — one immutable row per user/period. Generated lazily for
// completed periods; unique(user_id, period_type, period_start) makes
// concurrent generation race-safe (insert-if-absent, then read back).
const { pool } = require('../config/db');

async function getReview(userId, periodType, periodStart) {
  const { rows } = await pool.query(
    `SELECT * FROM reviews WHERE user_id = $1 AND period_type = $2 AND period_start = $3`,
    [userId, periodType, periodStart]
  );
  return rows[0] || null;
}

async function insertReview(userId, { periodType, periodStart, periodEnd, data, narrative }) {
  await pool.query(
    `INSERT INTO reviews (user_id, period_type, period_start, period_end, data, narrative)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, period_type, period_start) DO NOTHING`,
    [userId, periodType, periodStart, periodEnd, JSON.stringify(data), narrative ? JSON.stringify(narrative) : null]
  );
  return getReview(userId, periodType, periodStart);
}

async function listRecent(userId, periodType, limit = 12) {
  const { rows } = await pool.query(
    `SELECT * FROM reviews WHERE user_id = $1 AND period_type = $2
     ORDER BY period_start DESC LIMIT $3`,
    [userId, periodType, limit]
  );
  return rows;
}

module.exports = { getReview, insertReview, listRecent };
