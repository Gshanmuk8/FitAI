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

// The figures whose provenance we track (migration 011). Only these two can
// be written by BOTH the user typing and the meal diary syncing, so only
// these two need to remember which one owns the day's number.
const SOURCED_FIELDS = ['protein_grams', 'calories_kcal'];

// `source` ('manual' | 'diary') records who wrote the sourced fields in this
// call, merged into values_source so a later writer can decide whether it is
// allowed to overwrite. Omitted (null) leaves provenance untouched — used by
// writes that aren't value entry, like the plan-edit completion refresh.
async function updateChecklistFields(userId, fields, date = null, source = null) {
  const keys = Object.keys(fields).filter((k) => WRITABLE_FIELDS.has(k));
  if (!keys.length) return getToday(userId, date);

  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const params = keys.map((k) => fields[k]);

  const touched = source ? keys.filter((k) => SOURCED_FIELDS.includes(k)) : [];
  const sourcePatch = Object.fromEntries(touched.map((k) => [k, source]));
  // `||` on jsonb merges right-biased, so this updates only the keys in the
  // patch and leaves any other provenance in place.
  const sourceClause = touched.length
    ? `, values_source = COALESCE(values_source, '{}'::jsonb) || $${keys.length + 3}::jsonb`
    : '';

  const { rows } = await queryAs(userId,
    `UPDATE daily_checklists SET ${setClause}${sourceClause}
     WHERE user_id = $${keys.length + 1} AND date = COALESCE($${keys.length + 2}::date, CURRENT_DATE)
     RETURNING *`,
    touched.length
      ? [...params, userId, date, JSON.stringify(sourcePatch)]
      : [...params, userId, date]
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

// The day's user-authored items. These three mutate the jsonb array IN SQL
// rather than read-modify-writing it in JS.
//
// The old wholesale-replace lost updates: two tabs (or a StrictMode double
// mount) each read the array, each write back their own version, and the
// second write silently erases the first — the new item just vanishes,
// behind a 200. Doing the mutation inside the UPDATE means each statement
// composes against whatever the row holds at execution time.

// Append, but only while under the cap — enforced in SQL so two concurrent
// adds can't both pass a JS-side length check and land 13 items.
async function appendCustomItem(userId, item, max, date = null) {
  const { rows } = await queryAs(userId,
    `UPDATE daily_checklists
     SET custom_items = COALESCE(custom_items, '[]'::jsonb) || $1::jsonb
     WHERE user_id = $2 AND date = COALESCE($3::date, CURRENT_DATE)
       AND jsonb_array_length(COALESCE(custom_items, '[]'::jsonb)) < $4
     RETURNING *`,
    [JSON.stringify([item]), userId, date, max]
  );
  return rows[0] || null; // null = the cap rejected it
}

// Rebuild the array with the matching element's `done` flipped, preserving
// order and every other element as stored.
async function setCustomItemDoneById(userId, itemId, done, date = null) {
  const { rows } = await queryAs(userId,
    `UPDATE daily_checklists
     SET custom_items = (
       SELECT COALESCE(jsonb_agg(
                CASE WHEN elem->>'id' = $1 THEN jsonb_set(elem, '{done}', to_jsonb($2::boolean)) ELSE elem END
                ORDER BY ord
              ), '[]'::jsonb)
       FROM jsonb_array_elements(COALESCE(custom_items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
     )
     WHERE user_id = $3 AND date = COALESCE($4::date, CURRENT_DATE)
       AND COALESCE(custom_items, '[]'::jsonb) @> $5::jsonb
     RETURNING *`,
    [itemId, done, userId, date, JSON.stringify([{ id: itemId }])]
  );
  return rows[0] || null; // null = no such item today
}

async function removeCustomItemById(userId, itemId, date = null) {
  const { rows } = await queryAs(userId,
    `UPDATE daily_checklists
     SET custom_items = (
       SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
       FROM jsonb_array_elements(COALESCE(custom_items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
       WHERE elem->>'id' <> $1
     )
     WHERE user_id = $2 AND date = COALESCE($3::date, CURRENT_DATE)
       AND COALESCE(custom_items, '[]'::jsonb) @> $4::jsonb
     RETURNING *`,
    [itemId, userId, date, JSON.stringify([{ id: itemId }])]
  );
  return rows[0] || null;
}

// The user's day can move FORWARD (midnight, or travelling east) but must
// never move backward. A user who flies Kolkata -> New York has their local
// date go from 07-22 back to 07-21 mid-flight; without this clamp every
// subsequent write that day lands on 07-21 — a day that is already finished
// and full of data — inflating its totals, re-deriving its completions, and
// orphaning the real 07-22 row where nothing can reach it.
//
// GREATEST ignores NULLs in Postgres, so a user with no rows yet simply
// gets their local date back. One indexed aggregate on (user_id, date).
async function effectiveDate(userId, localDate = null) {
  const { rows } = await queryAs(userId,
    `SELECT to_char(GREATEST(COALESCE($2::date, CURRENT_DATE), MAX(date)), 'YYYY-MM-DD') AS date
     FROM daily_checklists WHERE user_id = $1`,
    [userId, localDate]
  );
  return rows[0]?.date || localDate;
}

async function getHistory(userId, days = 14) {
  const { rows } = await queryAs(userId,
    `SELECT * FROM daily_checklists WHERE user_id = $1 ORDER BY date DESC LIMIT $2`,
    [userId, days]
  );
  return rows;
}

module.exports = {
  getToday, insertToday, getYesterday, updateChecklistItem, updateChecklistFields,
  appendCustomItem, setCustomItemDoneById, removeCustomItemById,
  setPlanSnapshot, getHistory, effectiveDate,
};
