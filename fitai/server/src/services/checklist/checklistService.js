/**
 * Builds "Today's Mission" from the user's actual plan, once per day —
 * where "day" means the USER's day: rollover happens at their midnight
 * (profile.timezone, captured from the browser), not the server's.
 *
 * The first request after the user's midnight assembles a plan snapshot —
 * today's scheduled workout (or rest day), the diet targets from the live
 * plan, and any adaptations earned by yesterday's outcome (missed workout,
 * poor sleep, perfect day) — and freezes it into the day's row. Every
 * step is deterministic: no AI call sits on this path.
 */
const crypto = require('crypto');
const { getToday, insertToday, getYesterday, updateChecklistFields, setCustomItems, setPlanSnapshot } = require('../../models/DailyChecklist');
const { getProfile } = require('../../models/UserProfile');
const { localDateInZone } = require('../../utils/userDate');
const { todaysPlanEntry } = require('../../../../shared/calculations/schedule');
const { buildDietTargets } = require('../../../../shared/calculations/dietTargets');
const { adaptTodaysPlan } = require('../../../../shared/calculations/adaptivePlanner');
const { FLAGS } = require('../../config/featureFlags');
const logger = require('../../utils/logger');

const SNAPSHOT_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

// Noon avoids UTC-parse/local-format boundary shifts when turning a
// YYYY-MM-DD string back into a Date for weekday math.
const atNoon = (dateStr) => new Date(`${dateStr}T12:00:00`);

async function getTodayEnriched(userId) {
  const profile = await getProfile(userId);
  const userDate = localDateInZone(profile?.timezone);

  let checklist = await getToday(userId, userDate);
  if (!checklist) {
    const snapshot = await buildTodaySnapshot(userId, profile, userDate).catch((err) => {
      // A snapshot failure must never block the checklist itself.
      logger.error('plan snapshot build failed, creating bare checklist', { error: err.message });
      return null;
    });
    checklist = await insertToday(userId, snapshot, userDate);
  }
  return { ...checklist, items: itemsFromSnapshot(checklist.plan_snapshot), userDate };
}

async function buildTodaySnapshot(userId, profile, userDate) {
  if (!profile) return null;

  const plan = profile.ai_plan
    ? typeof profile.ai_plan === 'string' ? JSON.parse(profile.ai_plan) : profile.ai_plan
    : null;

  const now = userDate ? atNoon(userDate) : new Date();
  const yesterdayDate = new Date(now.getTime() - DAY_MS);
  const entryToday = todaysPlanEntry(plan?.days, now);
  const entryYesterday = todaysPlanEntry(plan?.days, yesterdayDate);

  let adapted = { entry: entryToday, intensity: 'normal', adaptations: [] };
  if (FLAGS.adaptivePlanner) {
    const yesterday = await getYesterday(userId, userDate);
    adapted = adaptTodaysPlan({ entryToday, entryYesterday, yesterday });
  }

  // Prefer the live plan's diet layer (it carries the user's own edits);
  // recompute from the profile only if the plan predates the diet layer.
  let targets = plan?.diet || null;
  if (!targets) {
    try {
      targets = buildDietTargets({
        weightKg: Number(profile.weight_kg),
        heightCm: Number(profile.height_cm),
        age: profile.age,
        sex: profile.sex || 'other',
        activityLevel: profile.activity_level,
        goal: profile.goal,
      });
    } catch {
      targets = null;
    }
  }

  return {
    version: SNAPSHOT_VERSION,
    workout: {
      type: adapted.entry.type,
      weekday: adapted.entry.weekday,
      dayName: adapted.entry.day?.name || null,
      exercises: (adapted.entry.day?.exercises || []).map((ex) => ({ name: ex.name, sets: ex.sets, reps: ex.reps })),
      intensity: adapted.intensity,
    },
    adaptations: adapted.adaptations,
    targets,
  };
}

// Manual value entry. The user types the real figure; we store it AND derive
// the matching *_completed boolean from the day's frozen targets, so the
// checkbox and the number can never disagree. A value with no target on file
// counts as done once it's a positive number.
const VALUE_TO_TARGET = {
  protein_grams: 'proteinGrams',
  water_ml: 'waterMl',
  sleep_hours: 'sleepHours',
  steps_count: 'stepsTarget',
};
const VALUE_TO_COMPLETION = {
  protein_grams: 'protein_completed',
  water_ml: 'water_completed',
  sleep_hours: 'sleep_completed',
  steps_count: 'steps_completed',
};

async function setChecklistValues(userId, values) {
  // getTodayEnriched guarantees today's row exists and carries the plan
  // snapshot (targets) we compare against, plus the user's local date.
  const current = await getTodayEnriched(userId);
  const targets = current.plan_snapshot?.targets || {};
  const fields = {};

  for (const [col, targetKey] of Object.entries(VALUE_TO_TARGET)) {
    if (values[col] == null) continue;
    fields[col] = values[col];
    const target = targets[targetKey];
    fields[VALUE_TO_COMPLETION[col]] = target != null ? values[col] >= target : values[col] > 0;
  }
  if (values.weight_kg != null) fields.weight_kg = values.weight_kg;
  if (values.notes !== undefined) fields.notes = values.notes;

  const updated = await updateChecklistFields(userId, fields, current.userDate);
  return { ...updated, items: itemsFromSnapshot(updated.plan_snapshot), userDate: current.userDate };
}

