const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getMyPermissions,
  getSystemControlMatrix,
  updateSystemControlPermission,
  getSystemControlAuditLogs,
} = require('../controllers/systemControl.controller');

const router = express.Router();

// Any authenticated user can get their own enabled permissions
router.get('/my-permissions', authenticate, getMyPermissions);

// Management endpoints: SOFTWARE_SETTINGS and SUPER_ADMIN only
router.get('/matrix', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN']), getSystemControlMatrix);
router.put('/permission', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN']), updateSystemControlPermission);
router.get('/audit-logs', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN']), getSystemControlAuditLogs);

module.exports = router;
