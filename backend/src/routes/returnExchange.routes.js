const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { lookupOrder, createReturnExchange, rescheduleDelivery, approveWarehouse, approveFaisal, storeAccept, processByStore, completeReturn, dispatchReplacement, getCaseHistory, getAllCases, checkStockAvailability, sendToStore, getCase, restockOriginal, updateStatus, trackReplacement, getReplacementJobSheetOrder, routeReplacement, redispatchOrder, acceptReturn, searchReturns, sendReturnToStore, getIncomingReturns, acceptProduct, restockProduct, bulkCompleteStaleReturns, getCompletedReturns } = require('../controllers/returnExchange.controller');

const router = express.Router();

router.get('/lookup/:query', authenticate, lookupOrder);
router.get('/track/:query', authenticate, trackReplacement);
router.get('/incoming-returns', authenticate, getIncomingReturns);
router.get('/completed-returns', authenticate, getCompletedReturns);
router.get('/cases', authenticate, getAllCases);
router.get('/history/:orderId', authenticate, getCaseHistory);
router.get('/returns/search', authenticate, searchReturns);
router.post('/initiate', authenticate, createReturnExchange);
router.post('/check-stock', authenticate, checkStockAvailability);
router.post('/bulk-complete-stale', authenticate, bulkCompleteStaleReturns);
router.post('/:orderId/reschedule', authenticate, rescheduleDelivery);
router.post('/:id/approve', authenticate, approveWarehouse);
router.post('/:id/faisal-approve', authenticate, approveFaisal);
router.post('/:id/store-accept', authenticate, storeAccept);
router.post('/:id/store-process', authenticate, processByStore);
router.post('/:id/complete-return', authenticate, completeReturn);
router.post('/:id/dispatch', authenticate, dispatchReplacement);
router.get('/:id', authenticate, getCase);
router.get('/:id/job-sheet-order', authenticate, getReplacementJobSheetOrder);
router.post('/:id/send-to-store', authenticate, sendToStore);
router.post('/:id/restock-original', authenticate, restockOriginal);
router.post('/:id/accept-product', authenticate, acceptProduct);
router.post('/:id/restock-product', authenticate, restockProduct);
router.post('/:id/update-status', authenticate, updateStatus);
router.post('/:id/route', authenticate, routeReplacement);
router.post('/:orderId/redispatch', authenticate, redispatchOrder);
router.post('/:id/accept-return', authenticate, acceptReturn);
router.post('/:id/send-return-to-store', authenticate, sendReturnToStore);

module.exports = router;
