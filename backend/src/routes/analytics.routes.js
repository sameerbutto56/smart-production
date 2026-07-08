const express = require('express');
const router = express.Router();
const { getSources, getSourceAnalytics, getSourceOrders, exportAnalyticsExcel } = require('../controllers/analytics.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const ALL_ROLES = authorize(['STORE', 'ADMIN', 'SUPER_ADMIN', 'OUTLET']);

router.get('/sources', authenticate, ALL_ROLES, getSources);
router.get('/export-excel', authenticate, ALL_ROLES, exportAnalyticsExcel);
router.get('/source/:sourceId/orders', authenticate, ALL_ROLES, getSourceOrders);
router.get('/source/:sourceId', authenticate, ALL_ROLES, getSourceAnalytics);
router.get('/unified', authenticate, ALL_ROLES, getSourceAnalytics);

module.exports = router;
