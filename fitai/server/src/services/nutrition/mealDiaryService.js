/**
 * The nutrition loop, closed: meals land in the diary, the diary tallies
 * against the plan's targets, and the day's checklist row is kept in sync —
 * values AND completions, in BOTH directions. Adding a meal raises the
 * day's protein/calorie figures; deleting one lowers them and, if the total
 * falls back below target, un-checks the item — the checkbox and the number
 * must never disagree (same rule as manual entry in checklistService).
 *
 * The sync is awaited so the response the client renders already reflects
 * the synced state (the old fire-and-forget raced the next read) — but a
 * sync failure only logs; it must never fail the meal save itself.
 */
const Meal = require('../../models/Meal');
const { updateChecklistFields } = require('../../models/DailyChecklist');
const { getTodayEnriched, valueCompletion } = require('../checklist/checklistService');
const logger = require('../../utils/logger');

async function addMealAndSync(userId, meal) {
  const checklist = await getTodayEnriched(userId); // creates today's row (and targets) if absent
  const saved = await Meal.insertMeal(userId, meal, checklist.userDate);
  const summary = await syncFromDiary(userId, checklist);
  return { meal: saved, summary };
}

async function removeMealAndSync(userId, mealId) {
  const checklist = await getTodayEnriched(userId);
  const removed = await Meal.deleteMeal(userId, mealId, checklist.userDate);
  if (!removed) return null;
  return syncFromDiary(userId, checklist);
}

// Recompute today's diary totals, write them into the checklist row, and
// re-derive both completions with the same rule every other write path uses.
async function syncFromDiary(userId, checklist) {
  const totals = await Meal.todayTotals(userId, checklist.userDate);
  const snapshot = checklist?.plan_snapshot || {};
  const summary = summarize(checklist, totals);

  try {
    // The diary total IS the day's figure — the dashboard fields fill
    // themselves and the user never types the same number twice. One
    // source of truth: meals (a manual entry is the fallback for days
    // the diary isn't used).
    const fields = {
      protein_grams: summary.protein,
      calories_kcal: summary.calories,
      protein_completed: valueCompletion('protein_grams', summary.protein, snapshot.targets, snapshot.goal),
      calories_completed: valueCompletion('calories_kcal', summary.calories, snapshot.targets, snapshot.goal),
    };
    const updated = await updateChecklistFields(userId, fields, checklist.userDate);
    summary.proteinCompleted = Boolean(updated.protein_completed);
    summary.caloriesCompleted = Boolean(updated.calories_completed);
  } catch (err) {
    logger.error('meal->checklist sync failed', { error: err.message });
  }
  return summary;
}

async function getTodaySummary(userId) {
  // getTodayEnriched resolves the user's local date itself and returns it,
  // so the meal totals are keyed to the same day the checklist lives on.
  const checklist = await getTodayEnriched(userId);
  const totals = await Meal.todayTotals(userId, checklist.userDate);
  return summarize(checklist, totals);
}

function summarize(checklist, totals) {
  const targets = checklist?.plan_snapshot?.targets || null;
  return {
    calories: totals.calories,
    protein: Number(totals.protein.toFixed(1)),
    mealCount: totals.meals,
    // The goal decides which direction the calorie bar reads (over budget
    // on a cut vs fuel reached on a bulk) — the client colors by this.
    goal: checklist?.plan_snapshot?.goal ?? null,
    targets: targets
      ? { calorieTarget: targets.calorieTarget ?? null, proteinGrams: targets.proteinGrams ?? null }
      : null,
    proteinTargetHit: Boolean(targets?.proteinGrams && totals.protein >= targets.proteinGrams),
    proteinCompleted: Boolean(checklist?.protein_completed),
    caloriesCompleted: Boolean(checklist?.calories_completed),
    userDate: checklist.userDate ?? null,
  };
}

module.exports = { addMealAndSync, removeMealAndSync, getTodaySummary };
