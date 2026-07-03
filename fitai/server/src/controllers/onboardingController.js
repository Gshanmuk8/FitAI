const { upsertProfile, savePlan, getProfile } = require('../models/UserProfile');
const { generateUserPlan, syncUserState, generationInputFromProfileRow } = require('../services/workout/planService');

async function completeOnboarding(req, res, next) {
  try {
    const userId = req.user.id;
    // equipment is the plan-relevant fact; persist it as gym_availability
    // so regeneration months later still knows what the user trains with.
    const profile = await upsertProfile(userId, {
      ...req.body,
      gymAvailability: req.body.gymAvailability || req.body.equipment,
    });
    const plan = await generateUserPlan(generationInputFromProfileRow(userId, profile));
    // A fresh onboarding starts the goal clock (restartClock: true).
    const updated = await savePlan(userId, plan, { restartClock: true });
    await syncUserState(userId, plan, profile.goal);
    res.json({ profile: updated, plan });
  } catch (err) {
    next(err);
  }
}

async function getOnboardingStatus(req, res, next) {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'No profile found' });
    res.json({ profile, plan: profile.ai_plan || null });
  } catch (err) {
    next(err);
  }
}

module.exports = { completeOnboarding, getOnboardingStatus };
