// achievements — unlocks are idempotent via unique(user_id, code):
// awarding an already-held achievement is a no-op, so the deterministic
// evaluator can re-run every day without guards.
const { pool } = require('../config/db');

async function listForUser(userId) {
  const { rows } = await pool.query(
    `SELECT code, name, description, unlocked_at FROM achievements
     WHERE user_id = $1 ORDER BY unlocked_at DESC`,
    [userId]
  );
  return rows;
}

// Returns only the achievements that were newly unlocked by this call.
async function awardMany(userId, earned) {
  if (!earned.length) return [];
  const newlyUnlocked = [];
  for (const a of earned) {
    const { rows } = await pool.query(
      `INSERT INTO achievements (user_id, code, name, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, code) DO NOTHING
       RETURNING code, name, description, unlocked_at`,
      [userId, a.code, a.name, a.description]
    );
    if (rows[0]) newlyUnlocked.push(rows[0]);
  }
  return newlyUnlocked;
}

module.exports = { listForUser, awardMany };
