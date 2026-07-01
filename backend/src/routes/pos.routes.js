const express = require('express');
const {
  getPosInventory, addToPosInventory, removeFromPosInventory,
  getProducts,
  updateVariantStock, updateVariantPrice,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode
} = require('../controllers/pos.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// POS Inventory management (Store Profile) — manage which products are active
router.get('/inventory', authenticate, getPosInventory);
router.post('/inventory/add/:itemId', authenticate, addToPosInventory);
router.delete('/inventory/remove/:itemId', authenticate, removeFromPosInventory);

// Products for Outlet POS (only active in POS inventory)
router.get('/products', authenticate, getProducts);

// Variants (outlet-specific stock/price)
router.put('/variants/:id/stock', authenticate, updateVariantStock);
router.put('/variants/:id/price', authenticate, updateVariantPrice);

// Sales
router.post('/sales', authenticate, createSale);
router.get('/sales', authenticate, getSales);
router.get('/sales/dashboard', authenticate, getSalesDashboard);

// Returns
router.post('/returns', authenticate, createReturn);
router.get('/returns', authenticate, getReturns);

// Barcode lookup
router.get('/barcode/:barcode', authenticate, lookupBarcode);

module.exports = router;
