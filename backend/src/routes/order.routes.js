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
  getDeletedOrders,
  checkDeletedOrder,
  updateDeliveryStatus,
  holdOrder,
  sendForDelivery,
  updateOrderPriority,
  forceAction,
  setDeliveryType,
  checkOrderInventory,
  getOutletAnalytics,
  addOrderToInventory,
  manualRouteOrder,
  markOrderAsSeen,
  getUnseenOrders,
  getStoreProductionOrders,
  getRoutingHistory,
  getStoreRequests,
  refundOrder,
  getRefundQueue,
  processRefund,
  bulkRouteOrders,
  dispatchOrder,
  updateDispatchStatus,
  acceptDelivery,
  getDeliveryHistory
} = require('../controllers/order.controller');
const { createEditRequest } = require('../controllers/editRequest.controller');
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
router.delete('/:orderId', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), deleteOrder);

// Deleted orders (admin audit)
router.get('/deleted-orders', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getDeletedOrders);

// Check if an order was deleted (for source visibility)
router.get('/deleted-check', authenticate, checkDeletedOrder);

// Control Center: Update payment status
router.put('/:orderId/payment', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), updatePaymentStatus);

// Control Center: Get production analytics
router.get('/analytics', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), getAnalytics);

// Send order for delivery (from AllOrders page)
router.put('/:orderId/send-for-delivery', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), sendForDelivery);

// Delivery Boy: Update delivery status (Delivered / Not Responded / Refund Requested)
router.put('/:orderId/delivery', authenticate, authorize(['DELIVERY_BOY', 'FAISAL', 'SUPER_ADMIN']), updateDeliveryStatus);

// Rider accepts a delivery order
router.put('/:orderId/accept-delivery', authenticate, authorize(['DELIVERY_BOY', 'FAISAL', 'SUPER_ADMIN']), acceptDelivery);

// Delivery history for an order
router.get('/:orderId/delivery-history', authenticate, authorize(['DELIVERY_BOY', 'FAISAL', 'SUPER_ADMIN', 'ADMIN']), getDeliveryHistory);

// Refund Management
router.post('/:orderId/refund', authenticate, authorize(['DELIVERY_BOY', 'FAISAL', 'SUPER_ADMIN', 'ADMIN']), refundOrder);
router.get('/refund-queue', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'DELIVERY_BOY']), getRefundQueue);
router.post('/:orderId/process-refund', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN']), processRefund);

// Force Actions (Admin/FAISAL only)
router.post('/:orderId/force', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL']), forceAction);

// Update order priority
router.put('/:orderId/priority', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL']), updateOrderPriority);

// Set delivery type (PICKUP, IN_CITY, COURIER)
router.put('/:orderId/delivery-type', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), setDeliveryType);

// Inventory availability check for Store department
router.get('/:orderId/inventory-check', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN', 'FAISAL']), checkOrderInventory);

// Add products from production order to store inventory
router.post('/:orderId/add-to-inventory', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), addOrderToInventory);

// Outlet-wise analytics
router.get('/outlet-analytics', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getOutletAnalytics);

// Order Edit Request
router.post('/:orderId/edit-request', authenticate, authorize(['FAISAL', 'ORDER_ENTRY', 'OUTLET']), createEditRequest);

// Manual Routing (Admin/FAISAL only)
router.post('/:orderId/route', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), manualRouteOrder);

// Bulk Routing (all authenticated workers)
router.post('/bulk-route', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'PRODUCTION', 'LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER', 'DISPATCH', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), bulkRouteOrders);

// Seen/Unseen
router.post('/:orderId/mark-seen', authenticate, markOrderAsSeen);
router.get('/unseen-tasks', authenticate, getUnseenOrders);
router.get('/production-returned', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), getStoreProductionOrders);
router.get('/store-requests', authenticate, getStoreRequests);

// Routing History
router.get('/:orderId/routing-history', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL']), getRoutingHistory);

// Dispatch Management
router.post('/:orderId/dispatch', authenticate, authorize(['DISPATCH', 'MAIN_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), dispatchOrder);
router.put('/:orderId/dispatch-status', authenticate, authorize(['DISPATCH', 'MAIN_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), updateDispatchStatus);

module.exports = router;
