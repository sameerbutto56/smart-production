const express = require('express');
const { 
  createOrder, 
  getOrders, 
  requestStageCompletion, 
  approveStageCompletion, 
  rejectStageCompletion,
  updatePaymentStatus,
  getAnalytics
} = require('../controllers/order.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// Order Entry
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ORDER_ENTRY']), createOrder);

// List all orders (available to all authenticated users)
router.get('/', authenticate, getOrders);

// Module Employee: Request stage completion
router.put('/:orderId/stages/:stageId/request', authenticate, requestStageCompletion);

// Faisal: Approve or Reject
router.put('/:orderId/stages/:stageId/approve', authenticate, authorize(['FAISAL', 'SUPER_ADMIN']), approveStageCompletion);
router.put('/:orderId/stages/:stageId/reject', authenticate, authorize(['FAISAL', 'SUPER_ADMIN']), rejectStageCompletion);

// Faisal/Admin: Update payment status
router.put('/:orderId/payment', authenticate, authorize(['FAISAL', 'SUPER_ADMIN']), updatePaymentStatus);

// Faisal/Admin: Get production analytics
router.get('/analytics', authenticate, authorize(['FAISAL', 'SUPER_ADMIN']), getAnalytics);

module.exports = router;
