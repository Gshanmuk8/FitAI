const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSummaries } = require('../controllers/memoryController');

const router = express.Router();
router.get('/summaries', requireAuth, getSummaries);

module.exports = router;
