const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getOutletDetailed } = require('../controllers/outletDetailed.controller');

router.get('/:outletName', authenticate, getOutletDetailed);

module.exports = router;
