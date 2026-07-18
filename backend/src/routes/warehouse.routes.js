const express = require('express');
const {
  addToInventory,
  getProducts,
  lookupBarcode,
  createSale,
  createReturn,
  refundInvoice,
  getSales
} = require('../controllers/warehouse.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Add finished products from Store to warehouse inventory
router.post('/add-to-inventory', authenticate, addToInventory);

// Products
router.get('/products', authenticate, getProducts);

// Barcode lookup
router.get('/barcode/:barcode', authenticate, lookupBarcode);

// Sales
router.post('/sales', authenticate, createSale);
router.get('/sales', authenticate, getSales);

// Returns
router.post('/returns', authenticate, createReturn);

// Full invoice refund
router.post('/sales/:saleId/refund', authenticate, refundInvoice);

module.exports = router;
