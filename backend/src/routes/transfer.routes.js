const express = require('express');
const { createTransfer, getTransfers, getTransferById, cancelTransfer, dispatchTransfer, acceptTransfer } = require('../controllers/transfer.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', authenticate, createTransfer);
router.get('/', authenticate, getTransfers);
router.get('/:id', authenticate, getTransferById);
router.put('/:id/cancel', authenticate, cancelTransfer);
router.patch('/:id/dispatch', authenticate, dispatchTransfer);
router.patch('/:id/accept', authenticate, acceptTransfer);

module.exports = router;
