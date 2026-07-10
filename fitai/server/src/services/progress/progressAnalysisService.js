/**
 * The Progress page's engine. Assembles the user's whole logged journey —
 * weigh-in series, per-day training volume, per-day nutrition, adherence,
 * their own habit items — as ground-truth DATA, and hands ALL interpretation
 * to the AI (progressAnalysis task). There is deliberately no rule engine
 * here: no pace formulas, no threshold-based "risk levels", no canned
 * recommendations. The numbers are facts; the reasoning is the coach's.
 *
 * Economics: at most one AI analysis per user per local day, stored in
 * progress_analyses. input_hash fingerprints the assembled data, so new
 * data the same day (a weigh-in, a workout) triggers a recompute on the
 * next view instead of serving a stale read. Fallback results are never
 * persisted, and an in-flight dedup stops N concurrent loads from each
 * paying an AI call.
 */
const crypto = require('crypto');
const ProgressAnalysis = require('../../models/ProgressAnalysis');
const { getProfile } = require('../../models/UserProfile');
const { getHistory } = require('../../models/DailyChecklist');
const { trainingDaySummary } = require('../../models/WorkoutLog');
const { dailyTotalsRecent } = require('../../models/Meal');
const { buildContextForUser } = require('../memory/contextBuilder');
const { buildProgressAnalysisPrompt } = require('../../../../shared/prompts/templates');
const { analyzeProgress } = require('../ai/aiOrchestrator');
const { adherenceFrom, ymd, DAY_MS } = require('../analytics/adherence');
const { localDateInZone } = require('../../utils/userDate');

async function assembleData(userId, profileRow, userDate) {
  const plan = profileRow.ai_plan
    ? typeof profileRow.ai_plan === 'string' ? JSON.parse(profileRow.ai_plan) : profileRow.ai_plan
    : null;

  const [history, training, nutrition] = await Promise.all([
    getHistory(userId, 90),
    trainingDaySummary(userId, 28),
    dailyTotalsRecent(userId, 14),
  ]);

  // Weigh-ins live on the daily checklist rows; oldest-first for the chart
  // and so the trend reads naturally in the prompt.
  const weighIns = history
    .filter((r) => r.weight_kg != null)
    .map((r) => ({ date: ymd(r.date), kg: Number(r.weight_kg) }))
    .reverse();

  const customItems = history.slice(0, 14).flatMap((r) => {
    const items = Array.isArray(r.custom_items) ? r.custom_items : [];
    return items.map((i) => ({ date: ymd(r.date), label: String(i.label || ''), done: Boolean(i.done) }));
  });

  const timeframeWeeks = plan?.timeframe?.weeks || profileRow.timeframe_weeks || null;
  const planStartedAt = profileRow.plan_started_at || profileRow.updated_at || null;
  const weeksElapsed = planStartedAt
    ? Math.max(0, Math.round(((new Date(`${userDate}T12:00:00`) - new Date(planStartedAt)) / (7 * DAY_MS)) * 10) / 10)
    : null;

  return {
    goal: {
      type: profileRow.goal,
      startWeightKg: profileRow.weight_kg != null ? Number(profileRow.weight_kg) : null,
      targetWeightKg: profileRow.target_weight_kg != null ? Number(profileRow.target_weight_kg) : null,
      timeframeWeeks,
      planStartedAt,
      weeksElapsed,
      timeframeComplete: Boolean(timeframeWeeks && weeksElapsed != null && weeksElapsed >= timeframeWeeks),
      dietTargets: plan?.diet || null,
      roadmap: plan?.roadmap || [],
    },
    weighIns,
    adherence: adherenceFrom(history, userDate),
    training: training.map((t) => ({ date: ymd(t.date), sets: t.sets, exercises: t.exercises, volumeKg: Math.round(t.volume_kg) })),
    nutrition: nutrition.map((n) => ({ date: ymd(n.date), calories: n.calories, protein: Math.round(n.protein), meals: n.meals })),
    customItems,
  };
}

// Fingerprint of everything the AI reasons over. Any new data point (weigh-in,
// set, meal, habit tick) changes it and invalidates today's stored analysis.
// ANALYSIS_VERSION is part of the fingerprint: bump it when the analysis
// contract grows (e.g. v2 added AI-authored stats + charts) so a same-day
// cached row from the old shape regenerates instead of being served without
// the new fields.
const ANALYSIS_VERSION = 2;
function hashData(data) {
  return crypto.createHash('sha1').update(JSON.stringify({ v: ANALYSIS_VERSION, data })).digest('hex');
}

async function computeProgress(userId) {
  const profileRow = await getProfile(userId);
  if (!profileRow) return null;

  const userDate = localDateInZone(profileRow.timezone) || ymd(new Date());
  const data = await assembleData(userId, profileRow, userDate);
  const inputHash = hashData(data);

  const existing = await ProgressAnalysis.getToday(userId, userDate);
  if (existing && existing.input_hash === inputHash) {
    return { date: ymd(existing.date), data, analysis: existing.analysis, fresh: false };
  }

  // Provider-outage memo: don't re-run the cascade for every page load
  // while the last attempt's fallback is still warm.
  const memo = fallbackMemo.get(userId);
  if (memo && memo.until > Date.now() && memo.inputHash === inputHash) {
    return { date: userDate, data, analysis: memo.analysis, fresh: false };
  }

  const { profile } = await buildContextForUser(userId);
  const prompt = buildProgressAnalysisPrompt({ profile, data });
  const analysis = await analyzeProgress({ prompt, userId });

  if (analysis.source !== 'fallback') {
    fallbackMemo.delete(userId);
    await ProgressAnalysis.upsertToday(userId, { analysis, inputHash }, userDate);
    return { date: userDate, data, analysis, fresh: true };
  }
  fallbackMemo.set(userId, { until: Date.now() + FALLBACK_MEMO_MS, inputHash, analysis });
  return { date: userDate, data, analysis, fresh: true };
}

const inFlight = new Map();
const fallbackMemo = new Map();
const FALLBACK_MEMO_MS = 10 * 60 * 1000;

// In-flight dedup: concurrent first-of-day loads share one generation.
async function getProgress(userId) {
  if (inFlight.has(userId)) return inFlight.get(userId);
  const promise = computeProgress(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, promise);
  return promise;
}

module.exports = { getProgress };
