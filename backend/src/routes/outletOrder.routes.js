const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createOutletOrder, lookupClientByNumber, saveUnregisteredClient, getOutletOrders } = require('../controllers/outletOrder.controller');

router.post('/', authenticate, createOutletOrder);
router.get('/lookup', authenticate, lookupClientByNumber);
router.post('/save-client', authenticate, saveUnregisteredClient);
router.get('/', authenticate, getOutletOrders);

module.exports = router;