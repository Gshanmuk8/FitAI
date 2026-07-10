const { getTodayBriefing } = require('../services/ai/briefingService');

async function getBriefing(req, res, next) {
  try {
    const briefing = await getTodayBriefing(req.user.id);
    if (!briefing) return res.status(404).json({ error: 'No profile found — complete onboarding first.' });
    res.json(briefing);
  } catch (err) {
    next(err);
  }
}

module.exports = { getBriefing };
