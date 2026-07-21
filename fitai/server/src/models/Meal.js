// meals — the daily food diary. One row per eaten item; totals are
// aggregated per day for the nutrition loop.
const { queryAs } = require('../db/userAccess');

// All functions take an optional user-local date (YYYY-MM-DD); null falls
// back to the server's CURRENT_DATE.
async function insertMeal(userId, { name, grams, calories, protein, carbs, fat, source }, date = null) {
  const { rows } = await queryAs(userId,
    `INSERT INTO meals (user_id, name, grams, calories, protein, carbs, fat, source, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE)) RETURNING *`,
    // calories is an integer column; round rather than reject a fractional
    // figure the vision analyzer legitimately produces.
    [userId, name, grams ?? null, Math.round(calories), protein ?? 0, carbs ?? null, fat ?? null, source || 'manual', date]
  );
  return rows[0];
}

async function listToday(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM meals WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE) ORDER BY created_at ASC`,
    [userId, date]
  );
  return rows;
}

async function todayTotals(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT COALESCE(SUM(calories), 0)::int AS calories,
            COALESCE(SUM(protein), 0)::float AS protein,
            COUNT(*)::int AS meals
     FROM meals WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)`,
    [userId, date]
  );
  return rows[0];
}

// Same-day only: the diary is editable while the day is live, history is
// immutable — consistent with how daily_checklists behaves.
async function deleteMeal(userId, mealId, date = null) {
  const { rowCount } = await queryAs(userId,
    `DELETE FROM meals WHERE id = $1 AND user_id = $2 AND date = COALESCE($3::date, CURRENT_DATE)`,
    [mealId, userId, date]
  );
  return rowCount > 0;
}

// Per-day diary totals for the progress analysis — what the user actually
// logged, day by day, not just today.
async function dailyTotalsRecent(userId, days = 14, today = null) {
  const { rows } = await queryAs(userId,
    `SELECT date,
            COALESCE(SUM(calories), 0)::int AS calories,
            COALESCE(SUM(protein), 0)::float AS protein,
            COUNT(*)::int AS meals
     FROM meals
     WHERE user_id = $1 AND date >= COALESCE($3::date, CURRENT_DATE) - $2::int
     GROUP BY date
     ORDER BY date`,
    [userId, days, today]
  );
  return rows;
}

module.exports = { insertMeal, listToday, todayTotals, deleteMeal, dailyTotalsRecent };
