const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validateBody } = require('../middleware/validateRequest');
const { MealSchema } = require('../validators/requestSchemas');
const { postFoodImage } = require('../controllers/nutritionController');
const { postMeal, getTodayMeals, deleteMeal } = require('../controllers/mealController');

const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });
const router = express.Router();

// Analysis (AI, rate-limited) and the diary (plain CRUD) are separate
// steps on purpose: analyze -> user confirms/adjusts -> save to diary.
router.post('/analyze', requireAuth, aiLimiter, upload.single('image'), postFoodImage);
router.post('/meals', requireAuth, validateBody(MealSchema), postMeal);
router.get('/meals/today', requireAuth, getTodayMeals);
router.delete('/meals/:id', requireAuth, deleteMeal);

module.exports = router;
