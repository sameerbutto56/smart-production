const express = require('express');
const { getSettings, updateSetting } = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticate, getSettings);
router.post('/', authenticate, authorize(['SUPER_ADMIN']), updateSetting);

module.exports = router;
