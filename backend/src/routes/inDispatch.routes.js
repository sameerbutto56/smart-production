const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getInDispatchOrders,
  getRoutes,
  createRoute,
  completeRoute,
  cancelRoute,
  routeOrder
} = require('../controllers/inDispatch.controller');

// Dedicated In Dispatch module — JOHAR TOWN outlet only.
// Isolated from the existing Dispatch (dispatch officer) workflow.

router.get('/orders', authenticate, getInDispatchOrders);
router.get('/routes', authenticate, getRoutes);
router.post('/routes', authenticate, createRoute);
router.post('/routes/:id/complete', authenticate, completeRoute);
router.post('/routes/:id/cancel', authenticate, cancelRoute);
router.post('/orders/:id/route', authenticate, routeOrder);

module.exports = router;
