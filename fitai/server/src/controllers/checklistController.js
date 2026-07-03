const { updateChecklistItem, getHistory } = require('../models/DailyChecklist');
const { getTodayEnriched } = require('../services/checklist/checklistService');
const { getUserToday } = require('../utils/userDate');
const { checklistScore } = require('../../../shared/calculations/workoutRules');

async function getTodayChecklist(req, res, next) {
  try {
    const checklist = await getTodayEnriched(req.user.id);
    res.json({ ...checklist, score: checklistScore(checklist) });
  } catch (err) {
    next(err);
  }
}

async function patchChecklistItem(req, res, next) {
  try {
    const { field, value } = req.body;
    const updated = await updateChecklistItem(req.user.id, field, value, await getUserToday(req.user.id));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function getChecklistHistory(req, res, next) {
  try {
    // Clamp so a hostile ?days=100000 can't turn into an unbounded scan.
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
    const history = await getHistory(req.user.id, days);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTodayChecklist, patchChecklistItem, getChecklistHistory };
