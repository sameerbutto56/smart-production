const express = require('express');
const { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticate, getInventory);
router.post('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), createInventoryItem);
router.put('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), updateInventoryItem);
router.delete('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), deleteInventoryItem);

module.exports = router;
