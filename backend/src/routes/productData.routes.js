const express = require('express');
const router = express.Router();
const {
  getOutlets,
  getProductsCatalog,
  getProductDataSummary,
  getProductDataOrders
} = require('../controllers/productData.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const ADMIN_ROLES = authorize(['SUPER_ADMIN', 'ADMIN', 'CEO']);

router.get('/outlets', authenticate, ADMIN_ROLES, getOutlets);
router.get('/products', authenticate, ADMIN_ROLES, getProductsCatalog);
router.get('/summary', authenticate, ADMIN_ROLES, getProductDataSummary);
router.get('/orders', authenticate, ADMIN_ROLES, getProductDataOrders);

module.exports = router;
