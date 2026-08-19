const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getState, getHistory, getPauseProfileConfig, updatePauseProfileConfig, pause, resume, getTimer,
} = require('../controllers/system.controller');

const CONTROL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS'];

// Any authenticated user can read the current state (drives the global banner/poll).
router.get('/state', authenticate, getState);

// Pause-profile configuration (Software Settings primary, Admin also allowed).
router.get('/pause-profiles', authenticate, authorize(CONTROL_ROLES), getPauseProfileConfig);
router.put('/pause-profiles', authenticate, authorize(CONTROL_ROLES), updatePauseProfileConfig);

// Control (pause/resume/history) is restricted to admin + software-settings roles.
router.post('/pause', authenticate, authorize(CONTROL_ROLES), pause);
router.post('/resume', authenticate, authorize(CONTROL_ROLES), resume);
router.get('/history', authenticate, authorize(CONTROL_ROLES), getHistory);

// Timer state — any authenticated user (drives synchronized timer banners).
router.get('/timer-state', authenticate, getTimer);

module.exports = router;
