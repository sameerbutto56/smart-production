const express = require('express');
const { register, login } = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// Only SUPER_ADMIN can create new user accounts
router.post('/register', authenticate, authorize('SUPER_ADMIN'), register);
router.post('/login', login);

module.exports = router;
