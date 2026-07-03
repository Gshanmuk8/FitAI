/**
 * Feature flags via environment variables — all default ON so a plain
 * deploy gets every feature, but any of them can be switched off without
 * a code change (e.g. FEATURE_REVIEWS=false). Reading them through this
 * module (never process.env directly) keeps flag names in one place.
 */
function flag(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return !['0', 'false', 'off', 'no'].includes(String(raw).toLowerCase());
}

module.exports = {
  FLAGS: {
    reviews: flag('FEATURE_REVIEWS'),
    achievements: flag('FEATURE_ACHIEVEMENTS'),
    adaptivePlanner: flag('FEATURE_ADAPTIVE_PLANNER'),
    preferenceLearning: flag('FEATURE_PREFERENCE_LEARNING'),
    progressSnapshots: flag('FEATURE_PROGRESS_SNAPSHOTS'),
  },
};
