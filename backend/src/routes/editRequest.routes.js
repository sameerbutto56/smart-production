const express = require('express');
const {
  getEditRequests,
  approveEditRequest,
  rejectEditRequest
} = require('../controllers/editRequest.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// List all edit requests (admin only)
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getEditRequests);

// Approve an edit request (admin only)
router.put('/:requestId/approve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), approveEditRequest);

// Reject an edit request (admin only)
router.put('/:requestId/reject', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), rejectEditRequest);

module.exports = router;
