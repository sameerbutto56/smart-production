const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { openBook, getCurrentBook, getBookById, getBookSummary, closeBook, getBookHistory } = require('../controllers/pos.book.controller');

const router = express.Router();

router.post('/open', authenticate, openBook);
router.get('/current', authenticate, getCurrentBook);
router.get('/history', authenticate, getBookHistory);
router.get('/:id', authenticate, getBookById);
router.get('/:id/summary', authenticate, getBookSummary);
router.post('/:id/close', authenticate, closeBook);

module.exports = router;
