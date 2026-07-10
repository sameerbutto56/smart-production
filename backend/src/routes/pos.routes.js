const express = require('express');
const {
  getPosInventory,
  getProducts,
  getVariant,
  updateVariantStock, updateVariantPrice,
  createVariant,   deleteVariant, deleteProductVariants, updateVariant,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode, orderLookup, getAllOutletsView,
  createPosProduct,
  updateProduct,
  initializeInventory,
  getBalanceInvoices,
  getInvoiceBalance,
  payBalance,
  getBalanceCollections,
  getBalancePaymentHistory,
  getEmployees
} = require('../controllers/pos.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// POS Inventory — read-only view of all warehouse products with outlet stock
router.get('/inventory', authenticate, getPosInventory);

// All outlets inventory view (bypasses OUTLET role restriction)
router.get('/inventory/all', authenticate, getAllOutletsView);

// Products for Outlet POS (only active in POS inventory)
router.get('/products', authenticate, getProducts);
router.post('/products', authenticate, createPosProduct);
router.patch('/products/:id', authenticate, updateProduct);

// Variants (outlet-specific stock/price)
router.get('/variants/:id', authenticate, getVariant);
router.put('/variants/:id/stock', authenticate, updateVariantStock);
router.put('/variants/:id/price', authenticate, updateVariantPrice);
router.put('/variants/:id', authenticate, updateVariant);
router.post('/products/:productId/variants', authenticate, createVariant);
router.delete('/variants/:id', authenticate, deleteVariant);
router.delete('/products/:productName/variants', authenticate, deleteProductVariants);

// Sales
router.post('/sales', authenticate, createSale);
router.get('/sales', authenticate, getSales);
router.get('/sales/dashboard', authenticate, getSalesDashboard);

// Returns
router.post('/returns', authenticate, createReturn);
router.get('/returns', authenticate, getReturns);

// Barcode lookup
router.get('/barcode/:barcode', authenticate, lookupBarcode);

// Order lookup for advance payment
router.get('/order-lookup', authenticate, orderLookup);

// Bulk inventory initialization (admin only)
router.post('/initialize-inventory', authenticate, authorize('STORE', 'ADMIN', 'SUPER_ADMIN'), initializeInventory);

// Balance Payment
router.get('/balance-invoices', authenticate, getBalanceInvoices);
router.get('/balance-invoices/:saleId', authenticate, getInvoiceBalance);
router.post('/balance-invoices/:saleId/pay', authenticate, payBalance);
router.get('/balance-collections', authenticate, getBalanceCollections);
router.get('/balance-invoices/:saleId/history', authenticate, getBalancePaymentHistory);

// Employees
router.get('/employees', authenticate, getEmployees);

module.exports = router;
