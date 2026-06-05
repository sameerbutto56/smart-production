const express = require('express');
const { clearAllData, togglePause, getPauseStatus, getStageDurations, updateStageDurations, updateSLAConfig, updateProfileDeadlines, getPerformanceAnalytics, getTheme, updateTheme } = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.post('/clear-data', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), clearAllData);
router.post('/pause', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), togglePause);
router.get('/pause-status', authenticate, getPauseStatus);
router.get('/stage-durations', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), getStageDurations);
router.put('/stage-durations', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), updateStageDurations);
router.put('/sla-config', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), updateSLAConfig);
router.put('/profile-deadlines', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), updateProfileDeadlines);
router.get('/theme', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), getTheme);
router.put('/theme', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), updateTheme);
router.get('/performance', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), getPerformanceAnalytics);

module.exports = router;
