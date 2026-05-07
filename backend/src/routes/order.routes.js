const express = require('express');
const { 
  createOrder, 
  getOrders, 
  requestStageCompletion, 
  approveStageCompletion, 
  rejectStageCompletion,
  updatePaymentStatus,
  getAnalytics,
  clearHistory,
  cancelOrder
} = require('../controllers/order.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// Order Entry
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ORDER_ENTRY']), createOrder);

// Clear history
router.delete('/history', authenticate, authorize(['SUPER_ADMIN', 'FAISAL']), clearHistory);

// List all orders (available to all authenticated users)
router.get('/', authenticate, getOrders);

// Module Employee: Request stage completion
router.put('/:orderId/stages/:stageId/request', authenticate, requestStageCompletion);

// Faisal: Approve or Reject or Cancel
router.put('/:orderId/stages/:stageId/approve', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY']), approveStageCompletion);
router.put('/:orderId/stages/:stageId/reject', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY']), rejectStageCompletion);
router.put('/:orderId/cancel', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY']), cancelOrder);

// Faisal/Admin: Update payment status
router.put('/:orderId/payment', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY']), updatePaymentStatus);

// Faisal/Admin: Get production analytics
router.get('/analytics', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY']), getAnalytics);

module.exports = router;
