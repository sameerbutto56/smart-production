const express = require('express');
const { getUsers, getUserTheme, updateUserTheme, getUserPreferences, updateUserPreferences } = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN', 'SOFTWARE_SETTINGS']), getUsers);
router.get('/me/theme', authenticate, getUserTheme);
router.put('/me/theme', authenticate, updateUserTheme);
router.get('/me/preferences', authenticate, getUserPreferences);
router.put('/me/preferences', authenticate, updateUserPreferences);

module.exports = router;

