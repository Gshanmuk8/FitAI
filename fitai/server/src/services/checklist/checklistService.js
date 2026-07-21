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
const {
  getToday, insertToday, getYesterday, updateChecklistFields,
  appendCustomItem, setCustomItemDoneById, removeCustomItemById, setPlanSnapshot,
} = require('../../models/DailyChecklist');
const { getProfile } = require('../../models/UserProfile');
const { resolveUserDate } = require('../../utils/userDate');
const { todaysPlanEntry } = require('../../../../shared/calculations/schedule');
const { buildDietTargets } = require('../../../../shared/calculations/dietTargets');
const { adaptTodaysPlan } = require('../../../../shared/calculations/adaptivePlanner');
const { FLAGS } = require('../../config/featureFlags');
const logger = require('../../utils/logger');

const SNAPSHOT_VERSION = 2; // v2: snapshot carries the user's goal (calorie direction)
const DAY_MS = 24 * 60 * 60 * 1000;

// Noon avoids UTC-parse/local-format boundary shifts when turning a
// YYYY-MM-DD string back into a Date for weekday math.
const atNoon = (dateStr) => new Date(`${dateStr}T12:00:00`);

async function getTodayEnriched(userId) {
  const profile = await getProfile(userId);
  // Ratcheted, not just formatted: a westward timezone change would
  // otherwise send today's writes onto an already-finished earlier day.
  const userDate = await resolveUserDate(userId, profile);

  let checklist = await getToday(userId, userDate);
  if (!checklist) {
    const snapshot = await buildTodaySnapshot(userId, profile, userDate).catch((err) => {
      // A snapshot failure must never block the checklist itself.
      logger.error('plan snapshot build failed, creating bare checklist', { error: err.message });
      return null;
    });
    checklist = await insertToday(userId, snapshot, userDate);
    // A snapshot build that failed above leaves plan_snapshot null. The heal
    // condition below must therefore treat "missing" as stale too — otherwise
    // a day frozen by one transient failure stays target-less until midnight,
    // and valueCompletion degrades to "any positive number counts", so a 1 g
    // protein entry marks the day complete.
  } else if (!checklist.plan_snapshot || Number(checklist.plan_snapshot.version || 1) < SNAPSHOT_VERSION) {
    // Self-heal a day frozen under an older snapshot contract (e.g. a row
    // created before the snapshot carried `goal`): rebuild it from the live
    // plan and re-derive value completions, exactly like a plan edit does.
    // Deploying mid-day must not leave TODAY judging calories by the wrong
    // rule until midnight. Failure degrades to serving the stale snapshot.
    const healed = await refreshTodaySnapshot(userId).catch((err) => {
      logger.error('stale snapshot self-heal failed, serving as-is', { error: err.message });
      return null;
    });
    if (healed) return healed;
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
    // The goal decides which DIRECTION the calorie target cuts (see
    // caloriesCompleted) and how its mission label reads.
    goal: profile.goal || null,
  };
}

// Manual value entry. The user types the real figure; we store it AND derive
// the matching *_completed boolean from the day's frozen targets, so the
// checkbox and the number can never disagree. A value with no target on file
// counts as done once it's a positive number.
const VALUE_TO_TARGET = {
  protein_grams: 'proteinGrams',
  calories_kcal: 'calorieTarget',
  water_ml: 'waterMl',
  sleep_hours: 'sleepHours',
  steps_count: 'stepsTarget',
};
const VALUE_TO_COMPLETION = {
  protein_grams: 'protein_completed',
  calories_kcal: 'calories_completed',
  water_ml: 'water_completed',
  sleep_hours: 'sleep_completed',
  steps_count: 'steps_completed',
};

// Calories are the one target that cuts in a goal-dependent DIRECTION:
// hitting 190/180g protein is a win everywhere, but 2600/2414 kcal is a
// win on a bulk and a miss on a cut. lose_fat: at or under (5% grace);
// build_muscle: reach it (5% grace); everything else: within ±10%.
function caloriesCompleted(value, target, goal) {
  if (value == null || value <= 0) return false;
  if (target == null) return true;
  if (goal === 'lose_fat') return value <= target * 1.05;
  if (goal === 'build_muscle') return value >= target * 0.95;
  return value >= target * 0.9 && value <= target * 1.1;
}

// One derivation for every path that writes a value (manual save, meal-diary
// sync, plan-edit refresh) — the checkbox always means the same thing.
function valueCompletion(col, value, targets, goal) {
  const target = targets?.[VALUE_TO_TARGET[col]];
  if (col === 'calories_kcal') return caloriesCompleted(Number(value), target != null ? Number(target) : null, goal);
  return target != null ? Number(value) >= Number(target) : Number(value) > 0;
}

