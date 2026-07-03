const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateRequest');
const { LogSetSchema } = require('../validators/requestSchemas');
const { postLogSet, getProgression, getExerciseHistory } = require('../controllers/workoutController');

const router = express.Router();
router.post('/log', requireAuth, validateBody(LogSetSchema), postLogSet);
router.get('/progression/:exercise', requireAuth, getProgression);
router.get('/history/:exercise', requireAuth, getExerciseHistory);

module.exports = router;
