const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getWarehouseCatalog,
  getAsmUsers,
  createStockRequest,
  listStockRequests,
  getStockRequestById,
  acceptStockRequest,
  createStockReturn,
  listStockReturns,
  acceptStockReturn
} = require('../controllers/asmStock.controller');

const ALLOWED_ROLES = ['STORE', 'ASM', 'SUPER_ADMIN', 'ADMIN'];

// Catalog & ASMs list
router.get('/warehouse-catalog', authenticate, authorize(ALLOWED_ROLES), getWarehouseCatalog);
router.get('/asms', authenticate, authorize(ALLOWED_ROLES), getAsmUsers);

// Handover requests
router.post('/requests', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), createStockRequest);
router.get('/requests', authenticate, authorize(ALLOWED_ROLES), listStockRequests);
router.get('/requests/:id', authenticate, authorize(ALLOWED_ROLES), getStockRequestById);
router.post('/requests/:id/accept', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), acceptStockRequest);

// Stock returns
router.post('/returns', authenticate, authorize(['ASM', 'SUPER_ADMIN', 'ADMIN']), createStockReturn);
router.get('/returns', authenticate, authorize(ALLOWED_ROLES), listStockReturns);
router.post('/returns/:id/accept', authenticate, authorize(['STORE', 'SUPER_ADMIN', 'ADMIN']), acceptStockReturn);

module.exports = router;
