const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateRequest');
const { WeightLogSchema } = require('../validators/requestSchemas');
const { getProgress, postWeight, getWeights } = require('../controllers/progressController');

const router = express.Router();
router.get('/', requireAuth, getProgress);
router.post('/weight', requireAuth, validateBody(WeightLogSchema), postWeight);
router.get('/weights', requireAuth, getWeights);

module.exports = router;
