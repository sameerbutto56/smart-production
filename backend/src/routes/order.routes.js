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
  cancelOrder,
  deleteOrder,
  updateDeliveryStatus,
  holdOrder
} = require('../controllers/order.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// Order Entry
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ORDER_ENTRY', 'OUTLET']), createOrder);

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
router.put('/:orderId/hold', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY']), holdOrder);
router.delete('/:orderId', authenticate, authorize(['FAISAL', 'SUPER_ADMIN']), deleteOrder);

// Faisal/Admin: Update payment status
router.put('/:orderId/payment', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY']), updatePaymentStatus);

// Faisal/Admin: Get production analytics
router.get('/analytics', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY']), getAnalytics);

// Delivery Boy: Update delivery status (Delivered / Not Responded)
router.put('/:orderId/delivery', authenticate, authorize(['DELIVERY_BOY', 'FAISAL', 'SUPER_ADMIN']), updateDeliveryStatus);

module.exports = router;
