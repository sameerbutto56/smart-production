const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  logWrongAttempt,
  getWrongAttemptStats,
  getWrongAttempts,
} = require('../controllers/wrongAttempt.controller');

const router = express.Router();

// Log a blocked attempt (any authenticated user — Order Entry / Faisal / Outlet all log)
router.post('/log', authenticate, logWrongAttempt);

// Admin read endpoints — SUPER_ADMIN / ADMIN (Admin Dashboard card + timeline)
router.get('/stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getWrongAttemptStats);
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getWrongAttempts);

module.exports = router;
