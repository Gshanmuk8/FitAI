const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateRequest');
const { PlanUpdateSchema } = require('../validators/requestSchemas');
const { getPlan, putPlan, postRegenerate } = require('../controllers/planController');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.get('/', requireAuth, getPlan);
router.put('/', requireAuth, validateBody(PlanUpdateSchema), putPlan);
router.post('/regenerate', requireAuth, aiLimiter, postRegenerate);

module.exports = router;
