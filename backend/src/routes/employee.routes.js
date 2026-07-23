const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getEmployees, getEmployeeById, createEmployee, updateEmployee,
  resetPassword, deleteEmployee, verifyEmployee, getEmployeesByRole,
  getRoleCounts
} = require('../controllers/employee.controller');

// Public: verify employee for module login
router.post('/verify', verifyEmployee);

// Get employees by role (for dropdowns)
router.get('/by-role', getEmployeesByRole);

// Get employee counts per role (for admin dashboard)
router.get('/role-counts', getRoleCounts);

// Admin-only CRUD
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getEmployees);
router.get('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getEmployeeById);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), createEmployee);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), updateEmployee);
router.put('/:id/reset-password', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), resetPassword);
router.put('/:id/deactivate', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), deleteEmployee);

module.exports = router;
