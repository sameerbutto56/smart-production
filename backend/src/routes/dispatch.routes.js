const express = require('express');
const { getDispatchQueue, requestCourierDispatch, bookCourier, updateCourierStatus, getPickupOrders, markPickedUp } = require('../controllers/dispatch.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/queue', authenticate, getDispatchQueue);
router.post('/:orderId/request', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ADMIN', 'OUTLET']), requestCourierDispatch);
router.post('/:orderId/book', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ADMIN']), bookCourier);
router.put('/:orderId/status', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ADMIN', 'DELIVERY_BOY']), updateCourierStatus);
router.get('/pickup', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ADMIN', 'OUTLET']), getPickupOrders);
router.put('/:orderId/pickup', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ADMIN', 'OUTLET', 'ORDER_ENTRY']), markPickedUp);

module.exports = router;
