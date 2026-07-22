/**
 * The dashboard's AI briefing. The coach reads the user's plan and their
 * logged history (weigh-ins from the daily checklist + adherence) and
 * MEASURES the pace itself — there is deliberately no deterministic pace
 * math here; that is what the user asked for. The result is cached one row
 * per user per local day (daily_briefings), fingerprinted by an input hash
 * of everything the coach read — same pattern as the progress analysis. A
 * repeat dashboard load with nothing new is a cheap DB read; the moment the
 * user logs or edits anything (a value, a weigh-in, a checkmark, a note),
 * the hash changes and the next load regenerates the briefing against the
 * new facts instead of serving the morning's stale read.
 *
 * Failure-day economics: a fallback briefing is NOT persisted (a transient
 * outage must not freeze placeholder text for the rest of the day), so this
 * layer adds two rails against re-running the provider cascade per request:
 * an in-flight promise dedup (N concurrent first-loads -> one generation)
 * and a short in-process memo for fallback results.
 */
const crypto = require('crypto');
const DailyBriefing = require('../../models/DailyBriefing');
const { getProfile } = require('../../models/UserProfile');
const { getHistory } = require('../../models/DailyChecklist');
const { getTodayEnriched } = require('../checklist/checklistService');
const { buildContextForUser } = require('../memory/contextBuilder');
const { buildBriefingPrompt } = require('../../../../shared/prompts/templates');
const { generateBriefing } = require('./aiOrchestrator');
const { resolveUserDate } = require('../../utils/userDate');
const { createExpiringMap } = require('../../utils/expiringMap');

// Adherence + date math shared with the progress analysis — one definition
// of "70% adherence" across every AI surface.
const { adherenceFrom, ymd, DAY_MS } = require('../analytics/adherence');

// BRIEFING_VERSION is part of the fingerprint: bump it when the briefing's
// data contract grows (v2 added the live "today" block; v3 added calories)
// so a same-day cached row written against the old shape regenerates
// instead of being served.
const BRIEFING_VERSION = 4;
function hashData(data) {
  return crypto.createHash('sha1').update(JSON.stringify({ v: BRIEFING_VERSION, data })).digest('hex');
}

// The live layer: today's logged values and checkmarks against the day's
// frozen plan targets — what the user has actually done SO FAR today.
// Enrichment only: a failure here degrades to "no today block", it must
// never block the briefing.
async function buildTodayBlock(userId) {
  // Same call the dashboard makes — creates today's row (and its plan
  // snapshot) if the briefing is the day's first touch.
  const checklist = await getTodayEnriched(userId);
  const t = checklist.plan_snapshot?.targets || null;
  const num = (v) => (v == null ? null : Number(v));
  return {
    targets: t
      ? {
          calorieTarget: t.calorieTarget ?? null,
          proteinGrams: t.proteinGrams ?? null,
          waterMl: t.waterMl ?? null,
          sleepHours: t.sleepHours ?? null,
          stepsTarget: t.stepsTarget ?? null,
        }
      : null,
    logged: {
      proteinGrams: num(checklist.protein_grams),
      caloriesKcal: num(checklist.calories_kcal),
      waterMl: num(checklist.water_ml),
      sleepHours: num(checklist.sleep_hours),
      stepsCount: num(checklist.steps_count),
      weightKg: num(checklist.weight_kg),
    },
    completed: {
      workout: Boolean(checklist.workout_completed),
      protein: Boolean(checklist.protein_completed),
      calories: Boolean(checklist.calories_completed),
      water: Boolean(checklist.water_completed),
      sleep: Boolean(checklist.sleep_completed),
      steps: Boolean(checklist.steps_completed),
    },
  };
}

async function computeTodayBriefing(userId) {
  const profileRow = await getProfile(userId);
  if (!profileRow) return null;

  const userDate = (await resolveUserDate(userId, profileRow)) || ymd(new Date());

  const plan = profileRow.ai_plan
    ? typeof profileRow.ai_plan === 'string' ? JSON.parse(profileRow.ai_plan) : profileRow.ai_plan
    : null;

  // Today's block first: it also guarantees today's checklist row exists,
  // so the history read below always includes the current day.
  const today = await buildTodayBlock(userId).catch(() => null);

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
  // plan_started_at only — see progressAnalysisService: updated_at moves on
  // every profile edit, so it could re-date the plan clock. Migration 009
  // backfilled the legacy NULL rows that fallback was there for.
  const planStartedAt = profileRow.plan_started_at || null;
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
    today,
  };

  // Serve the stored briefing only while the data it was written against is
  // still the data on file. A row without an inputHash predates this contract
  // and regenerates. inputHash lives inside the stored jsonb (no migration)
  // and is stripped before the response — it's a cache detail, not content.
  const inputHash = hashData(data);
  const existing = await DailyBriefing.getToday(userId, userDate);
  if (existing && existing.briefing?.inputHash === inputHash) {
    const { inputHash: _ignored, ...briefing } = existing.briefing;
    // ymd() on every path: pg hands back a Date at server-local midnight,
    // which res.json serializes to UTC and can shift a day — so the same
    // endpoint would answer "2026-07-21T18:30:00Z" from cache and
    // "2026-07-22" from the fallback. The client gets a plain YYYY-MM-DD.
    return { ...briefing, date: ymd(existing.date), fresh: false };
  }

  // Provider-outage memo: don't re-run the cascade for every dashboard load
  // while the last attempt's fallback is still warm and the data unchanged.
  const memo = fallbackMemo.get(userId);
  if (memo && memo.inputHash === inputHash) return memo.briefing;

  const { profile } = await buildContextForUser(userId);
  const prompt = buildBriefingPrompt({ profile, data });
  const result = await generateBriefing({ profile: profileRow, prompt, userId });

  // Only cache a genuine AI briefing — a transient provider outage must not
  // freeze the fallback text in place for the rest of the day.
  if (result.source !== 'fallback') {
    fallbackMemo.delete(userId);
    const stored = await DailyBriefing.upsertToday(userId, { ...result, inputHash }, userDate);
    return { ...result, date: stored?.date ? ymd(stored.date) : userDate, fresh: true };
  }

  // Provider outage. If today already HAS a real briefing (we're here
  // because new data made its hash stale), serve that marked stale — the
  // morning's real words beat placeholder text. Template only when the
  // day has no briefing at all.
  let briefing;
  if (existing?.briefing?.summary) {
    const { inputHash: _ignored, ...real } = existing.briefing;
    briefing = { ...real, date: ymd(existing.date), fresh: false, stale: true };
  } else {
    briefing = { ...result, date: userDate, fresh: true };
  }
  fallbackMemo.set(userId, { inputHash, briefing });
  return briefing;
}

// In-flight dedup: N concurrent first-of-day requests (double-mounted
// dashboard, two tabs) share ONE generation instead of each paying an AI call.
const inFlight = new Map();
// Short TTL on purpose: absorbs burst loads, never blocks a deliberate
// reload — a reload after a minute retries the AI. Bounded so users who
// hit one outage and never return can't grow the map for the process life.
const fallbackMemo = createExpiringMap({ ttlMs: 60 * 1000, maxEntries: 5000 });

async function getTodayBriefing(userId) {
  if (inFlight.has(userId)) return inFlight.get(userId);
  const promise = computeTodayBriefing(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, promise);
  return promise;
}

module.exports = { getTodayBriefing };
