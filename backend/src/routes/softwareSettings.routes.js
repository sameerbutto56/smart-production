const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  resetPassword,
  verifyEmployee,
} = require('../controllers/softwareSettings.controller');

const router = express.Router();

// Shared, authenticated-only — used by POS / Dispatch / Faisal profile / Outlet Order Entry
router.post('/verify-employee', authenticate, verifyEmployee);

// Management endpoints — SOFTWARE_SETTINGS only
router.get('/employees', authenticate, authorize('SOFTWARE_SETTINGS'), getAllEmployees);
router.post('/employees', authenticate, authorize('SOFTWARE_SETTINGS'), createEmployee);
router.patch('/employees/:id', authenticate, authorize('SOFTWARE_SETTINGS'), updateEmployee);
router.post('/employees/:id/reset-password', authenticate, authorize('SOFTWARE_SETTINGS'), resetPassword);

module.exports = router;
