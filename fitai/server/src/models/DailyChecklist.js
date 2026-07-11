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
const { queryAs } = require('../db/userAccess');

async function getToday(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM daily_checklists WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)`,
    [userId, date]
  );
  return rows[0] || null;
}

// ON CONFLICT DO NOTHING + re-select: two concurrent first-requests of the
// day both succeed and read back the same row instead of one 500ing.
async function insertToday(userId, planSnapshot = null, date = null) {
  await queryAs(userId,
    `INSERT INTO daily_checklists (user_id, date, plan_snapshot)
     VALUES ($1, COALESCE($3::date, CURRENT_DATE), $2)
     ON CONFLICT (user_id, date) DO NOTHING`,
    [userId, planSnapshot ? JSON.stringify(planSnapshot) : null, date]
  );
  return getToday(userId, date);
}

async function getYesterday(userId, date = null) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM daily_checklists WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE) - 1`,
    [userId, date]
  );
  return rows[0] || null;
}

async function updateChecklistItem(userId, field, value, date = null) {
  const allowed = ['workout_completed', 'protein_completed', 'calories_completed', 'water_completed', 'sleep_completed', 'steps_completed'];
  if (!allowed.includes(field)) throw new Error(`Invalid checklist field: ${field}`);

  const { rows } = await queryAs(userId,
    `UPDATE daily_checklists SET ${field} = $1
     WHERE user_id = $2 AND date = COALESCE($3::date, CURRENT_DATE) RETURNING *`,
    [value, userId, date]
  );
  return rows[0];
}

// Manual value entry (protein grams, water, sleep, steps, weigh-in, notes)
// plus the derived *_completed booleans. Every key is checked against a
// fixed whitelist before it reaches the SQL, so the column list is never
// user-controlled even though it's interpolated.
const WRITABLE_FIELDS = new Set([
  'workout_completed', 'protein_completed', 'calories_completed', 'water_completed', 'sleep_completed', 'steps_completed',
  'protein_grams', 'calories_kcal', 'water_ml', 'sleep_hours', 'steps_count', 'weight_kg', 'notes',
]);

async function updateChecklistFields(userId, fields, date = null) {
  const keys = Object.keys(fields).filter((k) => WRITABLE_FIELDS.has(k));
  if (!keys.length) return getToday(userId, date);

  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const params = keys.map((k) => fields[k]);
  const { rows } = await queryAs(userId,
    `UPDATE daily_checklists SET ${setClause}
     WHERE user_id = $${keys.length + 1} AND date = COALESCE($${keys.length + 2}::date, CURRENT_DATE)
     RETURNING *`,
    [...params, userId, date]
  );
  return rows[0];
}

// Rebuild the day's frozen plan snapshot in place (plan edited/regenerated
// mid-day). Completion flags, logged values, and custom items live in their
// own columns and are deliberately untouched.
async function setPlanSnapshot(userId, snapshot, date = null) {
  const { rows } = await queryAs(userId,
    `UPDATE daily_checklists SET plan_snapshot = $1
     WHERE user_id = $2 AND date = COALESCE($3::date, CURRENT_DATE) RETURNING *`,
    [snapshot ? JSON.stringify(snapshot) : null, userId, date]
  );
  return rows[0];
}

// Replace the day's user-authored items wholesale. Callers (checklistService)
// do read-modify-write on the array — fine for a single user's own row, and
// it keeps toggle/remove out of awkward jsonb-path SQL.
async function setCustomItems(userId, items, date = null) {
  const { rows } = await queryAs(userId,
    `UPDATE daily_checklists SET custom_items = $1
     WHERE user_id = $2 AND date = COALESCE($3::date, CURRENT_DATE) RETURNING *`,
    [JSON.stringify(items), userId, date]
  );
  return rows[0];
}

async function getHistory(userId, days = 14) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM daily_checklists WHERE user_id = $1 ORDER BY date DESC LIMIT $2`,
    [userId, days]
  );
  return rows;
}

module.exports = { getToday, insertToday, getYesterday, updateChecklistItem, updateChecklistFields, setCustomItems, setPlanSnapshot, getHistory };
