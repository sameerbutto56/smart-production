const express = require('express');
const { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, bulkUploadInventory } = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authenticate, getInventory);
router.post('/bulk-upload', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL']), upload.single('file'), bulkUploadInventory);
router.post('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL']), createInventoryItem);
router.put('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL']), updateInventoryItem);
router.delete('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'FAISAL']), deleteInventoryItem);

module.exports = router;
