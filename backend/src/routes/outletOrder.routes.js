const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { createOutletOrder, lookupClientByNumber, saveUnregisteredClient, getOutletOrders, getOutletReturns, receiveOutletReturn } = require('../controllers/outletOrder.controller');

router.post('/', authenticate, createOutletOrder);
router.get('/lookup', authenticate, lookupClientByNumber);
router.post('/save-client', authenticate, saveUnregisteredClient);
router.get('/', authenticate, getOutletOrders);
router.get('/returns', authenticate, getOutletReturns);
router.post('/:orderId/receive', authenticate, receiveOutletReturn);

module.exports = router;