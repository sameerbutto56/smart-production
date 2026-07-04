const express = require('express');
const { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, clearAllInventory, bulkUploadInventory, allocateInventory, getAllocations, getAllocationStats, searchInventory, updateAllocationStatus, createCartAllocation, getCarts, updateCartStatus, exportBackup, importBackup, exportBackupExcel, importBackupExcel } = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authenticate, getInventory);
router.get('/backup/export', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'STORE']), exportBackup);
router.post('/backup/import', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'STORE']), upload.single('file'), importBackup);
router.get('/backup/export-excel', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'STORE']), exportBackupExcel);
router.post('/backup/import-excel', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'STORE']), upload.single('file'), importBackupExcel);
router.post('/bulk-upload', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL', 'STORE']), upload.single('file'), bulkUploadInventory);
router.post('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL', 'STORE']), createInventoryItem);
router.post('/allocate', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), allocateInventory);
router.get('/allocations', authenticate, getAllocations);
router.get('/allocations/stats', authenticate, getAllocationStats);
router.patch('/allocations/:id/status', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), updateAllocationStatus);
// Cart-based allocation
router.post('/allocate-cart', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), createCartAllocation);
router.get('/carts', authenticate, getCarts);
router.patch('/carts/:id/status', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), updateCartStatus);
router.get('/search', authenticate, searchInventory);
router.put('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL', 'STORE']), updateInventoryItem);
router.delete('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL', 'STORE']), deleteInventoryItem);
router.delete('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), clearAllInventory);

module.exports = router;
