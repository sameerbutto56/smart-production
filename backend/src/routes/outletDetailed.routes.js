const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getOutletDetailed } = require('../controllers/outletDetailed.controller');

router.get('/:outletName', auth, getOutletDetailed);

module.exports = router;
