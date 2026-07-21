/**
 * Lightweight RAG over plain SQL — no vector DB needed at this scale per
 * the architecture doc. Pulls the four memory tiers and lets
 * contextBuilder assemble them into a prompt-ready block.
 */
const { queryAs } = require('../../db/userAccess');

async function getPermanentMemory(userId) {
  const { rows } = await queryAs(userId,
    // Every column the coach prompts actually read. This list was missing
    // goal, sex, training_days_per_week, training_style and ai_plan, while
    // contextBuilder read all of them — so they were silently undefined in
    // EVERY prompt. That is why the coach's answers were generic (it never
    // knew the training style or day count) and why the goal fell through to
    // user_state.current_phase, a stale snapshot from plan-generation time.
    // Any column added to the context builder must be added here too.
    `SELECT age, sex, height_cm, weight_kg, target_weight_kg, activity_level,
            goal, injuries, dietary_restrictions, gym_availability,
            training_days_per_week, training_style, timeframe_weeks, ai_plan
     FROM users_profile WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getSemiPermanentMemory(userId) {
  const { rows } = await queryAs(userId,
    `SELECT current_program, calorie_target, current_phase, body_fat_estimate, current_split
     FROM user_state WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getTemporalMemory(userId, date = null) {
  // "Today" must be the USER's day — checklist rows are keyed to the user's
  // local date, so reading with server CURRENT_DATE would silently miss
  // today's row for any user whose calendar day differs from the server's.
  const { rows } = await queryAs(userId,
    `SELECT workout_completed, protein_completed, water_completed,
            sleep_completed, steps_completed
     FROM daily_checklists
     WHERE user_id = $1 AND date = COALESCE($2::date, CURRENT_DATE)`,
    [userId, date]
  );
  return rows[0] || null;
}

async function getRecentConversationalMemory(userId, limit = 20) {
  // Scored objects, importance-first: a months-old injury note must outlive
  // twenty recent chit-chat summaries. promptBuilder.enforceBudget trims
  // lowest-importance entries first when the prompt runs long, and
  // templates.formatMemoryLine renders these objects (or legacy strings).
  const { rows } = await queryAs(userId,
    `SELECT summary, category, importance, created_at FROM memory_summaries
     WHERE user_id = $1
     ORDER BY importance DESC NULLS LAST, created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map((r) => ({
    summary: r.summary,
    category: r.category || 'conversation',
    importance: r.importance ?? 1,
  }));
}

// Learned exercise preferences (behavior memory tier, structured form).
// Tolerates the table not existing yet (pre-migration deploys): degrades
// to empty rather than failing the tutor path.
async function getExercisePreferences(userId, { minStrength = 2 } = {}) {
  try {
    const { rows } = await queryAs(userId,
      `SELECT exercise_name, sentiment, strength FROM user_exercise_preferences
       WHERE user_id = $1 AND strength >= $2
       ORDER BY strength DESC LIMIT 10`,
      [userId, minStrength]
    );
    return {
      disliked: rows.filter((r) => r.sentiment === 'disliked').map((r) => r.exercise_name),
      favorite: rows.filter((r) => r.sentiment === 'favorite').map((r) => r.exercise_name),
    };
  } catch {
    return { disliked: [], favorite: [] };
  }
}

// Today's briefing (if one was generated) is the single source of pace
// truth — the tutor reads it rather than re-measuring, so "the coach knows
// your pace" stays literally true and the two AI surfaces can't disagree.
async function getTodayBriefingContext(userId, date) {
  try {
    const { getToday } = require('../../models/DailyBriefing');
    const row = await getToday(userId, date);
    return row?.briefing || null;
  } catch {
    return null; // pre-migration deploys: degrade, never fail the tutor
  }
}

async function getFullMemoryContext(userId) {
  // Resolve the user's local "today" first — temporal memory keys on it.
  const { getUserToday } = require('../../utils/userDate');
  const userDate = await getUserToday(userId);
  const [permanent, semiPermanent, temporal, conversational, exercisePreferences, todayBriefing] =
    await Promise.all([
      getPermanentMemory(userId),
      getSemiPermanentMemory(userId),
      getTemporalMemory(userId, userDate),
      getRecentConversationalMemory(userId),
      getExercisePreferences(userId),
      getTodayBriefingContext(userId, userDate),
    ]);
  return { permanent, semiPermanent, temporal, conversational, exercisePreferences, todayBriefing };
}

module.exports = {
  getPermanentMemory,
  getSemiPermanentMemory,
  getTemporalMemory,
  getRecentConversationalMemory,
  getExercisePreferences,
  getFullMemoryContext,
};
