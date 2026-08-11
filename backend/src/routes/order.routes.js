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
  holdOrder,
  sendForDelivery,
  updateOrderPriority,
  forceAction,
  setDeliveryType,
  checkOrderInventory,
  addOrderToInventory,
  manualRouteOrder,
  markOrderAsSeen,
  getUnseenOrders,
  getStoreProductionOrders,
  getRoutingHistory,
  getStoreRequests,
  acceptStoreOrder,
  storeRouteOrder,
  returnToStore,
  returnToOutlet,
  getStoreDashboardOrders,
  bulkRouteOrders,
  dispatchOrder,
  updateDispatchStatus,
  acceptTask,
  getOrderTimeline,
  getOrderPerformance,
  getOutletAnalytics,
  getOrderById,
  updateProductAvailability,
  toggleProductVerification,
  trackOrder,
  createCancellationRequest,
  getCancellationRequests,
  approveCancellationRequest,
  rejectCancellationRequest
} = require('../controllers/order.controller');
const {
  updateDeliveryStatus,
  acceptDelivery,
  getDeliveryHistory,
  refundOrder,
  getRefundQueue,
  processRefund
} = require('../controllers/order-delivery.controller');
const { createEditRequest } = require('../controllers/editRequest.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// Order Entry
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'FAISAL', 'ORDER_ENTRY', 'OUTLET']), createOrder);

// Clear history
router.delete('/history', authenticate, authorize(['SUPER_ADMIN', 'FAISAL']), clearHistory);

// List all orders (available to all authenticated users)
router.get('/', authenticate, getOrders);

// Track order by orderNumber (any authenticated user)
router.get('/track/:orderNumber', authenticate, trackOrder);
router.get('/track/', authenticate, (req, res) => res.status(400).json({ message: 'Order number is required' }));

// Module Employee: Request stage completion
router.put('/:orderId/stages/:stageId/request', authenticate, requestStageCompletion);

// Control Center Actions: Approve, Reject, Cancel, Hold
router.put('/:orderId/stages/:stageId/approve', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), approveStageCompletion);
router.put('/:orderId/stages/:stageId/reject', authenticate, authorize(['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), rejectStageCompletion);
router.put('/:orderId/cancel', authenticate, authorize(['FAISAL', 'INVENTORY_VIEW', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET']), cancelOrder);
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

// Order Performance (date-filtered department counts)
router.get('/performance', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getOrderPerformance);

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
router.get('/:orderId/inventory-check', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'ADMIN', 'SUPER_ADMIN', 'FAISAL']), checkOrderInventory);

// Toggle per-product verification check mark (Store profile)
router.patch('/:orderId/toggle-product-verification', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), toggleProductVerification);

// Add products from production order to store inventory
router.post('/:orderId/add-to-inventory', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), addOrderToInventory);

// Update per-product availability (tick/cross at STORE stage)
router.patch('/:orderId/product-availability', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), updateProductAvailability);

// Outlet-wise analytics
router.get('/outlet-analytics', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getOutletAnalytics);

// Order Edit Request
router.post('/:orderId/edit-request', authenticate, authorize(['FAISAL', 'ORDER_ENTRY', 'OUTLET']), createEditRequest);

// Manual Routing (Admin/FAISAL only)
router.post('/:orderId/route', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), manualRouteOrder);

// Bulk Routing (all authenticated workers)
router.post('/bulk-route', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER', 'DISPATCH', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), bulkRouteOrders);

// Universal accept task (any authenticated user)
router.post('/:orderId/accept-task', authenticate, acceptTask);

// Unified order timeline
router.get('/:orderId/timeline', authenticate, getOrderTimeline);

// Store Profile Routes
router.post('/:orderId/accept-store', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), acceptStoreOrder);
router.post('/:orderId/store-route', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), storeRouteOrder);
router.post('/:orderId/return-to-store', authenticate, authorize(['LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER', 'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'DISPATCH', 'MAIN_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), returnToStore);
router.post('/:orderId/return-to-outlet', authenticate, authorize(['PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), returnToOutlet);
router.get('/store-dashboard', authenticate, authorize(['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'FAISAL']), getStoreDashboardOrders);

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

// ===== Order Cancellation System =====
// Submit a cancellation request (lookup by order number in body)
router.post('/cancellation-request', authenticate, createCancellationRequest);
// Submit a cancellation request for a specific order
router.post('/:orderId/cancellation-request', authenticate, cancelOrder);
// Admin: list cancellation requests (pending + history)
router.get('/cancellation-requests', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getCancellationRequests);
// Admin: approve a cancellation request (permanently cancels + restores inventory)
router.post('/cancellation-requests/:requestId/approve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), approveCancellationRequest);
// Admin: reject a cancellation request (order stays active)
router.post('/cancellation-requests/:requestId/reject', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), rejectCancellationRequest);

// Fetch single order by ID (must be after all specific GET routes)
router.get('/:orderId', authenticate, getOrderById);

module.exports = router;
