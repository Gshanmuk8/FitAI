module.exports = {
  GOALS: ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance'],
  ACTIVITY_LEVELS: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'],
  TUTOR_MODES: ['gym', 'diet', 'recovery'],
  CONFIDENCE_LOW_THRESHOLD: 0.6,

  // Provider order, timeouts, retries, and models moved to
  // server/src/services/ai/platform/platformConfig.js — they are runtime
  // configuration (env-overridable), not shared business constants.

  // Cache durations by content category, per the architecture spec.
  CACHE_TTL_SECONDS: {
    SIMPLE_FACTS: 60 * 60 * 24 * 30, // 30 days
    WORKOUT_PLANS: 60 * 60 * 24 * 7, // 7 days
    NUTRITION_ANALYSIS: 60 * 60 * 24, // 24 hours
    EDUCATIONAL_CONTENT: 60 * 60 * 24 * 14, // 14 days
    LAST_KNOWN_GOOD: 60 * 60 * 24 * 3, // 3 days — used only when every provider fails
  },
};
