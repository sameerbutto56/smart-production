const express = require('express');
const {
  getPosInventory,
  getProducts,
  updateVariantStock, updateVariantPrice,
  createVariant, deleteVariant, updateVariant,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode,
  createPosProduct,
  updateProduct,
  initializeInventory
} = require('../controllers/pos.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// POS Inventory — read-only view of all warehouse products with outlet stock
router.get('/inventory', authenticate, getPosInventory);

// Products for Outlet POS (only active in POS inventory)
router.get('/products', authenticate, getProducts);
router.post('/products', authenticate, createPosProduct);
router.patch('/products/:id', authenticate, updateProduct);

// Variants (outlet-specific stock/price)
router.put('/variants/:id/stock', authenticate, updateVariantStock);
router.put('/variants/:id/price', authenticate, updateVariantPrice);
router.put('/variants/:id', authenticate, updateVariant);
router.post('/products/:productId/variants', authenticate, createVariant);
router.delete('/variants/:id', authenticate, deleteVariant);

// Sales
router.post('/sales', authenticate, createSale);
router.get('/sales', authenticate, getSales);
router.get('/sales/dashboard', authenticate, getSalesDashboard);

// Returns
router.post('/returns', authenticate, createReturn);
router.get('/returns', authenticate, getReturns);

// Barcode lookup
router.get('/barcode/:barcode', authenticate, lookupBarcode);

// Bulk inventory initialization (admin only)
router.post('/initialize-inventory', authenticate, authorize('STORE', 'ADMIN', 'SUPER_ADMIN'), initializeInventory);

module.exports = router;
