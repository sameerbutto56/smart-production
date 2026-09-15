const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getDailyDeposits, submitDailyDeposit } = require('../controllers/dailyDeposit.controller');

router.get('/:outletName', authenticate, getDailyDeposits);
router.post('/:outletName', authenticate, submitDailyDeposit);

module.exports = router;
