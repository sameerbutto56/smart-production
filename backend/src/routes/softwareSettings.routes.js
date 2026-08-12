const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  resetPassword,
  verifyEmployee,
  getPaymentChangeOutlets,
  getPaymentChangeInvoices,
  getPaymentChangeHistory,
  changePaymentMethod,
  getDelayConfig,
  updateDelayConfig,
} = require('../controllers/softwareSettings.controller');

const router = express.Router();

// Shared, authenticated-only — used by POS / Dispatch / Faisal profile / Outlet Order Entry
router.post('/verify-employee', authenticate, verifyEmployee);

// Management endpoints — SOFTWARE_SETTINGS, SUPER_ADMIN, ADMIN
router.get('/employees', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), getAllEmployees);
router.post('/employees', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), createEmployee);
router.patch('/employees/:id', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), updateEmployee);
router.post('/employees/:id/reset-password', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), resetPassword);

// Payment method change — SOFTWARE_SETTINGS, SUPER_ADMIN, ADMIN
router.get('/payment-change/outlets', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), getPaymentChangeOutlets);
router.get('/payment-change/invoices', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), getPaymentChangeInvoices);
router.get('/payment-change/history', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), getPaymentChangeHistory);
router.post('/payment-change', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), changePaymentMethod);

// Delay threshold configuration — SOFTWARE_SETTINGS, SUPER_ADMIN, ADMIN
router.get('/delay-config', authenticate, getDelayConfig);
router.post('/delay-config', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN']), updateDelayConfig);

module.exports = router;
