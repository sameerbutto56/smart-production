const express = require('express');
const { getInventory, createInventoryItem, updateInventoryItem } = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticate, getInventory);
router.post('/', authenticate, authorize(['ADMIN']), createInventoryItem);
router.put('/:id', authenticate, authorize(['ADMIN']), updateInventoryItem);

module.exports = router;
