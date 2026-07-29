const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const notificationController = require('../controllers/notification.controller');

router.get('/', authenticate, notificationController.getNotifications);
router.get('/unread-counts', authenticate, notificationController.getUnreadCounts);
router.put('/mark-read', authenticate, notificationController.markModuleRead);
router.put('/:id/read', authenticate, notificationController.markOneRead);

module.exports = router;
