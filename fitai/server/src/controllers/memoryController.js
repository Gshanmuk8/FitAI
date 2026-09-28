const { listForUser, deleteForUser } = require("../models/MemorySummary");

async function getSummaries(req, res, next) {
  try {
    // Clamp: ?limit=-5 would be a Postgres error (negative LIMIT -> 500),
    // and an unbounded limit is a free table scan.
    const limit = Math.floor(
      Math.min(Math.max(Number(req.query.limit) || 50, 1), 200),
    );
    const summaries = await listForUser(req.user.id, limit);
    res.json(summaries);
  } catch (err) {
    next(err);
  }
}

async function deleteSummary(req, res, next) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      req.params.id,
    )
  )
    return res.status(400).json({ error: "Invalid memory identifier." });
  try {
    const deleted = await deleteForUser(req.user.id, req.params.id);
    if (!deleted)
      return res
        .status(404)
        .json({ error: "This memory is no longer available." });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummaries, deleteSummary };