// A plan edit/regeneration mid-day must show on TODAY's mission immediately,
// not at the next midnight rollover. Rebuild today's frozen snapshot from the
// live plan and re-derive the value-based completions against the NEW targets
// (a protein value that satisfied the old 150g target may not satisfy 180g —
// the checkbox and the number must never disagree). Everything the user
// logged (values, weigh-in, notes, custom items, workout tick) is preserved.
async function refreshTodaySnapshot(userId) {
  const profile = await getProfile(userId);
  const userDate = localDateInZone(profile?.timezone);
  const existing = await getToday(userId, userDate);
  if (!existing) return null; // day not started — first load freezes the new plan anyway

  const snapshot = await buildTodaySnapshot(userId, profile, userDate);
  await setPlanSnapshot(userId, snapshot, userDate);

  const targets = snapshot?.targets || {};
  const completions = {};
  for (const [col, targetKey] of Object.entries(VALUE_TO_TARGET)) {
    if (existing[col] == null) continue;
    const target = targets[targetKey];
    completions[VALUE_TO_COMPLETION[col]] = target != null ? Number(existing[col]) >= target : Number(existing[col]) > 0;
  }
  const updated = Object.keys(completions).length
    ? await updateChecklistFields(userId, completions, userDate)
    : await getToday(userId, userDate);
  return { ...updated, items: itemsFromSnapshot(updated.plan_snapshot), userDate };
}

// User-authored mission items: free text, owned entirely by the user, and
// part of the same day-row so they show up in history the AI reads. Kept
// separate from the five plan-derived items — a custom "20 min yoga" must
// never overwrite the plan's own workout adherence signal.
const MAX_CUSTOM_ITEMS = 12;

function parseCustomItems(row) {
  const raw = row?.custom_items;
  const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(items) ? items : [];
}

async function addCustomItem(userId, label) {
  const current = await getTodayEnriched(userId);
  const items = parseCustomItems(current);
  if (items.length >= MAX_CUSTOM_ITEMS) {
    const err = new Error(`Today's list is full (${MAX_CUSTOM_ITEMS} custom items max).`);
    err.status = 400;
    throw err;
  }
  items.push({ id: crypto.randomUUID(), label, done: false });
  const updated = await setCustomItems(userId, items, current.userDate);
  return { ...updated, items: itemsFromSnapshot(updated.plan_snapshot), userDate: current.userDate };
}

async function setCustomItemDone(userId, itemId, done) {
  const current = await getTodayEnriched(userId);
  const items = parseCustomItems(current);
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    const err = new Error('Checklist item not found for today.');
    err.status = 404;
    throw err;
  }
  item.done = done;
  const updated = await setCustomItems(userId, items, current.userDate);
  return { ...updated, items: itemsFromSnapshot(updated.plan_snapshot), userDate: current.userDate };
}

async function removeCustomItem(userId, itemId) {
  const current = await getTodayEnriched(userId);
  const items = parseCustomItems(current);
  const next = items.filter((i) => i.id !== itemId);
  if (next.length === items.length) {
    const err = new Error('Checklist item not found for today.');
    err.status = 404;
    throw err;
  }
  const updated = await setCustomItems(userId, next, current.userDate);
  return { ...updated, items: itemsFromSnapshot(updated.plan_snapshot), userDate: current.userDate };
}

// The five boolean columns stay exactly as they were (backwards compat) —
// this just decorates each with what it concretely means today.
function itemsFromSnapshot(snapshot) {
  const t = snapshot?.targets;
  const w = snapshot?.workout;
  const workoutLabel =
    w?.type === 'rest'
      ? 'Rest day — easy walk & mobility'
      : w?.dayName
        ? `Workout: ${w.dayName}${w.intensity === 'reduced' ? ' (reduced intensity)' : ''}`
        : 'Workout completed';

  return [
    { field: 'workout_completed', label: workoutLabel, detail: w?.exercises?.length ? `${w.exercises.length} exercises` : null },
    { field: 'protein_completed', label: t?.proteinGrams ? `Protein: ${t.proteinGrams}g` : 'Protein target', detail: t?.calorieTarget ? `within ~${t.calorieTarget} kcal` : null },
    { field: 'water_completed', label: t?.waterMl ? `Water: ${(t.waterMl / 1000).toFixed(1)}L` : 'Water target', detail: null },
    { field: 'sleep_completed', label: t?.sleepHours ? `Sleep: ${t.sleepHours}h+` : 'Sleep target', detail: null },
    { field: 'steps_completed', label: t?.stepsTarget ? `Steps: ${t.stepsTarget.toLocaleString()}` : 'Steps target', detail: null },
  ];
}

module.exports = {
  getTodayEnriched,
  setChecklistValues,
  buildTodaySnapshot,
  itemsFromSnapshot,
  refreshTodaySnapshot,
  addCustomItem,
  setCustomItemDone,
  removeCustomItem,
};
