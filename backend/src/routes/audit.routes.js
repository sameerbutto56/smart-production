const express = require('express');
const {
  getAuditStats,
  startAudit,
  listAudits,
  getAudit,
  getAuditPrecheck,
  scanBarcode,
  batchScan,
  zeroItems,
  setPhysicalQty,
  submitAudit,
  approveAudit,
  rejectAudit,
  getPosLock
} = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Stats — dashboard cards (admin + warehouse)
router.get('/stats', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN']), getAuditStats);

// POS lock check — any authenticated user (OUTLET opens /pos, STORE opens /warehouse-pos)
router.get('/pos-lock', authenticate, getPosLock);

// Readiness precheck — blocks start when pending demand requests exist for the scope
router.get('/precheck', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN']), getAuditPrecheck);

// Start audit (warehouse only)
router.post('/', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), startAudit);

// History / listing
router.get('/', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN']), listAudits);

// Scanning / progress (warehouse only, audit must be IN_PROGRESS)
router.get('/:id', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN']), getAudit);
router.post('/:id/scan', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), scanBarcode);
router.post('/:id/batch-scan', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), batchScan);
router.post('/:id/zero', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), zeroItems);
router.post('/:id/items/:itemId', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), setPhysicalQty);

// Submit (warehouse only)
router.post('/:id/submit', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), submitAudit);

// Admin decision
router.post('/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), approveAudit);
router.post('/:id/reject', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), rejectAudit);

module.exports = router;
