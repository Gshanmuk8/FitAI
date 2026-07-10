const { getProgress } = require('../services/progress/progressAnalysisService');

async function getProgressReport(req, res, next) {
  try {
    const report = await getProgress(req.user.id);
    if (!report) return res.status(404).json({ error: 'No profile found — complete onboarding first.' });
    res.json(report);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProgressReport };
