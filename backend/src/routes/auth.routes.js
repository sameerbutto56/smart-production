const express = require('express');
const { register, login, logout, getLoginSessions } = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// Only SUPER_ADMIN can create new user accounts
  router.post('/register', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS']), register);
router.post('/login', login);
// Close the most recent active login session (fire-and-forget from the frontend)
router.post('/logout', authenticate, logout);
// Profile login history — Admin Dashboard card + Software Settings login history
router.get('/sessions', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), getLoginSessions);

module.exports = router;
