const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { locateOrder, rerouteOrder } = require('../controllers/orderControl.controller');

const router = express.Router();

// Software Settings Order Tracking — locate any order's exact queue location.
router.get('/locate/:query', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS']), locateOrder);

// Software Settings Order Control / Re-Route — transactional manual re-route.
router.post('/:orderId/reroute', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS']), rerouteOrder);

module.exports = router;
