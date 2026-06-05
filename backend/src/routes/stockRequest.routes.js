const express = require('express');
const { createRequest, getRequests, getRequestById, approveRequest, rejectRequest, completeRequest, getLowStockItems, exportRequestsExcel } = require('../controllers/stockRequest.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.post('/', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN']), createRequest);
router.get('/', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN', 'FAISAL']), getRequests);
router.get('/low-stock', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), getLowStockItems);
router.get('/export/excel', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), exportRequestsExcel);
router.get('/:id', authenticate, getRequestById);
router.put('/:id/approve', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), approveRequest);
router.put('/:id/reject', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), rejectRequest);
router.put('/:id/complete', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), completeRequest);

module.exports = router;
