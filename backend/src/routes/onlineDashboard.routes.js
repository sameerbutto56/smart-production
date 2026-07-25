const express = require('express');
const { getOnlineDashboardStats } = require('../controllers/onlineDashboard.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getOnlineDashboardStats);

module.exports = router;
