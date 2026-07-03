const { getProfile, savePlan } = require('../models/UserProfile');
const { applyPlanEdit } = require('../services/workout/planEditingService');
const { generateUserPlan, syncUserState, generationInputFromProfileRow } = require('../services/workout/planService');
const { recordSystemMemory } = require('../services/memory/memoryWriter');

async function getPlan(req, res, next) {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile?.ai_plan) return res.status(404).json({ error: 'No plan found — complete onboarding first.' });
    const plan = typeof profile.ai_plan === 'string' ? JSON.parse(profile.ai_plan) : profile.ai_plan;
    res.json({
      plan,
      planStartedAt: profile.plan_started_at,
      // The plan's timeframe is the safety-clamped one — it wins over the
      // raw number the user typed at onboarding.
      timeframeWeeks: plan.timeframe?.weeks || profile.timeframe_weeks || null,
    });
  } catch (err) {
    next(err);
  }
}

async function putPlan(req, res, next) {
  try {
    const { plan } = await applyPlanEdit(req.user.id, req.body);
    res.json({ plan, status: 'saved' });
  } catch (err) {
    next(err);
  }
}

// Explicit "life changed" action: regenerates from the CURRENT profile
// (edit it first on the Profile page), keeps learned exercise preferences,
// and restarts the goal clock — a new plan is a new timeline.
async function postRegenerate(req, res, next) {
  try {
    const userId = req.user.id;
    const profile = await getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'No profile found — complete onboarding first.' });

    const plan = await generateUserPlan(generationInputFromProfileRow(userId, profile));
    const updated = await savePlan(userId, plan, { restartClock: true });
    await syncUserState(userId, plan, profile.goal);
    recordSystemMemory(userId, {
      summary: 'User regenerated their plan (life change or new goal parameters).',
      category: 'behavior',
      importance: 2,
    }).catch(() => {});

    res.json({ plan, profile: updated, status: 'regenerated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPlan, putPlan, postRegenerate };
