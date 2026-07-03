const express = require('express');
const { createTransfer, getTransfers, getTransferById, cancelTransfer } = require('../controllers/transfer.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', authenticate, createTransfer);
router.get('/', authenticate, getTransfers);
router.get('/:id', authenticate, getTransferById);
router.put('/:id/cancel', authenticate, cancelTransfer);

module.exports = router;
