const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/bi.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/dashboard', authenticate, getDashboard);

module.exports = router;
