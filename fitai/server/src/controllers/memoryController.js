const { listForUser } = require('../models/MemorySummary');

async function getSummaries(req, res, next) {
  try {
    // Clamp: ?limit=-5 would be a Postgres error (negative LIMIT -> 500),
    // and an unbounded limit is a free table scan.
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const summaries = await listForUser(req.user.id, limit);
    res.json(summaries);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummaries };
