const express = require('express');
const {
  getProductionRecords,
  createProductionRecord,
  updateProductionRecord,
  deleteProductionRecord,
  getProductionDashboard,
  getProductionInventory,
  addToProductionInventory,
  deleteProductionInventoryItem
} = require('../controllers/production.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/records', authenticate, getProductionRecords);
router.post('/records', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL', 'PRODUCTION']), createProductionRecord);
router.put('/records/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL', 'PRODUCTION']), updateProductionRecord);
router.delete('/records/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), deleteProductionRecord);
router.get('/dashboard', authenticate, getProductionDashboard);
router.get('/inventory', authenticate, getProductionInventory);
router.post('/inventory', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'PRODUCTION', 'STORE']), addToProductionInventory);
router.delete('/inventory/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), deleteProductionInventoryItem);

module.exports = router;
