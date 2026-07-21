/**
 * A compact, token-bounded digest of the user's recent logged activity —
 * what the coach chat reads so it "sees" every move (weigh-ins, training,
 * meals, adherence) without dragging the full 90-day journey into every
 * message. Deliberately small: a handful of numbers, not row dumps —
 * chat happens many times a day and each token here is paid on every send.
 *
 * All figures are measured from the user's own records via indexed
 * queries; nothing here is estimated or invented.
 *
 * `today` is the live layer: the user's CURRENT day exactly as it stands
 * the moment they send a message — today's meals (by name), logged values,
 * the planned workout and sets done, their own mission items and notes.
 * It is rebuilt on every message and it participates in the tutor's cache
 * key, so the instant the user logs anything, the next answer both SEES
 * the change and cannot be served from a pre-change cache entry.
 */
const { getHistory } = require('../../models/DailyChecklist');
const { trainingDaySummary, todaySetCounts } = require('../../models/WorkoutLog');
const { dailyTotalsRecent, listToday } = require('../../models/Meal');
const { getTodayEnriched } = require('../checklist/checklistService');
const { adherenceFrom, ymd } = require('./adherence');
const { getUserToday } = require('../../utils/userDate');

async function buildTodayBlock(userId) {
  // Same call the dashboard makes — creates today's row (and its frozen
  // plan snapshot) if this chat is the day's first touch, so the coach and
  // the dashboard always describe the same "today".
  const checklist = await getTodayEnriched(userId);
  const userDate = checklist.userDate;

  const [meals, sets] = await Promise.all([
    listToday(userId, userDate).catch(() => []),
    todaySetCounts(userId, userDate).catch(() => []),
  ]);

  // custom_items may arrive as jsonb (array) or text (string) depending on
  // driver settings — a malformed value degrades to "no custom items", it
  // must not null out the whole today block.
  let customItems = [];
  try {
    const rawCustom = checklist.custom_items;
    const parsed = Array.isArray(rawCustom) ? rawCustom : typeof rawCustom === 'string' ? JSON.parse(rawCustom) : [];
    customItems = (Array.isArray(parsed) ? parsed : [])
      .slice(0, 12)
      .map((i) => ({ label: String(i.label || ''), done: Boolean(i.done) }));
  } catch { /* degrade to [] */ }

  const t = checklist.plan_snapshot?.targets || null;
  const w = checklist.plan_snapshot?.workout || null;
  const num = (v) => (v == null ? null : Number(v));

  return {
    date: userDate || null,
    plannedWorkout: w
      ? {
          type: w.type || null,
          dayName: w.dayName || null,
          intensity: w.intensity || 'normal',
          exercises: (w.exercises || []).slice(0, 10).map((ex) => ex.name),
        }
      : null,
    targets: t
      ? {
          calorieTarget: t.calorieTarget ?? null,
          proteinGrams: t.proteinGrams ?? null,
          waterMl: t.waterMl ?? null,
          sleepHours: t.sleepHours ?? null,
          stepsTarget: t.stepsTarget ?? null,
        }
      : null,
    checklist: {
      workoutCompleted: Boolean(checklist.workout_completed),
      proteinCompleted: Boolean(checklist.protein_completed),
      caloriesCompleted: Boolean(checklist.calories_completed),
      waterCompleted: Boolean(checklist.water_completed),
      sleepCompleted: Boolean(checklist.sleep_completed),
      stepsCompleted: Boolean(checklist.steps_completed),
      proteinGrams: num(checklist.protein_grams),
      caloriesKcal: num(checklist.calories_kcal),
      waterMl: num(checklist.water_ml),
      sleepHours: num(checklist.sleep_hours),
      stepsCount: num(checklist.steps_count),
      weightKg: num(checklist.weight_kg),
      notes: checklist.notes || null,
      customItems,
    },
    meals: meals.slice(0, 15).map((m) => ({
      name: String(m.name || ''),
      calories: Math.round(Number(m.calories) || 0),
      protein: Math.round((Number(m.protein) || 0) * 10) / 10,
    })),
    mealTotals: {
      calories: meals.reduce((s, m) => s + (Number(m.calories) || 0), 0),
      protein: Math.round(meals.reduce((s, m) => s + (Number(m.protein) || 0), 0) * 10) / 10,
      count: meals.length,
    },
    setsLoggedToday: sets.map((s) => ({ exercise: String(s.exercise_name || ''), sets: Number(s.sets) || 0 })),
  };
}

async function buildActivitySnapshot(userId) {
  const userDate = (await getUserToday(userId)) || ymd(new Date());
  const [history, training, nutrition, today] = await Promise.all([
    getHistory(userId, 28),
    trainingDaySummary(userId, 14, userDate),
    dailyTotalsRecent(userId, 7, userDate),
    // Live layer is enrichment like the rest: its failure degrades the
    // answer, never blocks the chat.
    buildTodayBlock(userId).catch(() => null),
  ]);

  const weighIns = history
    .filter((r) => r.weight_kg != null)
    .slice(0, 5) // history is date-DESC: the 5 most recent
    .map((r) => ({ date: ymd(r.date), kg: Number(r.weight_kg) }))
    .reverse();

  const totalSets = training.reduce((s, t) => s + t.sets, 0);
  const totalVolumeKg = Math.round(training.reduce((s, t) => s + Number(t.volume_kg || 0), 0));

  const nutritionDays = nutrition.length;
  const avg = (key) => (nutritionDays ? Math.round(nutrition.reduce((s, n) => s + Number(n[key] || 0), 0) / nutritionDays) : null);

  return {
    date: userDate,
    adherence: adherenceFrom(history, userDate),
    recentWeighIns: weighIns,
    training14d: { sessions: training.length, sets: totalSets, volumeKg: totalVolumeKg },
    nutrition7d: { daysLogged: nutritionDays, avgCalories: avg('calories'), avgProtein: avg('protein') },
    today,
  };
}

module.exports = { buildActivitySnapshot };
