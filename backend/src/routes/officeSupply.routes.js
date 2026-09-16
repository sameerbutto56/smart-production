const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getProducts,
  createProduct,
  updateProduct,
  getStock,
  addStock,
  adjustStock,
  createDemand,
  getDemands,
  getDemand,
  approveDemand,
  rejectDemand,
  createTransfer,
  getTransfers,
  getTransfer,
  acceptTransfer,
  cancelTransfer,
  getMovements,
  recordSelfUse,
  getSelfUseRecords,
} = require('../controllers/officeSupply.controller');

// Office Supply — isolated from Warehouse / POS / Product Inventory.
// Role gating is enforced per-handler in the controller.

// Products
router.get('/products', authenticate, getProducts);
router.post('/products', authenticate, createProduct);
router.patch('/products/:id', authenticate, updateProduct);

// Stock
router.get('/stock', authenticate, getStock);
router.post('/stock/add', authenticate, addStock);
router.post('/stock/adjust', authenticate, adjustStock);

// Demands
router.get('/demands', authenticate, getDemands);
router.get('/demands/:id', authenticate, getDemand);
router.post('/demands', authenticate, createDemand);
router.post('/demands/:id/approve', authenticate, approveDemand);
router.post('/demands/:id/reject', authenticate, rejectDemand);

// Transfers
router.get('/transfers', authenticate, getTransfers);
router.get('/transfers/:id', authenticate, getTransfer);
router.post('/transfers', authenticate, createTransfer);
router.post('/transfers/:id/accept', authenticate, acceptTransfer);
router.post('/transfers/:id/cancel', authenticate, cancelTransfer);

// Movements (audit ledger)
router.get('/movements', authenticate, getMovements);

// Store Self-Use (internal store consumption)
router.get('/self-use', authenticate, getSelfUseRecords);
router.post('/self-use', authenticate, recordSelfUse);

module.exports = router;
