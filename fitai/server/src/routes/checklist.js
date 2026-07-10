const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateRequest');
const {
  ChecklistPatchSchema, ChecklistValuesSchema, CustomItemAddSchema, CustomItemPatchSchema,
} = require('../validators/requestSchemas');
const {
  getTodayChecklist, patchChecklistItem, patchChecklistValues,
  postCustomItem, patchCustomItem, deleteCustomItem, getChecklistHistory,
} = require('../controllers/checklistController');

const router = express.Router();
router.get('/today', requireAuth, getTodayChecklist);
router.get('/history', requireAuth, getChecklistHistory);
router.patch('/today', requireAuth, validateBody(ChecklistPatchSchema), patchChecklistItem);
router.patch('/today/values', requireAuth, validateBody(ChecklistValuesSchema), patchChecklistValues);
router.post('/today/custom', requireAuth, validateBody(CustomItemAddSchema), postCustomItem);
router.patch('/today/custom/:id', requireAuth, validateBody(CustomItemPatchSchema), patchCustomItem);
router.delete('/today/custom/:id', requireAuth, deleteCustomItem);

module.exports = router;
