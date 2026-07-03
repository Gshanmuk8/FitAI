// daily_checklists table — the "Today's Mission" tracker. One row per
// user per day; midnight rollover happens by simply inserting a new row
// for the new date, leaving yesterday's row immutable history. Each row
// carries a plan_snapshot: the concrete targets (workout day, protein
// grams, etc.) the day was generated with, so history stays truthful even
// after the user edits their plan.
//
// Every function takes an optional `date` (YYYY-MM-DD, the user's local
// "today" from utils/userDate). Null falls back to the server's
// CURRENT_DATE — identical to pre-004 behavior.
const { pool } = require('../config/db');

async function getToday(userId, date = null) {
  const { rows } = await pool.query(
    `SELECT * FROM daily_checklists WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)`,
    [userId, date]
  );
  return rows[0] || null;
}

// ON CONFLICT DO NOTHING + re-select: two concurrent first-requests of the
// day both succeed and read back the same row instead of one 500ing.
async function insertToday(userId, planSnapshot = null, date = null) {
  await pool.query(
    `INSERT INTO daily_checklists (user_id, date, plan_snapshot)
     VALUES ($1, COALESCE($3::date, CURRENT_DATE), $2)
     ON CONFLICT (user_id, date) DO NOTHING`,
    [userId, planSnapshot ? JSON.stringify(planSnapshot) : null, date]
  );
  return getToday(userId, date);
}

async function getYesterday(userId, date = null) {
  const { rows } = await pool.query(
    `SELECT * FROM daily_checklists WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE) - 1`,
    [userId, date]
  );
  return rows[0] || null;
}

async function updateChecklistItem(userId, field, value, date = null) {
  const allowed = ['workout_completed', 'protein_completed', 'water_completed', 'sleep_completed', 'steps_completed'];
  if (!allowed.includes(field)) throw new Error(`Invalid checklist field: ${field}`);

  const { rows } = await pool.query(
    `UPDATE daily_checklists SET ${field} = $1
     WHERE user_id = $2 AND date = COALESCE($3::date, CURRENT_DATE) RETURNING *`,
    [value, userId, date]
  );
  return rows[0];
}

async function getHistory(userId, days = 14) {
  const { rows } = await pool.query(
    `SELECT * FROM daily_checklists WHERE user_id = $1 ORDER BY date DESC LIMIT $2`,
    [userId, days]
  );
  return rows;
}

async function getRange(userId, startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT * FROM daily_checklists
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date ASC`,
    [userId, startDate, endDate]
  );
  return rows;
}

module.exports = { getToday, insertToday, getYesterday, updateChecklistItem, getHistory, getRange };
