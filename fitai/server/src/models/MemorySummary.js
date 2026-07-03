const { pool } = require('../config/db');

async function listForUser(userId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT * FROM memory_summaries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

module.exports = { listForUser };
