const express = require('express');
const { getUsers, getUserTheme, updateUserTheme } = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), getUsers);
router.get('/me/theme', authenticate, getUserTheme);
router.put('/me/theme', authenticate, updateUserTheme);

module.exports = router;
