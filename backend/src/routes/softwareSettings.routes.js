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

// Management endpoints — SOFTWARE_SETTINGS only
router.get('/employees', authenticate, authorize('SOFTWARE_SETTINGS'), getAllEmployees);
router.post('/employees', authenticate, authorize('SOFTWARE_SETTINGS'), createEmployee);
router.patch('/employees/:id', authenticate, authorize('SOFTWARE_SETTINGS'), updateEmployee);
router.post('/employees/:id/reset-password', authenticate, authorize('SOFTWARE_SETTINGS'), resetPassword);

// Payment method change — SOFTWARE_SETTINGS only
router.get('/payment-change/outlets', authenticate, authorize('SOFTWARE_SETTINGS'), getPaymentChangeOutlets);
router.get('/payment-change/invoices', authenticate, authorize('SOFTWARE_SETTINGS'), getPaymentChangeInvoices);
router.get('/payment-change/history', authenticate, authorize('SOFTWARE_SETTINGS'), getPaymentChangeHistory);
router.post('/payment-change', authenticate, authorize('SOFTWARE_SETTINGS'), changePaymentMethod);

// Delay threshold configuration — read: any authenticated user; write: SOFTWARE_SETTINGS only
router.get('/delay-config', authenticate, getDelayConfig);
router.post('/delay-config', authenticate, authorize('SOFTWARE_SETTINGS'), updateDelayConfig);

module.exports = router;
