const { listForUser } = require('../models/MemorySummary');

async function getSummaries(req, res, next) {
  try {
    const summaries = await listForUser(req.user.id, Number(req.query.limit) || 50);
    res.json(summaries);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummaries };
