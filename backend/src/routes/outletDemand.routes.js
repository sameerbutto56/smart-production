const express = require('express');
const { createDemandRequest, getMyDemandRequests, getAllDemandRequests, approveDemandRequest, dispatchDemandRequest, acceptDemandRequest, getInventoryForOutlet, getDemandStats, getMyDemandDeliveries, acceptDemandDeliveryById, markDemandDeliveredByBoy, getDemandDeliveriesHistory } = require('../controllers/outletDemand.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/error.middleware');
const router = express.Router();

router.post('/', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN']), asyncHandler(createDemandRequest));
router.get('/my', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN']), getMyDemandRequests);
router.get('/all', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), getAllDemandRequests);
router.get('/stats', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), getDemandStats);
router.get('/inventory', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN']), getInventoryForOutlet);

// Enamels-delivery ledger (Admin/Faisal/Store read-only history) — registered before
// the /delivery-boy and /:id/* routes so '/history' never binds to :id.
router.get('/history', authenticate, authorize(['FAISAL', 'STORE', 'ADMIN', 'SUPER_ADMIN']), asyncHandler(getDemandDeliveriesHistory));

// Enamels Delivery Boy — Demand deliveries (must be registered BEFORE /:id/* routes).
const DELIVERY_BOY_ROLES = ['DELIVERY_BOY', 'ADMIN', 'SUPER_ADMIN'];
router.get('/delivery-boy', authenticate, authorize(DELIVERY_BOY_ROLES), asyncHandler(getMyDemandDeliveries));
router.put('/delivery-boy/:id/accept', authenticate, authorize(DELIVERY_BOY_ROLES), asyncHandler(acceptDemandDeliveryById));
router.put('/delivery-boy/:id/delivered', authenticate, authorize(DELIVERY_BOY_ROLES), asyncHandler(markDemandDeliveredByBoy));

router.put('/:id/approve', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), approveDemandRequest);
router.put('/:id/dispatch', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), dispatchDemandRequest);
router.put('/:id/accept', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN']), acceptDemandRequest);

module.exports = router;