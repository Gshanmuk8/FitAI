const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateRequest');
const { ChecklistPatchSchema } = require('../validators/requestSchemas');
const { getTodayChecklist, patchChecklistItem, getChecklistHistory } = require('../controllers/checklistController');

const router = express.Router();
router.get('/today', requireAuth, getTodayChecklist);
router.patch('/today', requireAuth, validateBody(ChecklistPatchSchema), patchChecklistItem);
router.get('/history', requireAuth, getChecklistHistory);

module.exports = router;
