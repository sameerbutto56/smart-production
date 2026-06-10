const express = require('express');
const router = express.Router();
const { getUnifiedAnalytics } = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/unified', authenticate, getUnifiedAnalytics);

module.exports = router;
