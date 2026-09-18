const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getTahirSheet, getAvailableDates } = require('../controllers/tahirSheet.controller');

// Gate Pass is strictly restricted to Johar Town for OUTLET users
const gatePassOutletGuard = (req, res, next) => {
  if (req.user?.role === 'OUTLET') {
    const name = String(req.user.name || '').toLowerCase();
    const isJoharTown = name.includes('johar') || req.user.name?.includes('1');
    if (!isJoharTown) {
      return res.status(403).json({ message: 'Gate Pass is only available for Johar Town outlet.' });
    }
  }
  next();
};

router.use(authenticate, gatePassOutletGuard);

router.get('/', getTahirSheet);
router.get('/available-dates', getAvailableDates);

module.exports = router;
