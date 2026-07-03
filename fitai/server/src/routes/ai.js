const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validateBody } = require('../middleware/validateRequest');
const { TutorRequestSchema } = require('../validators/requestSchemas');
const { postTutorMessage } = require('../controllers/aiTutorController');

const router = express.Router();
router.post('/tutor', requireAuth, aiLimiter, validateBody(TutorRequestSchema), postTutorMessage);

module.exports = router;
