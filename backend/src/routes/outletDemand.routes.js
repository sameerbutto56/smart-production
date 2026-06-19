const express = require('express');
const { createDemandRequest, getMyDemandRequests, getAllDemandRequests, approveDemandRequest, getInventoryForOutlet, getDemandStats } = require('../controllers/outletDemand.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.post('/', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN']), createDemandRequest);
router.get('/my', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN']), getMyDemandRequests);
router.get('/all', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), getAllDemandRequests);
router.get('/stats', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), getDemandStats);
router.get('/inventory', authenticate, authorize(['OUTLET', 'STORE', 'ADMIN', 'SUPER_ADMIN']), getInventoryForOutlet);
router.put('/:id/approve', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), approveDemandRequest);

module.exports = router;