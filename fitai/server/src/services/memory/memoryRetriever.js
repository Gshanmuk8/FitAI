/**
 * Lightweight RAG over plain SQL — no vector DB needed at this scale per
 * the architecture doc. Pulls the four memory tiers and lets
 * contextBuilder assemble them into a prompt-ready block.
 */
const { queryAs } = require('../../db/userAccess');

async function getPermanentMemory(userId) {
  const { rows } = await queryAs(userId,
    `SELECT age, height_cm, weight_kg, target_weight_kg, activity_level,
            injuries, dietary_restrictions, gym_availability
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

async function getTemporalMemory(userId) {
  const { rows } = await queryAs(userId,
    `SELECT workout_completed, protein_completed, water_completed,
            sleep_completed, steps_completed, mood, soreness_level
     FROM daily_checklists
     WHERE user_id = $1 AND date = CURRENT_DATE`,
    [userId]
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

// The latest daily progress snapshot (if the feature has produced one) —
// this is how the tutor knows whether the user is ahead/on-track/behind.
// Both helpers below tolerate the 002 tables not existing yet (pre-migration
// deploys): they degrade to null/empty rather than failing the tutor path.
async function getLatestProgressSnapshot(userId) {
  try {
    const { rows } = await queryAs(userId,
      `SELECT date, metrics FROM progress_snapshots
       WHERE user_id = $1 ORDER BY date DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// Learned exercise preferences (behavior memory tier, structured form).
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

async function getFullMemoryContext(userId) {
  const [permanent, semiPermanent, temporal, conversational, progressSnapshot, exercisePreferences] =
    await Promise.all([
      getPermanentMemory(userId),
      getSemiPermanentMemory(userId),
      getTemporalMemory(userId),
      getRecentConversationalMemory(userId),
      getLatestProgressSnapshot(userId),
      getExercisePreferences(userId),
    ]);
  return { permanent, semiPermanent, temporal, conversational, progressSnapshot, exercisePreferences };
}

module.exports = {
  getPermanentMemory,
  getSemiPermanentMemory,
  getTemporalMemory,
  getRecentConversationalMemory,
  getLatestProgressSnapshot,
  getExercisePreferences,
  getFullMemoryContext,
};
