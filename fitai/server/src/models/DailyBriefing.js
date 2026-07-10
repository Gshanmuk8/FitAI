// daily_briefings — the AI's once-per-day progress briefing, cached one row
// per user per local day (see migration 006). The service computes it lazily
// on the first dashboard load of the day and reuses it for 24h.
const { queryAs } = require('../db/userAccess');

async function getToday(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT date, briefing FROM daily_briefings
     WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)`,
    [userId, date]
  );
  return rows[0] || null;
}

// Upsert: a same-day recompute (e.g. after the fallback path finally reaches
// the AI) overwrites in place rather than racing on the primary key.
async function upsertToday(userId, briefing, date = null) {
  const { rows } = await queryAs(userId,
    `INSERT INTO daily_briefings (user_id, date, briefing)
     VALUES ($1, COALESCE($3::date, CURRENT_DATE), $2)
     ON CONFLICT (user_id, date) DO UPDATE SET briefing = EXCLUDED.briefing
     RETURNING date, briefing`,
    [userId, JSON.stringify(briefing), date]
  );
  return rows[0] || null;
}

module.exports = { getToday, upsertToday };
