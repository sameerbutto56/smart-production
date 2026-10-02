const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/systemControl.middleware');
const {
  createActivity,
  getMyActivities,
  getAdminActivities,
  getConfiguredLocations,
  createConfiguredLocation,
  updateConfiguredLocation,
  deleteConfiguredLocation,
  getMarketingEmployees,
  loginMarketingEmployee,
  reverseGeocodeLocation,
} = require('../controllers/marketing.controller');

const router = express.Router();

// Reverse geocoding endpoint for auto-filling live visit details
router.get('/reverse-geocode', authenticate, reverseGeocodeLocation);

// Marketing Employee Selection & Login
router.get('/employees', authenticate, getMarketingEmployees);
router.post('/employee-login', authenticate, loginMarketingEmployee);

// Marketing Employee Endpoints
router.post('/activities', authenticate, requirePermission('MARKETING_LOCATION_ENTRY'), createActivity);
router.get('/my-activities', authenticate, requirePermission('MARKETING_ACTIVITY_HISTORY'), getMyActivities);

// Admin Supervision Endpoints
router.get('/admin/activities', authenticate, requirePermission('ADMIN_MARKETING_VIEW'), getAdminActivities);

// Configured Locations (Accessible by Software Settings and Admin)
router.get('/locations', authenticate, getConfiguredLocations);
router.post('/locations', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN']), createConfiguredLocation);
router.put('/locations/:id', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN']), updateConfiguredLocation);
router.delete('/locations/:id', authenticate, authorize(['SOFTWARE_SETTINGS', 'SUPER_ADMIN']), deleteConfiguredLocation);

module.exports = router;
