const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/auth.middleware');
const {
  getPendingVerifications, getVerificationHistory, verifyOrder,
  markPendingVerification, returnToFaisal, getReturnedToFaisal, resubmitFromVerification
} = require('../controllers/verification.controller');

const router = express.Router();

router.get('/pending', authenticate, getPendingVerifications);
router.get('/history', authenticate, getVerificationHistory);
router.post('/:orderId/verify', authenticate, verifyOrder);
router.post('/:orderId/pending', authenticate, markPendingVerification);
router.post('/:orderId/return-to-faisal', authenticate, returnToFaisal);
router.get('/returned', authenticate, getReturnedToFaisal);
router.put('/:orderId/resubmit', authenticate, resubmitFromVerification);

module.exports = router;
