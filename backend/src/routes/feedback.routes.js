const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { submitFeedback, getAllFeedback, getFeedbackStats, deleteFeedback, clearAllFeedback } = require('../controllers/feedback.controller');

const router = express.Router();

router.post('/', submitFeedback);
router.get('/', authenticate, getAllFeedback);
router.get('/stats', authenticate, getFeedbackStats);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), deleteFeedback);
router.delete('/', authenticate, authorize('SUPER_ADMIN'), clearAllFeedback);

module.exports = router;
