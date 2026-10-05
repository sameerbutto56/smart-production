const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const employeeController = require('../controllers/employee.controller');

const adminOnly = [authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'CEO', 'FAISAL'])];

// --- Employee Management ---
router.get('/', ...adminOnly, employeeController.getEmployees);
router.post('/', ...adminOnly, employeeController.createEmployee);
router.get('/:employeeId', ...adminOnly, employeeController.getEmployeeById);
router.put('/:employeeId', ...adminOnly, employeeController.updateEmployee);
router.delete('/:employeeId', ...adminOnly, employeeController.deleteEmployee);

// --- Attendance Management ---
router.get('/attendance/daily', ...adminOnly, employeeController.getDailyAttendance);
router.post('/attendance/mark', ...adminOnly, employeeController.markAttendance);
router.post('/attendance/bulk-mark', ...adminOnly, employeeController.bulkMarkAttendance);
router.get('/attendance/monthly', ...adminOnly, employeeController.getMonthlyAttendance);
router.get('/attendance/export-excel', ...adminOnly, employeeController.exportAttendanceExcel);

// --- Payroll Management ---
router.get('/payroll/list', ...adminOnly, employeeController.getMonthlyPayrollList);
router.post('/payroll/calculate', ...adminOnly, employeeController.calculateMonthlyPayroll);
router.put('/payroll/:id/adjust', ...adminOnly, employeeController.adjustPayroll);
router.post('/payroll/finalize', ...adminOnly, employeeController.finalizeMonthlyPayroll);
router.get('/payroll/export-excel', ...adminOnly, employeeController.exportPayrollExcel);

module.exports = router;
