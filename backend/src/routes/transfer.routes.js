const express = require('express');
const {
  createTransferRequest, approveTransfer, rejectTransfer,
  dispatchTransfer, acceptTransfer, cancelTransfer,
  getTransfers, getTransferById, getTransferStats, getWarehouseInventory
} = require('../controllers/transfer.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', authenticate, createTransferRequest);
router.get('/', authenticate, getTransfers);
router.get('/stats', authenticate, getTransferStats);
router.get('/warehouse-inventory', authenticate, getWarehouseInventory);
router.get('/:id', authenticate, getTransferById);
router.put('/:id/cancel', authenticate, cancelTransfer);
router.patch('/:id/approve', authenticate, approveTransfer);
router.patch('/:id/reject', authenticate, rejectTransfer);
router.patch('/:id/dispatch', authenticate, dispatchTransfer);
router.patch('/:id/accept', authenticate, acceptTransfer);

module.exports = router;
