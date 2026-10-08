const express = require('express');
const router = express.Router();
const multer = require('multer');
const biometricController = require('../controllers/biometric.controller');

// Multer memory parser for Hikvision multipart event push
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const bodyParserMiddleware = (req, res, next) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    upload.any()(req, res, next);
  } else if (ct.includes('xml') || ct.includes('text')) {
    express.text({ type: '*/*', limit: '10mb' })(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  } else {
    if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
      express.text({ type: '*/*', limit: '10mb' })(req, res, (err) => {
        if (err) return next(err);
        if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
          try {
            req.body = JSON.parse(req.body);
          } catch (_) {}
        }
        next();
      });
    } else {
      next();
    }
  }
};

// Hikvision DS-K1T342MFWX Webhook Endpoint
// Accepts multipart/form-data, application/json, application/xml, and text/plain
router.post('/hikvision', bodyParserMiddleware, biometricController.receiveHikvisionEvent);
router.get('/hikvision', biometricController.getHikvisionProbe);

// Direct Punch Endpoint (for bridge scripts & manual punches)
router.post('/punch', biometricController.recordDirectPunch);

// Historical Batch Sync (Section 9, 10, 13, 14)
router.post('/sync-batch', biometricController.syncBatchPunches);

// Range Recalculation Engine (Section 15, 16, 26)
router.post('/recalculate', biometricController.recalculateAttendanceRange);

// Raw vs Calculated Punches Verification Endpoint (Section 24)
router.get('/raw-logs', biometricController.getRawMachinePunches);

// Gateway Status, Connectivity & Counters (Section 25)
router.get('/status', biometricController.getBiometricStatus);

module.exports = router;
