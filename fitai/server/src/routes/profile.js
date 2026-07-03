const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateRequest');
const { ProfileUpdateSchema } = require('../validators/requestSchemas');
const { getMyProfile, patchMyProfile } = require('../controllers/profileController');

const router = express.Router();
router.get('/', requireAuth, getMyProfile);
router.patch('/', requireAuth, validateBody(ProfileUpdateSchema), patchMyProfile);

module.exports = router;
