const express = require('express');
const router = express.Router();
const multer = require('multer');
const biometricController = require('../controllers/biometric.controller');

// Multer memory parser for Hikvision multipart event push
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Hikvision DS-K1T342MFWX Webhook Endpoint
// Accepts both application/json and multipart/form-data with event_log / AcsEvent
router.post('/hikvision', upload.any(), biometricController.receiveHikvisionEvent);
router.get('/hikvision', biometricController.getHikvisionProbe);

// Direct Punch Endpoint (for testing & PC bridge scripts)
router.post('/punch', biometricController.recordDirectPunch);

// Gateway Status & Live Punch Logs
router.get('/status', biometricController.getBiometricStatus);

module.exports = router;
