const express = require('express');
const multer = require('multer');
const {
  verifyAbbottabadPassword,
  changeAbbottabadPassword,
  requireAbbottabadAuth,
  getDemandFinancialSummary,
  getDemandFinancialDetails,
  uploadCostPriceExcel,
  getCostPriceUploadHistory,
  getAmountAccountState,
  proposeAmountChange,
  approveAmountProposal,
  rejectAmountProposal,
  getAmountLedger,
  exportDemandsExcel
} = require('../controllers/abbottabad.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CEO'];
const ALL_AUTHORIZED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'OUTLET'];

// 1. Password Verification & Management
router.post('/auth/verify', authenticate, asyncHandler(verifyAbbottabadPassword));
router.post('/auth/change-password', authenticate, authorize(ADMIN_ROLES), asyncHandler(changeAbbottabadPassword));

// 2. Financial Summary & Details (Guarded: Admin sees costs, Outlet/POS sees actuals)
router.get('/demand-summary', authenticate, authorize(ALL_AUTHORIZED_ROLES), asyncHandler(getDemandFinancialSummary));
router.get('/demands', authenticate, authorize(ALL_AUTHORIZED_ROLES), asyncHandler(getDemandFinancialDetails));

// 3. Cost Price Excel Upload & History (Admin only)
router.post('/cost-price/upload', authenticate, authorize(ADMIN_ROLES), upload.single('file'), asyncHandler(uploadCostPriceExcel));
router.get('/cost-price/history', authenticate, authorize(ADMIN_ROLES), asyncHandler(getCostPriceUploadHistory));

// 4. Amount Control System (Shared by Admin and Abbottabad POS)
router.get('/amount/state', authenticate, authorize(ALL_AUTHORIZED_ROLES), asyncHandler(getAmountAccountState));
router.post('/amount/propose', authenticate, authorize(ALL_AUTHORIZED_ROLES), asyncHandler(proposeAmountChange));
router.post('/amount/approve/:id', authenticate, authorize(ALL_AUTHORIZED_ROLES), asyncHandler(approveAmountProposal));
router.post('/amount/reject/:id', authenticate, authorize(ALL_AUTHORIZED_ROLES), asyncHandler(rejectAmountProposal));
router.get('/amount/ledger', authenticate, authorize(ALL_AUTHORIZED_ROLES), asyncHandler(getAmountLedger));

// 5. Excel Export
router.get('/export-excel', authenticate, authorize(ALL_AUTHORIZED_ROLES), asyncHandler(exportDemandsExcel));

module.exports = router;
