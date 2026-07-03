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

async function deleteMeal(req, res, next) {
  try {
    const removed = await Meal.deleteMeal(req.user.id, req.params.id, await getUserToday(req.user.id));
    if (!removed) return res.status(404).json({ error: 'Meal not found (only today\'s meals can be removed).' });
    res.json({ status: 'deleted', summary: await getTodaySummary(req.user.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { postMeal, getTodayMeals, deleteMeal };
