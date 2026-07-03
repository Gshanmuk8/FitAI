const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listForUser } = require('../models/Achievement');

const router = express.Router();
router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await listForUser(req.user.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
