const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { createOutletOrder, lookupClientByNumber, saveUnregisteredClient, getOutletOrders, getOutletReturns, receiveOutletReturn, getOutletDashboardStats, customerTaken, sendOutletForDelivery, getOutletTasks, inHouseDelivery } = require('../controllers/outletOrder.controller');

router.post('/', authenticate, createOutletOrder);
router.get('/lookup', authenticate, lookupClientByNumber);
router.post('/save-client', authenticate, saveUnregisteredClient);
router.get('/', authenticate, getOutletOrders);
router.get('/returns', authenticate, getOutletReturns);
router.post('/:orderId/receive', authenticate, receiveOutletReturn);

// Dashboard
router.get('/dashboard-stats', authenticate, getOutletDashboardStats);

// Tasks
router.get('/tasks', authenticate, getOutletTasks);

// Final actions
router.post('/:orderId/customer-taken', authenticate, customerTaken);
router.post('/:orderId/send-for-delivery', authenticate, sendOutletForDelivery);
router.post('/:orderId/in-house-delivery', authenticate, inHouseDelivery);

module.exports = router;