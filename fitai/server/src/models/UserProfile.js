// Thin data-access layer over the users_profile table (permanent memory tier).
const { pool } = require('../config/db');

async function upsertProfile(userId, profile) {
  const {
    age, heightCm, weightKg, targetWeightKg, goal, activityLevel,
    injuries, dietaryRestrictions, gymAvailability, sex, timeframeWeeks, timezone,
  } = profile;
  const { rows } = await pool.query(
    `INSERT INTO users_profile (user_id, age, height_cm, weight_kg, target_weight_kg, goal, activity_level,
                                injuries, dietary_restrictions, gym_availability, sex, timeframe_weeks, timezone, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       age = EXCLUDED.age, height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg,
       target_weight_kg = EXCLUDED.target_weight_kg, goal = EXCLUDED.goal,
       activity_level = EXCLUDED.activity_level, injuries = EXCLUDED.injuries,
       dietary_restrictions = EXCLUDED.dietary_restrictions, gym_availability = EXCLUDED.gym_availability,
       sex = EXCLUDED.sex, timeframe_weeks = EXCLUDED.timeframe_weeks,
       timezone = COALESCE(EXCLUDED.timezone, users_profile.timezone),
       updated_at = NOW()
     RETURNING *`,
    [userId, age, heightCm, weightKg, targetWeightKg, goal, activityLevel,
     injuries, dietaryRestrictions, gymAvailability, sex ?? null, timeframeWeeks ?? null, timezone ?? null]
  );
  return rows[0];
}

// restartClock: true for onboarding/regeneration (a NEW plan starts the
// goal timeline now); false for user edits (tweaking exercises must not
// reset "week 6 of 16" back to week 1).
async function savePlan(userId, plan, { restartClock = true } = {}) {
  const { rows } = await pool.query(
    `UPDATE users_profile SET
       ai_plan = $1,
       onboarding_completed = true,
       plan_started_at = CASE WHEN $3 THEN NOW() ELSE COALESCE(plan_started_at, NOW()) END,
       updated_at = NOW()
     WHERE user_id = $2 RETURNING *`,
    [JSON.stringify(plan), userId, restartClock]
  );
  return rows[0];
}

async function getProfile(userId) {
  const { rows } = await pool.query('SELECT * FROM users_profile WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

// Partial update for profile edits (Profile page): only the provided
// fields change, the plan and goal clock are untouched. Column names come
// from this whitelist, never from user input.
const EDITABLE_COLUMNS = {
  age: 'age',
  heightCm: 'height_cm',
  weightKg: 'weight_kg',
  targetWeightKg: 'target_weight_kg',
  goal: 'goal',
  activityLevel: 'activity_level',
  injuries: 'injuries',
  dietaryRestrictions: 'dietary_restrictions',
  gymAvailability: 'gym_availability',
  sex: 'sex',
  timeframeWeeks: 'timeframe_weeks',
  timezone: 'timezone',
};

async function updateProfileFields(userId, fields) {
  const entries = Object.entries(fields).filter(([key, v]) => EDITABLE_COLUMNS[key] && v !== undefined);
  if (!entries.length) return getProfile(userId);

  const setClauses = entries.map(([key], i) => `${EDITABLE_COLUMNS[key]} = $${i + 2}`);
  const values = entries.map(([, v]) => v);
  const { rows } = await pool.query(
    `UPDATE users_profile SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE user_id = $1 RETURNING *`,
    [userId, ...values]
  );
  return rows[0] || null;
}

module.exports = { upsertProfile, savePlan, getProfile, updateProfileFields };
