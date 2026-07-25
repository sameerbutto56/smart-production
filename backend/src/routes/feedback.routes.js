const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { submitFeedback, getAllFeedback, getFeedbackStats, deleteFeedback, clearAllFeedback } = require('../controllers/feedback.controller');

const router = express.Router();

router.post('/', submitFeedback);
router.get('/', authenticate, getAllFeedback);
router.get('/stats', authenticate, getFeedbackStats);
router.delete('/:id', authenticate, deleteFeedback);
router.delete('/', authenticate, clearAllFeedback);

module.exports = router;
