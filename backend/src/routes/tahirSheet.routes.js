const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getTahirSheet, getAvailableDates } = require('../controllers/tahirSheet.controller');

router.get('/', authenticate, getTahirSheet);
router.get('/available-dates', authenticate, getAvailableDates);

module.exports = router;
