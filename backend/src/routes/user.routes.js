const express = require('express');
const { getUsers } = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/', authenticate, authorize(['STORE', 'ADMIN', 'SUPER_ADMIN']), getUsers);

module.exports = router;