async function setChecklistValues(userId, values) {
  // getTodayEnriched guarantees today's row exists and carries the plan
  // snapshot (targets + goal) we compare against, plus the user's local date.
  const current = await getTodayEnriched(userId);
  const snapshot = current.plan_snapshot || {};
  const fields = {};

  for (const col of Object.keys(VALUE_TO_TARGET)) {
    if (values[col] == null) continue;
    fields[col] = values[col];
    fields[VALUE_TO_COMPLETION[col]] = valueCompletion(col, values[col], snapshot.targets, snapshot.goal);
  }
  if (values.weight_kg != null) fields.weight_kg = values.weight_kg;
  if (values.notes !== undefined) fields.notes = values.notes;

  // 'manual': the user typed these. The meal diary will stop overwriting
  // them for the rest of the day (see mealDiaryService.syncFromDiary).
  const updated = await updateChecklistFields(userId, fields, current.userDate, 'manual');
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
  const userDate = await resolveUserDate(userId, profile);
  const existing = await getToday(userId, userDate);
  if (!existing) return null; // day not started — first load freezes the new plan anyway

  const snapshot = await buildTodaySnapshot(userId, profile, userDate);
  await setPlanSnapshot(userId, snapshot, userDate);

  const completions = {};
  for (const col of Object.keys(VALUE_TO_TARGET)) {
    if (existing[col] == null) continue;
    completions[VALUE_TO_COMPLETION[col]] = valueCompletion(col, existing[col], snapshot?.targets, snapshot?.goal);
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

function notFound() {
  const err = new Error('Checklist item not found for today.');
  err.status = 404;
  return err;
}

// All three mutate the array inside the UPDATE (see DailyChecklist) so two
// tabs can't clobber each other's edits. The service's only job is turning
// "the statement matched nothing" into the right status code.
async function addCustomItem(userId, label) {
  const current = await getTodayEnriched(userId);
  const item = { id: crypto.randomUUID(), label, done: false };
  const updated = await appendCustomItem(userId, item, MAX_CUSTOM_ITEMS, current.userDate);
  if (!updated) {
    const err = new Error(`Today's list is full (${MAX_CUSTOM_ITEMS} custom items max).`);
    err.status = 400;
    throw err;
  }
  return { ...updated, items: itemsFromSnapshot(updated.plan_snapshot), userDate: current.userDate };
}

async function setCustomItemDone(userId, itemId, done) {
  const current = await getTodayEnriched(userId);
  const updated = await setCustomItemDoneById(userId, itemId, done, current.userDate);
  if (!updated) throw notFound();
  return { ...updated, items: itemsFromSnapshot(updated.plan_snapshot), userDate: current.userDate };
}

async function removeCustomItem(userId, itemId) {
  const current = await getTodayEnriched(userId);
  const updated = await removeCustomItemById(userId, itemId, current.userDate);
  if (!updated) throw notFound();
  return { ...updated, items: itemsFromSnapshot(updated.plan_snapshot), userDate: current.userDate };
}

// The boolean columns stay exactly as they were (backwards compat) —
// this just decorates each with what it concretely means today.
function itemsFromSnapshot(snapshot) {
  const t = snapshot?.targets;
  const w = snapshot?.workout;
  const goal = snapshot?.goal;
  const workoutLabel =
    w?.type === 'rest'
      ? 'Rest day — easy walk & mobility'
      : w?.dayName
        ? `Workout: ${w.dayName}${w.intensity === 'reduced' ? ' (reduced intensity)' : ''}`
        : 'Workout completed';

  // The calorie label states the direction the goal implies — "≤" on a cut
  // is a different instruction than "≥" on a bulk.
  const kcalSign = goal === 'lose_fat' ? '≤' : goal === 'build_muscle' ? '≥' : '~';
  const kcalDetail = goal === 'lose_fat' ? 'stay at or under' : goal === 'build_muscle' ? 'fuel the build — reach it' : 'stay within ±10%';

  return [
    { field: 'workout_completed', label: workoutLabel, detail: w?.exercises?.length ? `${w.exercises.length} exercises` : null },
    { field: 'protein_completed', label: t?.proteinGrams ? `Protein: ${t.proteinGrams}g` : 'Protein target', detail: null },
    { field: 'calories_completed', label: t?.calorieTarget ? `Calories: ${kcalSign}${t.calorieTarget.toLocaleString()} kcal` : 'Calorie target', detail: t?.calorieTarget ? kcalDetail : null },
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
  valueCompletion,
};
