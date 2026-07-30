const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { createOutletOrder, lookupClientByNumber, saveUnregisteredClient, getOutletOrders, getOutletReturns, receiveOutletReturn, getOutletDashboardStats, customerTaken, sendOutletForDelivery, getOutletTasks, inHouseDelivery, generateOrderNumberEndpoint, generateInvoiceNumberEndpoint, trackOrder, getOutletAnalytics, outletRouteOrder, getInDispatchOrders } = require('../controllers/outletOrder.controller');

router.post('/', authenticate, createOutletOrder);
router.get('/generate-number', authenticate, generateOrderNumberEndpoint);
router.get('/generate-invoice-number', authenticate, generateInvoiceNumberEndpoint);
router.get('/track/:query', authenticate, trackOrder);
router.get('/lookup', authenticate, lookupClientByNumber);
router.post('/save-client', authenticate, saveUnregisteredClient);
router.get('/', authenticate, getOutletOrders);
router.get('/returns', authenticate, getOutletReturns);
router.post('/:orderId/receive', authenticate, receiveOutletReturn);

// Outlet routing (accept → route to departments/other outlets)
router.post('/:orderId/outlet-route', authenticate, outletRouteOrder);

// Dashboard
router.get('/dashboard-stats', authenticate, getOutletDashboardStats);
router.get('/analytics', authenticate, getOutletAnalytics);

// Tasks
router.get('/tasks', authenticate, getOutletTasks);
router.get('/in-dispatch', authenticate, getInDispatchOrders);

// Final actions
router.post('/:orderId/customer-taken', authenticate, customerTaken);
router.post('/:orderId/send-for-delivery', authenticate, sendOutletForDelivery);
router.post('/:orderId/in-house-delivery', authenticate, inHouseDelivery);

module.exports = router;