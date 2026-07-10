const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validateBody } = require('../middleware/validateRequest');
const { OnboardingSchema } = require('../validators/requestSchemas');
const { completeOnboarding, getOnboardingStatus } = require('../controllers/onboardingController');

const router = express.Router();
// aiLimiter: completing onboarding runs AI plan generation — the same
// expensive path /api/plan/regenerate rate-limits.
router.post('/', requireAuth, aiLimiter, validateBody(OnboardingSchema), completeOnboarding);
router.get('/', requireAuth, getOnboardingStatus);

module.exports = router;
