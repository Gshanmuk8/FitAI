const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateRequest');
const { OnboardingSchema } = require('../validators/requestSchemas');
const { completeOnboarding, getOnboardingStatus } = require('../controllers/onboardingController');

const router = express.Router();
router.post('/', requireAuth, validateBody(OnboardingSchema), completeOnboarding);
router.get('/', requireAuth, getOnboardingStatus);

module.exports = router;
