const express = require('express');
const { getOverview } = require('../controllers/storeDashboard.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/store-dashboard — full analytics overview
router.get('/', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), getOverview);

module.exports = router;
