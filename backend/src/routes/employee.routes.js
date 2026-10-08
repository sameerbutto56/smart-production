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
router.get('/attendance/range', ...adminOnly, employeeController.getAttendanceRange);
router.post('/attendance/mark', ...adminOnly, employeeController.markAttendance);
router.post('/attendance/bulk-mark', ...adminOnly, employeeController.bulkMarkAttendance);
router.post('/attendance/import-excel', ...adminOnly, employeeController.importAttendanceExcel);
router.get('/attendance/import-history', ...adminOnly, employeeController.getAttendanceImportHistory);
router.get('/attendance/monthly', ...adminOnly, employeeController.getMonthlyAttendance);
router.get('/attendance/export-excel', ...adminOnly, employeeController.exportAttendanceExcel);

// --- Leaves Management ---
router.get('/leaves/list', ...adminOnly, employeeController.getLeaves);
router.post('/leaves', ...adminOnly, employeeController.createLeave);
router.put('/leaves/:id/status', ...adminOnly, employeeController.updateLeaveStatus);

// --- Loans & Advances Management ---
router.get('/loans/list', ...adminOnly, employeeController.getLoans);
router.post('/loans', ...adminOnly, employeeController.createLoan);
router.put('/loans/:id', ...adminOnly, employeeController.updateLoan);

// --- Production & Incentives Summary ---
router.get('/production/summary', ...adminOnly, employeeController.getProductionSummary);

// --- Payroll Management ---
router.get('/payroll/list', ...adminOnly, employeeController.getMonthlyPayrollList);
router.get('/payroll/pending', ...adminOnly, employeeController.getPendingPayrolls);
router.post('/payroll/calculate', ...adminOnly, employeeController.calculateMonthlyPayroll);
router.put('/payroll/:id/adjust', ...adminOnly, employeeController.adjustPayroll);
router.post('/payroll/approve', ...adminOnly, employeeController.approvePayrolls);
router.post('/payroll/:id/approve', ...adminOnly, employeeController.approveSinglePayroll);
router.post('/payroll/:id/mark-paid', ...adminOnly, employeeController.markPayrollPaid);
router.post('/payroll/finalize', ...adminOnly, employeeController.finalizeMonthlyPayroll);
router.get('/payroll/export-excel', ...adminOnly, employeeController.exportPayrollExcel);

// --- Audit Trail & Settings ---
router.get('/audit/attendance', ...adminOnly, employeeController.getAttendanceAuditLogs);
router.get('/audit/payroll', ...adminOnly, employeeController.getPayrollAuditLogs);
router.get('/settings/portal-status', employeeController.getPortalStatus);
router.post('/settings/portal-status', ...adminOnly, employeeController.setPortalStatus);

module.exports = router;
