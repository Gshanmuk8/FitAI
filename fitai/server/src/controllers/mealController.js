const Meal = require('../models/Meal');
const { addMealAndSync, getTodaySummary } = require('../services/nutrition/mealDiaryService');
const { getUserToday } = require('../utils/userDate');

async function postMeal(req, res, next) {
  try {
    res.json(await addMealAndSync(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function getTodayMeals(req, res, next) {
  try {
    const summary = await getTodaySummary(req.user.id);
    const meals = await Meal.listToday(req.user.id, summary.userDate);
    res.json({ meals, summary });
  } catch (err) {
    next(err);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function deleteMeal(req, res, next) {
  try {
    // A non-UUID id would be a Postgres type error (22P02) -> opaque 500.
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Meal not found (only today\'s meals can be removed).' });
    }
    const removed = await Meal.deleteMeal(req.user.id, req.params.id, await getUserToday(req.user.id));
    if (!removed) return res.status(404).json({ error: 'Meal not found (only today\'s meals can be removed).' });
    res.json({ status: 'deleted', summary: await getTodaySummary(req.user.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { postMeal, getTodayMeals, deleteMeal };
