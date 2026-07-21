const { getProfile, updateProfileFields } = require('../models/UserProfile');
const { propagatePlanChange } = require('../services/plan/planChangeEffects');

// Profile fields that today's frozen mission snapshot was built from. The
// plan itself is untouched by a profile edit, but the snapshot bakes in the
// goal (which decides whether calories grade as "at or under" or "reach it")
// and the timezone (which decides what "today" even is). Change one of these
// and today's mission is judging the user by the old answer until midnight,
// while the briefing — whose input hash does include the goal — regenerates
// immediately and contradicts it.
const SNAPSHOT_RELEVANT = ['goal', 'timezone', 'weightKg', 'activityLevel'];

async function getMyProfile(req, res, next) {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'No profile found — complete onboarding first.' });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

// Saves personal facts without touching the plan or the goal clock.
// Changing goal/weight materially? That's what POST /api/plan/regenerate
// is for — an explicit, user-confirmed action, never a side effect.
async function patchMyProfile(req, res, next) {
  try {
    const profile = await updateProfileFields(req.user.id, req.body);
    if (!profile) return res.status(404).json({ error: 'No profile found — complete onboarding first.' });

    // Best-effort, exactly like the plan-write paths: the profile IS saved,
    // and the surfaces self-heal at the next rollover if this fails.
    if (SNAPSHOT_RELEVANT.some((f) => req.body[f] !== undefined)) {
      await propagatePlanChange(req.user.id);
    }
    res.json({ profile, status: 'saved' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyProfile, patchMyProfile };
