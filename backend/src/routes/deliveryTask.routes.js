const express = require('express');
const { getDeliveryTasks, markDelivered } = require('../controllers/deliveryTask.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

const router = express.Router();

router.get('/', authenticate, getDeliveryTasks);
router.put('/:type/:id/delivered', authenticate, markDelivered);

module.exports = router;
