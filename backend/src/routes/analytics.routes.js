const express = require('express');
const router = express.Router();
const { getSources, getSourceAnalytics, getSourceOrders } = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/sources', authenticate, getSources);
router.get('/source/:sourceId/orders', authenticate, getSourceOrders);
router.get('/source/:sourceId', authenticate, getSourceAnalytics);
router.get('/unified', authenticate, getSourceAnalytics);

module.exports = router;
