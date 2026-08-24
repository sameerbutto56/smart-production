const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/auth.middleware');
const {
  getConfig, setConfig, createShipment, getShipments, getShipment,
  cancelShipment, trackShipment, handleWebhook, getAllShipments, getIncomingReturns,
  getDashboardStats, syncStatuses, trackShipmentLive
} = require('../controllers/postex.controller');

const router = express.Router();

// ─── Feature Flag / Config ─────────────────────────────────────────────────
// GET  /api/postex/config        — any authenticated user
// PUT  /api/postex/config        — SUPER_ADMIN, ADMIN, SOFTWARE_SETTINGS
router.get('/config', authenticate, getConfig);
router.put('/config', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS']), setConfig);

// ─── Webhook (no auth — PostEx calls this directly) ────────────────────────
// POST /api/postex/webhook       — public (validated by PostEx IP/signature later)
router.post('/webhook', handleWebhook);

// ─── Shipment CRUD ─────────────────────────────────────────────────────────
// POST /api/postex/shipments/:orderId     — create shipment for an order
// GET  /api/postex/shipments/:orderId     — get all shipments for an order
// GET  /api/postex/shipments/:id          — get single shipment with logs
// PUT  /api/postex/shipments/:id/cancel   — cancel shipment
// POST /api/postex/shipments/:id/track    — track shipment via PostEx API
router.post('/shipments/:orderId', authenticate, createShipment);
router.get('/shipments/:orderId', authenticate, getShipments);
router.get('/shipment/:id', authenticate, getShipment);
router.put('/shipment/:id/cancel', authenticate, cancelShipment);
router.post('/shipment/:id/track', authenticate, trackShipment);

// ─── Admin / Inventory View ────────────────────────────────────────────────
// GET  /api/postex/all          — all shipments (admin)
// GET  /api/postex/returns      — incoming returns (inventory view)
// GET  /api/postex/dashboard-stats — dashboard stats (admin)
// POST /api/postex/sync-statuses   — poll active shipments (admin)
// GET  /api/postex/track-live/:trackingNumber — structured tracking timeline
router.get('/dashboard-stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getDashboardStats);
router.post('/sync-statuses', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), syncStatuses);
router.get('/track-live/:trackingNumber', authenticate, trackShipmentLive);
router.get('/all', authenticate, getAllShipments);
router.get('/returns', authenticate, getIncomingReturns);

module.exports = router;
