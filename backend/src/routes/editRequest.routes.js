const express = require('express');
const {
  getEditRequests,
  approveEditRequest,
  rejectEditRequest
} = require('../controllers/editRequest.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

// List all edit requests - FAISAL can also access to manage their own requests
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL']), getEditRequests);

// Approve an edit request (FAISAL can approve their own requests)
router.put('/:requestId/approve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL']), approveEditRequest);

// Reject an edit request (FAISAL can reject their own requests)
router.put('/:requestId/reject', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'FAISAL']), rejectEditRequest);

module.exports = router;
