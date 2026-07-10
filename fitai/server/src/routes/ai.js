const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validateBody } = require('../middleware/validateRequest');
const { TutorRequestSchema } = require('../validators/requestSchemas');
const { postTutorMessage } = require('../controllers/aiTutorController');
const { getBriefing } = require('../controllers/aiBriefingController');

const router = express.Router();
router.post('/tutor', requireAuth, aiLimiter, validateBody(TutorRequestSchema), postTutorMessage);
// Cached one row per user per day on success — but on provider-outage days
// the fallback is NOT persisted, so without aiLimiter every dashboard load
// would re-run the full provider cascade. The limiter is the backstop; the
// service adds in-flight dedup + a short fallback memo on top.
router.get('/briefing', requireAuth, aiLimiter, getBriefing);

module.exports = router;
