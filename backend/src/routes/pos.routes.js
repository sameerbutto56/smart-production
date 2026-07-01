const express = require('express');
const {
  getCategories, createCategory, deleteCategory,
  getProducts, createProduct, updateProduct, deleteProduct,
  updateVariantStock, updateVariantPrice,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode
} = require('../controllers/pos.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Categories
router.get('/categories', authenticate, getCategories);
router.post('/categories', authenticate, createCategory);
router.delete('/categories/:id', authenticate, deleteCategory);

// Products
router.get('/products', authenticate, getProducts);
router.post('/products', authenticate, createProduct);
router.put('/products/:id', authenticate, updateProduct);
router.delete('/products/:id', authenticate, deleteProduct);

// Variants
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
