const express = require('express');
const {
  authEmployee,
  createJournalEntry,
  getJournalEntries,
  getCashSummary
} = require('../controllers/journal.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Employee authentication
router.post('/auth', authenticate, authEmployee);

// Journal entries
router.post('/', authenticate, createJournalEntry);
router.get('/', authenticate, getJournalEntries);

// Cash summary
router.get('/cash-summary', authenticate, getCashSummary);

module.exports = router;
