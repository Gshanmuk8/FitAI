const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validateBody } = require('../middleware/validateRequest');
const { MealSchema } = require('../validators/requestSchemas');
const { postFoodImage } = require('../controllers/nutritionController');
const { postMeal, getTodayMeals, deleteMeal } = require('../controllers/mealController');

// Images only, checked before the file is buffered — anything else would
// travel the whole vision pipeline (memory, AI spend) before failing there.
const upload = multer({
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) return cb(null, true);
    const err = new Error('That upload is not an image — please send a photo (JPEG, PNG, WebP or HEIC).');
    err.status = 415;
    return cb(err);
  },
});
const router = express.Router();

// Analysis (AI, rate-limited) and the diary (plain CRUD) are separate
// steps on purpose: analyze -> user confirms/adjusts -> save to diary.
router.post('/analyze', requireAuth, aiLimiter, upload.single('image'), postFoodImage);
router.post('/meals', requireAuth, validateBody(MealSchema), postMeal);
router.get('/meals/today', requireAuth, getTodayMeals);
router.delete('/meals/:id', requireAuth, deleteMeal);

module.exports = router;
