// user_state — the semi-permanent memory tier (current program, calorie
// target). 002 starts actually writing it: plan generation and plan edits
// keep it in sync so the tutor's context block reflects reality.
const { queryAs } = require('../db/userAccess');

async function upsertUserState(userId, { currentProgram, calorieTarget, currentPhase }) {
  const { rows } = await queryAs(userId,
    `INSERT INTO user_state (user_id, current_program, calorie_target, current_phase, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       current_program = COALESCE(EXCLUDED.current_program, user_state.current_program),
       calorie_target = COALESCE(EXCLUDED.calorie_target, user_state.calorie_target),
       current_phase = COALESCE(EXCLUDED.current_phase, user_state.current_phase),
       updated_at = NOW()
     RETURNING *`,
    [userId, currentProgram ?? null, calorieTarget ?? null, currentPhase ?? null]
  );
  return rows[0];
}

module.exports = { upsertUserState };
