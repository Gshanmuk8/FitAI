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
const { getToday, insertToday, getYesterday } = require('../../models/DailyChecklist');
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

module.exports = { getTodayEnriched, buildTodaySnapshot, itemsFromSnapshot };
