const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  generateEngravingNumberEndpoint,
  createEngraving,
  getEngravings,
  getEngravingById,
  getEngravingStats,
  getLogoDeptEngravings,
  getLogoDeptCompleted,
  acceptEngraving,
  completeEngraving,
  markEngravingDone,
  rejectEngraving,
  getOutletEngravingTasks,
  lookupOrderByNumber
} = require('../controllers/engraving.controller');

router.get('/generate-number', authenticate, generateEngravingNumberEndpoint);
router.get('/lookup-order', authenticate, lookupOrderByNumber);
router.get('/stats', authenticate, getEngravingStats);
router.get('/logo-dept', authenticate, getLogoDeptEngravings);
router.get('/logo-dept-completed', authenticate, getLogoDeptCompleted);
router.get('/outlet-tasks', authenticate, getOutletEngravingTasks);
router.get('/', authenticate, getEngravings);
router.get('/:id', authenticate, getEngravingById);
router.post('/', authenticate, createEngraving);
router.patch('/:id/accept', authenticate, acceptEngraving);
router.patch('/:id/complete', authenticate, completeEngraving);
router.patch('/:id/done', authenticate, markEngravingDone);
router.patch('/:id/reject', authenticate, rejectEngraving);

module.exports = router;
