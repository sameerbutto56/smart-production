const express = require('express');
const { getDispatchProfileOrders, acceptDispatchOrder, dispatchFromProfile, getDispatchProfileStats } = require('../controllers/dispatch-profile.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/orders', authenticate, getDispatchProfileOrders);
router.post('/:orderId/accept', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'DISPATCH', 'MAIN_EMPLOYEE']), acceptDispatchOrder);
router.post('/:orderId/dispatch', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'DISPATCH', 'MAIN_EMPLOYEE']), dispatchFromProfile);
router.get('/stats', authenticate, getDispatchProfileStats);

module.exports = router;
