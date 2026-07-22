const { getProfile, savePlan } = require('../models/UserProfile');
const { applyPlanEdit } = require('../services/workout/planEditingService');
const { generateUserPlan, syncUserState, generationInputFromProfileRow } = require('../services/workout/planService');
const { recordSystemMemory } = require('../services/memory/memoryWriter');
const { propagatePlanChange } = require('../services/plan/planChangeEffects');
const { resolveEffectiveDiet } = require('../services/plan/dietResolver');

async function getPlan(req, res, next) {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile?.ai_plan) return res.status(404).json({ error: 'No plan found — complete onboarding first.' });
    const plan = typeof profile.ai_plan === 'string' ? JSON.parse(profile.ai_plan) : profile.ai_plan;
    res.json({
      // The ONE resolver — planController used to carry its own near-copy
      // that derived the delta against the STORED maintenance while the
      // resolver recomputed it, so the Plan page and the coach could quote
      // two different deficits for the same user on the same day.
      plan: { ...plan, diet: resolveEffectiveDiet(profile, plan) },
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

    // skipCache: with an unchanged profile the plan cache key would be
    // identical, and "regenerate" would silently hand back the same plan
    // while still resetting the goal clock — a no-op with side effects.
    const plan = await generateUserPlan(generationInputFromProfileRow(userId, profile), { skipCache: true });
    const updated = await savePlan(userId, plan, { restartClock: true });
    await syncUserState(userId, plan, profile.goal);
    // New plan, same day: today's mission and briefing switch to it now.
    // History (checklists, meals, weigh-ins, logs) is untouched — the AI
    // reads the whole journey across plan generations.
    await propagatePlanChange(userId);
    recordSystemMemory(userId, {
      summary: `User regenerated their plan (goal: ${profile.goal}, ${plan.days?.length || '?'}-day split, ${plan.timeframe?.weeks || '?'} weeks).`,
      category: 'behavior',
      importance: 2,
    }).catch(() => {});

    res.json({ plan, profile: updated, status: 'regenerated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPlan, putPlan, postRegenerate };
