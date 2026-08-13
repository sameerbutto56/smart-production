const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getDevices,
  registerDevice,
  approveDevice,
  rejectDevice,
  setDeviceStatus,
  removeDevice,
  updateDevice,
  getProfiles,
  updateProfile,
  resetProfilePassword,
} = require('../controllers/device.controller');

const DEVICE_MANAGE = ['SOFTWARE_SETTINGS'];
const DEVICE_CONTROL = ['SOFTWARE_SETTINGS', 'SUPER_ADMIN', 'ADMIN'];

// Device management — view: control roles; approve/reject/register/move: Software Settings only.
router.get('/devices', authenticate, authorize(DEVICE_CONTROL), getDevices);
router.post('/devices', authenticate, authorize(DEVICE_MANAGE), registerDevice);
router.post('/devices/:id/approve', authenticate, authorize(DEVICE_MANAGE), approveDevice);
router.post('/devices/:id/reject', authenticate, authorize(DEVICE_MANAGE), rejectDevice);
router.patch('/devices/:id', authenticate, authorize(DEVICE_MANAGE), updateDevice);
router.post('/devices/:id/status', authenticate, authorize(DEVICE_CONTROL), setDeviceStatus);
router.delete('/devices/:id', authenticate, authorize(DEVICE_CONTROL), removeDevice);

// Main profile (User) management — Software Settings only.
router.get('/profiles', authenticate, authorize(DEVICE_MANAGE), getProfiles);
router.patch('/profiles/:id', authenticate, authorize(DEVICE_MANAGE), updateProfile);
router.post('/profiles/:id/password', authenticate, authorize(DEVICE_MANAGE), resetProfilePassword);

module.exports = router;
