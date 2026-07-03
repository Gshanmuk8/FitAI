const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getOrGenerateReview } = require('../services/reviews/reviewService');
const { listRecent } = require('../models/Review');
const { FLAGS } = require('../config/featureFlags');

const router = express.Router();

// GET /api/reviews?period=weekly|monthly — latest completed period,
// generated on first read.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!FLAGS.reviews) return res.status(404).json({ error: 'Reviews are disabled.' });
    const period = req.query.period === 'monthly' ? 'monthly' : 'weekly';
    res.json(await getOrGenerateReview(req.user.id, period));
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/history?period=weekly — previously generated reviews.
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    if (!FLAGS.reviews) return res.status(404).json({ error: 'Reviews are disabled.' });
    const period = req.query.period === 'monthly' ? 'monthly' : 'weekly';
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 52);
    res.json(await listRecent(req.user.id, period, limit));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
