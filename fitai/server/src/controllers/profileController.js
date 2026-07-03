const { getProfile, updateProfileFields } = require('../models/UserProfile');

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
    res.json({ profile, status: 'saved' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyProfile, patchMyProfile };
