// progress_snapshots — the "updated every 24 hours" contract lives here.
// Snapshots are computed lazily (first request of the day) and the
// unique(user_id, date) constraint makes concurrent first-requests safe:
// both compute, one inserts, both read back the same row.
const { queryAs } = require('../db/userAccess');

// All functions take an optional user-local date; null = server date.
async function getToday(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM progress_snapshots WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)`,
    [userId, date]
  );
  return rows[0] || null;
}

async function insertToday(userId, metrics, date = null) {
  await queryAs(userId,
    `INSERT INTO progress_snapshots (user_id, date, metrics)
     VALUES ($1, COALESCE($3::date, CURRENT_DATE), $2)
     ON CONFLICT (user_id, date) DO NOTHING`,
    [userId, JSON.stringify(metrics), date]
  );
  return getToday(userId, date);
}

// Called after a new weigh-in: today's numbers changed, so today's cached
// snapshot is stale. Next GET recomputes.
async function invalidateToday(userId, date = null) {
  await queryAs(userId,
    `DELETE FROM progress_snapshots WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)`,
    [userId, date]
  );
}

async function getPrevious(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM progress_snapshots WHERE user_id = $1 AND date < COALESCE($2::date, CURRENT_DATE)
     ORDER BY date DESC LIMIT 1`,
    [userId, date]
  );
  return rows[0] || null;
}

module.exports = { getToday, insertToday, invalidateToday, getPrevious };
