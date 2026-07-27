const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getPendingVerifications, getVerificationHistory, verifyOrder, markPendingVerification } = require('../controllers/verification.controller');

const router = express.Router();

router.get('/pending', authenticate, getPendingVerifications);
router.get('/history', authenticate, getVerificationHistory);
router.post('/:orderId/verify', authenticate, verifyOrder);
router.post('/:orderId/pending', authenticate, markPendingVerification);

module.exports = router;
