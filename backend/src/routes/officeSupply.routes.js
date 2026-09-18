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
// Restricted to Johar Town & Jail Road for OUTLET users.
const officeSupplyOutletGuard = (req, res, next) => {
  if (req.user?.role === 'OUTLET') {
    const name = String(req.user.name || '').toLowerCase();
    const isJoharTown = name.includes('johar') || req.user.name?.includes('1');
    const isJailRoad = name.includes('jail') || req.user.name?.includes('2');
    if (!isJoharTown && !isJailRoad) {
      return res.status(403).json({ message: 'Office Supply is not available for this outlet.' });
    }
  }
  next();
};

router.use(authenticate, officeSupplyOutletGuard);

// Products
router.get('/products', getProducts);
router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);

// Stock
router.get('/stock', getStock);
router.post('/stock/add', addStock);
router.post('/stock/adjust', adjustStock);

// Demands
router.get('/demands', getDemands);
router.get('/demands/:id', getDemand);
router.post('/demands', createDemand);
router.post('/demands/:id/approve', approveDemand);
router.post('/demands/:id/reject', rejectDemand);

// Transfers
router.get('/transfers', getTransfers);
router.get('/transfers/:id', getTransfer);
router.post('/transfers', createTransfer);
router.post('/transfers/:id/accept', acceptTransfer);
router.post('/transfers/:id/cancel', cancelTransfer);

// Movements (audit ledger)
router.get('/movements', getMovements);

// Store Self-Use (internal store consumption)
router.get('/self-use', getSelfUseRecords);
router.post('/self-use', recordSelfUse);

module.exports = router;
