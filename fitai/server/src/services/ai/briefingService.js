/**
 * The dashboard's once-per-day AI briefing. The coach reads the user's plan
 * and their logged history (weigh-ins from the daily checklist + adherence)
 * and MEASURES the pace itself — there is deliberately no deterministic pace
 * math here; that is what the user asked for. The result is cached one row
 * per user per local day (daily_briefings), so a second dashboard load the
 * same day is a cheap DB read, and the AI runs at most once every 24h.
 *
 * Failure-day economics: a fallback briefing is NOT persisted (a transient
 * outage must not freeze placeholder text for the rest of the day), so this
 * layer adds two rails against re-running the provider cascade per request:
 * an in-flight promise dedup (N concurrent first-loads -> one generation)
 * and a short in-process memo for fallback results.
 */
const DailyBriefing = require('../../models/DailyBriefing');
const { getProfile } = require('../../models/UserProfile');
const { getHistory } = require('../../models/DailyChecklist');
const { buildContextForUser } = require('../memory/contextBuilder');
const { buildBriefingPrompt } = require('../../../../shared/prompts/templates');
const { generateBriefing } = require('./aiOrchestrator');
const { localDateInZone } = require('../../utils/userDate');

// Adherence + date math shared with the progress analysis — one definition
// of "70% adherence" across every AI surface.
const { adherenceFrom, ymd, DAY_MS } = require('../analytics/adherence');

async function computeTodayBriefing(userId) {
  const profileRow = await getProfile(userId);
  if (!profileRow) return null;

  const userDate = localDateInZone(profileRow.timezone) || ymd(new Date());
  const existing = await DailyBriefing.getToday(userId, userDate);
  if (existing) return { ...existing.briefing, date: existing.date, fresh: false };

  // Provider-outage memo: don't re-run the cascade for every dashboard load
  // while the last attempt's fallback is still warm.
  const memo = fallbackMemo.get(userId);
  if (memo && memo.until > Date.now()) return memo.briefing;

  const plan = profileRow.ai_plan
    ? typeof profileRow.ai_plan === 'string' ? JSON.parse(profileRow.ai_plan) : profileRow.ai_plan
    : null;

  // History is date-DESC; weigh-ins go into the prompt oldest-first so the
  // trend reads naturally.
  const history = await getHistory(userId, 60);
  const weighIns = history
    .filter((r) => r.weight_kg != null)
    .map((r) => ({ date: ymd(r.date), kg: Number(r.weight_kg) }))
    .reverse();
  const latestNote = history.find((r) => r.notes)?.notes || null;

  // The user's own mission items (last 7 days) — habits they chose to track.
  // The coach should notice "no sugar" succeeding six days straight, or
  // "20 min yoga" never happening, without being told to.
  const customItems = history.slice(0, 7).flatMap((r) => {
    const items = Array.isArray(r.custom_items) ? r.custom_items : [];
    return items.map((i) => ({ date: ymd(r.date), label: String(i.label || ''), done: Boolean(i.done) }));
  });

  const timeframeWeeks = plan?.timeframe?.weeks || profileRow.timeframe_weeks || null;
  const planStartedAt = profileRow.plan_started_at || profileRow.updated_at || null;
  // Deterministic: how far into the plan the user is. The AI is told
  // plainly when the timeframe has elapsed so a finished 12-week plan
  // reads as "time to set the next goal", never "behind schedule".
  const weeksElapsed = planStartedAt
    ? Math.max(0, Math.round(((new Date(`${userDate}T12:00:00`) - new Date(planStartedAt)) / (7 * DAY_MS)) * 10) / 10)
    : null;

  const data = {
    goal: {
      type: profileRow.goal,
      startWeightKg: profileRow.weight_kg != null ? Number(profileRow.weight_kg) : null,
      targetWeightKg: profileRow.target_weight_kg != null ? Number(profileRow.target_weight_kg) : null,
      timeframeWeeks,
      planStartedAt,
      weeksElapsed,
      timeframeComplete: Boolean(timeframeWeeks && weeksElapsed != null && weeksElapsed >= timeframeWeeks),
    },
    weighIns,
    adherence: adherenceFrom(history, userDate),
    latestNote,
    customItems,
  };

  const { profile } = await buildContextForUser(userId);
  const prompt = buildBriefingPrompt({ profile, data });
  const result = await generateBriefing({ profile: profileRow, prompt, userId });

  // Only cache a genuine AI briefing — a transient provider outage must not
  // freeze the fallback text in place for the rest of the day.
  if (result.source !== 'fallback') {
    fallbackMemo.delete(userId);
    const stored = await DailyBriefing.upsertToday(userId, result, userDate);
    return { ...result, date: stored?.date || userDate, fresh: true };
  }
  const briefing = { ...result, date: userDate, fresh: true };
  fallbackMemo.set(userId, { until: Date.now() + FALLBACK_MEMO_MS, briefing });
  return briefing;
}

// In-flight dedup: N concurrent first-of-day requests (double-mounted
// dashboard, two tabs) share ONE generation instead of each paying an AI call.
const inFlight = new Map();
const fallbackMemo = new Map();
const FALLBACK_MEMO_MS = 10 * 60 * 1000;

async function getTodayBriefing(userId) {
  if (inFlight.has(userId)) return inFlight.get(userId);
  const promise = computeTodayBriefing(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, promise);
  return promise;
}

module.exports = { getTodayBriefing };
