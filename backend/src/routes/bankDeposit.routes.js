const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authEmployee, submitDeposit, getDeposits, getDepositsByOutlet } = require('../controllers/bankDeposit.controller');

router.post('/auth', authenticate, authEmployee);
router.post('/deposit', authenticate, submitDeposit);
router.get('/deposits', authenticate, getDeposits);
router.get('/deposits/:outlet', authenticate, getDepositsByOutlet);

module.exports = router;
