const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getDailyDeposits, submitDailyDeposit, rebuildOutletDepositState } = require('../controllers/dailyDeposit.controller');

router.post('/rebuild', authenticate, rebuildOutletDepositState);
router.get('/:outletName', authenticate, getDailyDeposits);
router.post('/:outletName', authenticate, submitDailyDeposit);

module.exports = router;
