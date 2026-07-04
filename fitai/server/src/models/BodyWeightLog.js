// body_weight_logs — one weigh-in per user per day; same-day re-logging
// overwrites (people step on the scale twice; the latest value wins).
const { queryAs } = require('../db/userAccess');

async function upsertToday(userId, weightKg, date = null) {
  const { rows } = await queryAs(userId,
    `INSERT INTO body_weight_logs (user_id, date, weight_kg)
     VALUES ($1, COALESCE($3::date, CURRENT_DATE), $2)
     ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = EXCLUDED.weight_kg
     RETURNING *`,
    [userId, weightKg, date]
  );
  return rows[0];
}

async function listRecent(userId, days = 90) {
  const { rows } = await queryAs(userId,
    `SELECT date, weight_kg FROM body_weight_logs
     WHERE user_id = $1 AND date >= CURRENT_DATE - $2::int
     ORDER BY date ASC`,
    [userId, days]
  );
  return rows.map((r) => ({ date: r.date, weight_kg: Number(r.weight_kg) }));
}

async function countForUser(userId) {
  const { rows } = await queryAs(userId,
    `SELECT COUNT(*)::int AS count FROM body_weight_logs WHERE user_id = $1`,
    [userId]
  );
  return rows[0].count;
}

async function listBetween(userId, startDate, endDate) {
  const { rows } = await queryAs(userId,
    `SELECT date, weight_kg FROM body_weight_logs
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date ASC`,
    [userId, startDate, endDate]
  );
  return rows.map((r) => ({ date: r.date, weight_kg: Number(r.weight_kg) }));
}

module.exports = { upsertToday, listRecent, countForUser, listBetween };
