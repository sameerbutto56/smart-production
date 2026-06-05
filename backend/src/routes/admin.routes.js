const express = require('express');
const { clearAllData, togglePause, getPauseStatus, getDeadlineConfig, updateDeadlineConfig, getPerformanceAnalytics, getTheme, updateTheme, changeUserPassword } = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.post('/clear-data', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), clearAllData);
router.post('/pause', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), togglePause);
router.get('/pause-status', authenticate, getPauseStatus);
router.get('/deadline-config', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), getDeadlineConfig);
router.put('/deadline-config', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), updateDeadlineConfig);
router.get('/theme', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), getTheme);
router.put('/theme', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), updateTheme);
router.get('/performance', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), getPerformanceAnalytics);
router.put('/change-password', authenticate, authorize(['SUPER_ADMIN']), changeUserPassword);

module.exports = router;
