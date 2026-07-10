const { updateChecklistItem, getHistory } = require('../models/DailyChecklist');
const {
  getTodayEnriched, setChecklistValues, addCustomItem, setCustomItemDone, removeCustomItem,
} = require('../services/checklist/checklistService');
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
    // Ensure today's row exists first: a client left open across the user's
    // midnight would otherwise UPDATE zero rows and return an empty 200 —
    // the toggle silently lost. getTodayEnriched creates the row on demand.
    await getTodayEnriched(req.user.id);
    const updated = await updateChecklistItem(req.user.id, field, value, await getUserToday(req.user.id));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function patchChecklistValues(req, res, next) {
  try {
    const updated = await setChecklistValues(req.user.id, req.body);
    res.json({ ...updated, score: checklistScore(updated) });
  } catch (err) {
    next(err);
  }
}

async function postCustomItem(req, res, next) {
  try {
    const updated = await addCustomItem(req.user.id, req.body.label);
    res.json({ ...updated, score: checklistScore(updated) });
  } catch (err) {
    next(err);
  }
}

async function patchCustomItem(req, res, next) {
  try {
    const updated = await setCustomItemDone(req.user.id, req.params.id, req.body.done);
    res.json({ ...updated, score: checklistScore(updated) });
  } catch (err) {
    next(err);
  }
}

async function deleteCustomItem(req, res, next) {
  try {
    const updated = await removeCustomItem(req.user.id, req.params.id);
    res.json({ ...updated, score: checklistScore(updated) });
  } catch (err) {
    next(err);
  }
}

// Recent day-rows for the Progress page's adherence view — raw history,
// newest first, capped at 90 days.
async function getChecklistHistory(req, res, next) {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 28, 1), 90);
    res.json(await getHistory(req.user.id, days));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTodayChecklist, patchChecklistItem, patchChecklistValues,
  postCustomItem, patchCustomItem, deleteCustomItem, getChecklistHistory,
};
