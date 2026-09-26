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
  updateVendorOrderDiscount,
  submitVendorOrder,
  approveVendorOrder,
  sendToStore,
  buyItself,
  getStoreAllocationOrders,
  storeAllocate,
  storeCheckAvailability,
  allProductsAvailable,
  storeRoute,
  getLogoQueue,
  logoAccept,
  logoComplete,
  getProductionQueue,
  productionAccept,
  productionOut,
  getProductionReturns,
  receiveProductionReturn,
  returnToAsm,
  rejectVendorOrder,
  markProductionReady,
  giveStock,
  asmAccept,
  deliverOrder,
  completeOrder,
  recordPayment,
  updatePayment,
  listPayments,
  getFinancialSummary,
  getVendorFinancialDetail,
  generateDocuments,
  getOrderDocuments,
  saveDocumentRevision,
  getDocumentRevisions,
  getAnalytics,
  getAsmStats,
  listAsm,
} = require('../controllers/vendor.controller');

const router = express.Router();

// ── CATALOG / ANALYTICS (shared read — ASM + Admin) ─────────────────────────
// Read-only warehouse catalog for order lines (never mutates inventory)
router.get('/catalog', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getCatalog);

// Operational analytics & financial summary (Admin ASM Command Center)
router.get('/analytics', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getAnalytics);
router.get('/asm-stats', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getAsmStats);
router.get('/financial-summary', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getFinancialSummary);
router.get('/asm', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), listAsm);

// ── VENDOR CRUD (Admin + ASM — ASM creates vendors from the order modal) ────
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'ASM']), listVendors);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'ASM']), createVendor);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), updateVendor);

// NOTE: static sub-paths (/payments, /orders, /catalog, /analytics, /asm-stats,
// /financial-summary, /asm) MUST be declared before GET /:id, otherwise Express captures them as an
// :id parameter and they 404 as "Vendor not found."

// ── PAYMENTS (shared — ASM records, Admin view & edit) ─────────────────────
router.get('/payments', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'ASM']), listPayments);
router.put('/payments/:paymentId', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), updatePayment);

// ── ORDERS & STATIC QUEUES (declared BEFORE /orders/:id) ───────────────────
router.get('/orders/store-allocation', authenticate, authorize(['STORE', 'ASM', 'SUPER_ADMIN', 'ADMIN']), getStoreAllocationOrders);
router.get('/orders/logo-queue', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN', 'ASM', 'LOGO']), getLogoQueue);
router.get('/orders/production-queue', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN', 'ASM', 'PRODUCTION']), getProductionQueue);
router.get('/orders/production-returns', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), getProductionReturns);

router.get('/orders', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN', 'STORE']), listVendorOrders);
router.post('/orders', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), createVendorOrder);
router.get('/orders/:id', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN', 'STORE']), getVendorOrder);
router.put('/orders/:id/discount', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), updateVendorOrderDiscount);

// ── ORDER WORKFLOW ──────────────────────────────────────────────────────────
// Store availability, routing & allocation actions
router.post('/orders/:id/store-allocate', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), storeAllocate);
router.post('/orders/:id/store-check-availability', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), storeCheckAvailability);
router.post('/orders/:id/all-products-available', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), allProductsAvailable);
router.post('/orders/:id/store-route', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), storeRoute);

// Logo department actions
router.post('/orders/:id/logo-accept', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN', 'LOGO']), logoAccept);
router.post('/orders/:id/logo-complete', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN', 'LOGO']), logoComplete);

// Production department actions
router.post('/orders/:id/production-accept', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN', 'PRODUCTION']), productionAccept);
router.post('/orders/:id/production-out', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN', 'PRODUCTION']), productionOut);

// Store receiving returned production stock & routing to ASM
router.post('/orders/:id/receive-production-return', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), receiveProductionReturn);
router.post('/orders/:id/return-to-asm', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), returnToAsm);

// Admin actions
router.post('/orders/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), approveVendorOrder);
router.post('/orders/:id/send-to-store', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), sendToStore);
router.post('/orders/:id/buy-itself', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), buyItself);
router.post('/orders/:id/reject', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), rejectVendorOrder);
router.post('/orders/:id/production-ready', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), markProductionReady);
router.post('/orders/:id/give-stock', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), giveStock);

// ASM actions
router.post('/orders/:id/submit', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), submitVendorOrder);
router.post('/orders/:id/accept', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), asmAccept);
router.post('/orders/:id/receive', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), asmAccept);
router.post('/orders/:id/deliver', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), deliverOrder);

// Both — completion + payments + documents
router.post('/orders/:id/complete', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), completeOrder);
router.post('/orders/:id/pay', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), recordPayment);
router.post('/orders/:id/generate-documents', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), generateDocuments);
router.get('/orders/:id/documents', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), getOrderDocuments);
router.post('/orders/:id/document-revision', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN', 'STORE']), saveDocumentRevision);
router.get('/orders/:id/document-revisions', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN', 'STORE']), getDocumentRevisions);

// ── VENDOR BY ID (declared LAST so static sub-routes above win) ─────────────
router.get('/:id/financials', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getVendorFinancialDetail);
router.get('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'ASM']), getVendor);

module.exports = router;
