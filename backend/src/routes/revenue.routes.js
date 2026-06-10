const express = require('express');
const { getRevenueAnalytics, getExecutiveSummary, getProductionAnalytics } = require('../controllers/revenue.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/analytics', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getRevenueAnalytics);
router.get('/executive-summary', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getExecutiveSummary);
router.get('/production', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getProductionAnalytics);

module.exports = router;