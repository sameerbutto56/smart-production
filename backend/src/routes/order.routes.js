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
  holdOrder,
  sendForDelivery,
  updateOrderPriority,
  forceAction,
  setDeliveryType,
  checkOrderInventory
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

// Control Center Actions: Approve, Reject, Cancel, Hold
router.put('/:orderId/stages/:stageId/approve', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), approveStageCompletion);
router.put('/:orderId/stages/:stageId/reject', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), rejectStageCompletion);
router.put('/:orderId/cancel', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), cancelOrder);
router.put('/:orderId/hold', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), holdOrder);
router.delete('/:orderId', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN']), deleteOrder);

// Control Center: Update payment status
router.put('/:orderId/payment', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), updatePaymentStatus);

// Control Center: Get production analytics
router.get('/analytics', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), getAnalytics);

// Send order for delivery (from AllOrders page)
router.put('/:orderId/send-for-delivery', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), sendForDelivery);

// Delivery Boy: Update delivery status (Delivered / Not Responded)
router.put('/:orderId/delivery', authenticate, authorize(['DELIVERY_BOY', 'FAISAL', 'SUPER_ADMIN']), updateDeliveryStatus);

// Force Actions (Admin/FAISAL only)
router.post('/:orderId/force', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL']), forceAction);

// Update order priority
router.put('/:orderId/priority', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL']), updateOrderPriority);

// Set delivery type (PICKUP, IN_CITY, COURIER)
router.put('/:orderId/delivery-type', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), setDeliveryType);

// Inventory availability check for Store department
router.get('/:orderId/inventory-check', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN', 'FAISAL']), checkOrderInventory);

module.exports = router;
