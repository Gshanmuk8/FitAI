const { getProgressReport, logWeight } = require('../services/progress/progressService');
const { listRecent } = require('../models/BodyWeightLog');

async function getProgress(req, res, next) {
  try {
    const report = await getProgressReport(req.user.id);
    if (!report) return res.status(404).json({ error: 'No profile found — complete onboarding first.' });
    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function postWeight(req, res, next) {
  try {
    const entry = await logWeight(req.user.id, req.body.weightKg);
    res.json(entry);
  } catch (err) {
    next(err);
  }
}

async function getWeights(req, res, next) {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 1), 365);
    res.json(await listRecent(req.user.id, days));
  } catch (err) {
    next(err);
  }
}

module.exports = { getProgress, postWeight, getWeights };
