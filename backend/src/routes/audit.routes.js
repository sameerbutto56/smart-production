const express = require('express');
const {
  getAuditStats,
  startAudit,
  listAudits,
  getAudit,
  scanBarcode,
  batchScan,
  setPhysicalQty,
  submitAudit,
  approveAudit,
  rejectAudit
} = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Stats — dashboard cards (admin + warehouse)
router.get('/stats', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN']), getAuditStats);

// Start audit (warehouse only)
router.post('/', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), startAudit);

// History / listing
router.get('/', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN']), listAudits);

// Scanning / progress (warehouse only, audit must be IN_PROGRESS)
router.get('/:id', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN']), getAudit);
router.post('/:id/scan', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), scanBarcode);
router.post('/:id/batch-scan', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), batchScan);
router.post('/:id/items/:itemId', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), setPhysicalQty);

// Submit (warehouse only)
router.post('/:id/submit', authenticate, authorize(['STORE', 'STORE_EMPLOYEE']), submitAudit);

// Admin decision
router.post('/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), approveAudit);
router.post('/:id/reject', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), rejectAudit);

module.exports = router;
