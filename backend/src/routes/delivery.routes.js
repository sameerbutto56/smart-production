const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  getDeliveryOrders,
  acceptDelivery,
  deliverOrder,
  noResponse,
  returnOrder,
  getDeliveryCharges,
  clearDeliveryCharges,
  getCODSummary,
  clearCOD,
  getPerformance,
  getDispatchTracking
} = require('../controllers/delivery.controller');

router.get('/orders', auth, getDeliveryOrders);
router.put('/:orderId/accept', auth, acceptDelivery);
router.put('/:orderId/deliver', auth, deliverOrder);
router.put('/:orderId/no-response', auth, noResponse);
router.put('/:orderId/return', auth, returnOrder);
router.get('/charges', auth, getDeliveryCharges);
router.post('/charges/clear', auth, clearDeliveryCharges);
router.get('/cod', auth, getCODSummary);
router.post('/cod/clear', auth, clearCOD);
router.get('/performance', auth, getPerformance);
router.get('/dispatch-tracking', auth, getDispatchTracking);

module.exports = router;
