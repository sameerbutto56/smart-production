const express = require('express');
const { clearAllData } = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// Only ADMINS can access this route
router.post('/clear-data', authenticate, authorize('ADMIN'), clearAllData);

module.exports = router;
