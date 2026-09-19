const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  resolveFeedbackToken,
  submitFeedback,
  getAllFeedback,
  getFeedbackStats,
  getOutletQRs,
  regenerateOutletToken,
  deleteFeedback,
  clearAllFeedback,
} = require('../controllers/feedback.controller');

const router = express.Router();

// Public feedback portal endpoints
router.get('/resolve-token', resolveFeedbackToken);
router.post('/', submitFeedback);

// Authenticated Admin endpoints
router.get('/', authenticate, getAllFeedback);
router.get('/stats', authenticate, getFeedbackStats);
router.get('/qrs', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'CEO'), getOutletQRs);
router.post('/regenerate-token', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), regenerateOutletToken);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), deleteFeedback);
router.delete('/', authenticate, authorize('SUPER_ADMIN'), clearAllFeedback);

module.exports = router;
