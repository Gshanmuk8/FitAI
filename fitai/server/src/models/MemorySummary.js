const { queryAs } = require('../db/userAccess');

async function listForUser(userId, limit = 50) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM memory_summaries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

module.exports = { listForUser };
