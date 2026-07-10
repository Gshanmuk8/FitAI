/**
 * The nutrition loop, closed: meals land in the diary, the diary tallies
 * against the plan's targets, and hitting a target completes the matching
 * checklist item automatically. Auto-completion is one-way — the system
 * checks a box when the data proves it, but never un-checks one, so a
 * user's manual toggles always survive.
 */
const Meal = require('../../models/Meal');
const { updateChecklistItem, updateChecklistFields } = require('../../models/DailyChecklist');
const { getTodayEnriched } = require('../checklist/checklistService');
const { getUserToday } = require('../../utils/userDate');
const logger = require('../../utils/logger');

async function addMealAndSync(userId, meal) {
  const saved = await Meal.insertMeal(userId, meal, await getUserToday(userId));
  const summary = await getTodaySummary(userId);

  // Fire-and-forget sync: diary totals proving a target met must never
  // fail the save itself.
  syncChecklist(userId, summary).catch((err) =>
    logger.error('meal->checklist sync failed', { error: err.message })
  );

  return { meal: saved, summary };
}

async function getTodaySummary(userId) {
  // getTodayEnriched resolves the user's local date itself and returns it,
  // so the meal totals are keyed to the same day the checklist lives on.
  const checklist = await getTodayEnriched(userId); // creates today's row (and targets) if absent
  const totals = await Meal.todayTotals(userId, checklist.userDate);
  const targets = checklist?.plan_snapshot?.targets || null;
  return {
    calories: totals.calories,
    protein: Number(totals.protein.toFixed(1)),
    mealCount: totals.meals,
    targets: targets
      ? { calorieTarget: targets.calorieTarget ?? null, proteinGrams: targets.proteinGrams ?? null }
      : null,
    proteinTargetHit: Boolean(targets?.proteinGrams && totals.protein >= targets.proteinGrams),
    proteinCompleted: Boolean(checklist?.protein_completed),
    userDate: checklist.userDate ?? null,
  };
}

async function syncChecklist(userId, summary) {
  // The diary total IS the day's protein figure — write it into the
  // checklist's protein_grams so the dashboard field fills itself and the
  // user never types the same number twice. One source of truth: meals.
  await updateChecklistFields(userId, { protein_grams: summary.protein }, summary.userDate);
  if (summary.proteinTargetHit && !summary.proteinCompleted) {
    await updateChecklistItem(userId, 'protein_completed', true, summary.userDate);
  }
}

module.exports = { addMealAndSync, getTodaySummary };
