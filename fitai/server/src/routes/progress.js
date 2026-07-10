const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { getProgressReport } = require('../controllers/progressController');

const router = express.Router();
// aiLimiter: first view of the day runs an AI analysis; the table-layer
// cache makes subsequent views cheap, but the endpoint is still AI-shaped.
router.get('/', requireAuth, aiLimiter, getProgressReport);

module.exports = router;
