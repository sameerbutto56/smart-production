const express = require('express');
const { createOrder, getOrders, updateStage, sendForDelivery } = require('../controllers/order.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.post('/', authenticate, authorize(['ADMIN', 'MAIN_EMPLOYEE']), createOrder);
router.get('/', authenticate, getOrders);
router.put('/:orderId/stages/:stageId', authenticate, updateStage);
router.put('/:orderId/send-for-delivery', authenticate, authorize(['ADMIN', 'MAIN_EMPLOYEE']), sendForDelivery);

module.exports = router;
