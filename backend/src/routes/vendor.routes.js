const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getCatalog,
  listVendors,
  createVendor,
  updateVendor,
  getVendor,
  createVendorOrder,
  listVendorOrders,
  getVendorOrder,
  submitVendorOrder,
  approveVendorOrder,
  rejectVendorOrder,
  markProductionReady,
  giveStock,
  asmAccept,
  deliverOrder,
  completeOrder,
  recordPayment,
  listPayments,
  generateDocuments,
  getOrderDocuments,
  getAnalytics,
  getAsmStats,
  listAsm,
} = require('../controllers/vendor.controller');

const router = express.Router();

// ── CATALOG / ANALYTICS (shared read — ASM + Admin) ─────────────────────────
// Read-only warehouse catalog for order lines (never mutates inventory)
router.get('/catalog', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getCatalog);

// Operational analytics (ASM is NOT revenue — no Revenue Generated)
router.get('/analytics', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getAnalytics);
router.get('/asm-stats', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getAsmStats);
router.get('/asm', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), listAsm);

// ── VENDOR CRUD (Admin only) ────────────────────────────────────────────────
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), listVendors);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), createVendor);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), updateVendor);

// NOTE: static sub-paths (/payments, /orders, /catalog, /analytics, /asm-stats,
// /asm) MUST be declared before GET /:id, otherwise Express captures them as an
// :id parameter and they 404 as "Vendor not found."

// ── PAYMENTS (shared — ASM records, Admin view) ─────────────────────────────
router.get('/payments', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'ASM']), listPayments);

// ── ORDERS ─────────────────────────────────────────────────────────────────
router.get('/orders', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), listVendorOrders);
router.post('/orders', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), createVendorOrder);
router.get('/orders/:id', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getVendorOrder);

// ── ORDER WORKFLOW ──────────────────────────────────────────────────────────
// ASM actions
router.post('/orders/:id/submit', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), submitVendorOrder);
router.post('/orders/:id/accept', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), asmAccept);
router.post('/orders/:id/deliver', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), deliverOrder);

// Admin actions
router.post('/orders/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), approveVendorOrder);
router.post('/orders/:id/reject', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), rejectVendorOrder);
router.post('/orders/:id/production-ready', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), markProductionReady);
router.post('/orders/:id/give-stock', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), giveStock);

// Both — completion + payments + documents
router.post('/orders/:id/complete', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), completeOrder);
router.post('/orders/:id/pay', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), recordPayment);
router.post('/orders/:id/generate-documents', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), generateDocuments);
router.get('/orders/:id/documents', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getOrderDocuments);

// ── VENDOR BY ID (declared LAST so static sub-routes above win) ─────────────
router.get('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'ASM']), getVendor);

module.exports = router;
