const express = require('express');
const router = express.Router();
const portalCtrl = require('../controllers/employeePortal.controller');

// Public route: check if portal is enabled
router.get('/auth/status', portalCtrl.getPortalStatus);

// Public route: Employee login (gated by Software Settings master switch internally)
router.post('/auth/login', portalCtrl.login);

// Guarded employee self-service routes (requires valid Employee session token + active portal setting)
router.use(portalCtrl.authenticateEmployee);

router.get('/me', portalCtrl.getMyProfile);
router.get('/dashboard', portalCtrl.getMyDashboard);
router.get('/attendance', portalCtrl.getMyAttendance);
router.get('/leaves', portalCtrl.getMyLeaves);
router.post('/leaves', portalCtrl.submitMyLeave);
router.get('/loans', portalCtrl.getMyLoans);
router.get('/production', portalCtrl.getMyProduction);
router.get('/payroll', portalCtrl.getMyPayrolls);
router.get('/payroll/:monthYear', portalCtrl.getMyPayrollDetail);
router.post('/change-password', portalCtrl.changeMyPassword);

module.exports = router;
