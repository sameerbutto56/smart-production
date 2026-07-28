const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { lookupOrder, createReturnExchange, rescheduleDelivery, approveWarehouse, dispatchReplacement, getCaseHistory, getAllCases, checkStockAvailability } = require('../controllers/returnExchange.controller');

const router = express.Router();

router.get('/lookup/:query', authenticate, lookupOrder);
router.get('/cases', authenticate, getAllCases);
router.get('/history/:orderId', authenticate, getCaseHistory);
router.post('/initiate', authenticate, createReturnExchange);
router.post('/:orderId/reschedule', authenticate, rescheduleDelivery);
router.post('/:id/approve', authenticate, approveWarehouse);
router.post('/:id/dispatch', authenticate, dispatchReplacement);
router.post('/check-stock', authenticate, checkStockAvailability);

module.exports = router;
