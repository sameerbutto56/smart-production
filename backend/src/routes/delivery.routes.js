const router = require('express').Router();
const { authenticate: auth } = require('../middleware/auth.middleware');
const {
  getDeliveryOrders,
  acceptDelivery,
  deliverOrder,
  noResponse,
  returnOrder,
  deliverToOutlet,
  getDeliveryCharges,
  clearDeliveryCharges,
  getCODSummary,
  clearCOD,
  getPerformance,
  getDispatchTracking,
  getDeliveryEmployeeStats,
  payDeliveryEmployee,
  getDeliveryPaymentHistory,
  getActivityTimeline
} = require('../controllers/delivery.controller');

router.get('/orders', auth, getDeliveryOrders);
router.put('/:orderId/accept', auth, acceptDelivery);
router.put('/:orderId/deliver', auth, deliverOrder);
router.put('/:orderId/no-response', auth, noResponse);
router.put('/:orderId/return', auth, returnOrder);
router.put('/:orderId/deliver-to-outlet', auth, deliverToOutlet);
router.get('/charges', auth, getDeliveryCharges);
router.post('/charges/clear', auth, clearDeliveryCharges);
router.get('/cod', auth, getCODSummary);
router.post('/cod/clear', auth, clearCOD);
router.get('/performance', auth, getPerformance);
router.get('/dispatch-tracking', auth, getDispatchTracking);
router.get('/employee-stats', auth, getDeliveryEmployeeStats);
router.post('/pay-employee', auth, payDeliveryEmployee);
router.get('/payment-history', auth, getDeliveryPaymentHistory);
router.get('/activity', auth, getActivityTimeline);

module.exports = router;
