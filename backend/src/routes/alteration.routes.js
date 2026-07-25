const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  generateAlterationNumberEndpoint,
  createAlteration,
  getAlterations,
  getAlterationById,
  getAlterationStats,
  getProductionAlterations,
  getProductionOutAlterations,
  acceptAlteration,
  completeAlteration,
  markAlterationDone,
  rejectAlteration,
  getOutletAlterationTasks,
  lookupOrderByNumber
} = require('../controllers/alteration.controller');

router.get('/generate-number', authenticate, generateAlterationNumberEndpoint);
router.get('/lookup-order', authenticate, lookupOrderByNumber);
router.get('/stats', authenticate, getAlterationStats);
router.get('/production', authenticate, getProductionAlterations);
router.get('/production-out', authenticate, getProductionOutAlterations);
router.get('/outlet-tasks', authenticate, getOutletAlterationTasks);
router.get('/', authenticate, getAlterations);
router.get('/:id', authenticate, getAlterationById);
router.post('/', authenticate, createAlteration);
router.patch('/:id/accept', authenticate, acceptAlteration);
router.patch('/:id/complete', authenticate, completeAlteration);
router.patch('/:id/done', authenticate, markAlterationDone);
router.patch('/:id/reject', authenticate, rejectAlteration);

module.exports = router;
