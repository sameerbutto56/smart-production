import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Users,
  UserPlus,
  Calendar,
  Clock,
  DollarSign,
  Calculator,
  Download,
  Printer,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  X,
  FileSpreadsheet,
  Percent,
  Award,
  Eye,
  RefreshCw,
  Building2,
  Phone,
  Briefcase,
  Lock,
  ChevronDown
} from 'lucide-react';
import { formatDateTime } from '../utils/dateTime';

export default function EmployeeDataPage() {
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'attendance' | 'payroll'
  const [loading, setLoading] = useState(false);

  // --- Employees Tab State ---
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Employee Form State
  const initialEmployeeForm = {
    employeeId: '',
    name: '',
    fatherName: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    cnic: '',
    designation: '',
    department: '',
    branch: 'Johar Town',
    joiningDate: '',
    monthlySalary: '',
    workingHours: '8',
    checkInTime: '10:00',
    checkOutTime: '18:00',
    fuelAllowance: '0',
    travelAllowance: '0',
    otherAllowances: '0',
    loan: '0',
    advance: '0',
    otherDeductions: '0',
    productionPercentage: '0',
    workType: 'STANDARD', // 'STANDARD' | 'ENGRAVING' | 'CUSTOM'
    status: 'ACTIVE',
    notes: ''
  };
  const [employeeFormData, setEmployeeFormData] = useState(initialEmployeeForm);

  // --- Attendance Tab State ---
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [markingModalOpen, setMarkingModalOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [attFormCheckIn, setAttFormCheckIn] = useState('');
  const [attFormCheckOut, setAttFormCheckOut] = useState('');
  const [attFormStatus, setAttFormStatus] = useState('PRESENT');
  const [attFormNotes, setAttFormNotes] = useState('');

  // --- Monthly Attendance View State ---
  const [attMonthYear, setAttMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
  const [monthlyAttSummary, setMonthlyAttSummary] = useState([]);

  // --- Payroll Tab State ---
  const [payrollMonthYear, setPayrollMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
  const [payrolls, setPayrolls] = useState([]);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustFormData, setAdjustFormData] = useState({});

  // Fetch Employees
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees', {
        params: {
          status: filterStatus,
          branch: filterBranch,
          department: filterDepartment,
          search: searchQuery
        }
      });
      if (res.data?.success) {
        setEmployees(res.data.employees || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Daily Attendance
  const fetchDailyAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/attendance/daily', {
        params: { date: attendanceDate, branch: filterBranch }
      });
      if (res.data?.success) {
        setDailyAttendance(res.data.records || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load daily attendance');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Monthly Attendance Summary
  const fetchMonthlyAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/attendance/monthly', {
        params: { monthYear: attMonthYear, branch: filterBranch }
      });
      if (res.data?.success) {
        setMonthlyAttSummary(res.data.summary || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load monthly attendance');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Payroll List
  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/payroll/list', {
        params: { monthYear: payrollMonthYear, branch: filterBranch }
      });
      if (res.data?.success) {
        setPayrolls(res.data.payrolls || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load payroll records');
    } finally {
      setLoading(false);
    }
  };

  // Initial tab loading
  useEffect(() => {
    if (activeTab === 'employees') {
      fetchEmployees();
    } else if (activeTab === 'attendance') {
      fetchDailyAttendance();
      fetchMonthlyAttendance();
    } else if (activeTab === 'payroll') {
      fetchPayrolls();
    }
  }, [activeTab, filterStatus, filterBranch, filterDepartment, attendanceDate, attMonthYear, payrollMonthYear]);

  // Debounced search for employees
  useEffect(() => {
    if (activeTab === 'employees') {
      const timer = setTimeout(() => {
        fetchEmployees();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  // --- Handlers: Employee Management ---
  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setEmployeeFormData(initialEmployeeForm);
    setIsAddEmployeeOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    setEmployeeFormData({
      employeeId: emp.employeeId,
      name: emp.name || '',
      fatherName: emp.fatherName || '',
      dateOfBirth: emp.dateOfBirth || '',
      phone: emp.phone || '',
      email: emp.email || '',
      cnic: emp.cnic || '',
      designation: emp.designation || '',
      department: emp.department || '',
      branch: emp.branch || 'Johar Town',
      joiningDate: emp.joiningDate || '',
      monthlySalary: String(emp.monthlySalary || 0),
      workingHours: String(emp.workingHours || 8),
      checkInTime: emp.checkInTime || '10:00',
      checkOutTime: emp.checkOutTime || '18:00',
      fuelAllowance: String(emp.fuelAllowance || 0),
      travelAllowance: String(emp.travelAllowance || 0),
      otherAllowances: String(emp.otherAllowances || 0),
      loan: String(emp.loan || 0),
      advance: String(emp.advance || 0),
      otherDeductions: String(emp.otherDeductions || 0),
      productionPercentage: String(emp.productionPercentage || 0),
      workType: emp.workType || 'STANDARD',
      status: emp.status || 'ACTIVE',
      notes: emp.notes || ''
    });
    setIsAddEmployeeOpen(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.employeeId}`, employeeFormData);
        toast.success(`Employee ${editingEmployee.employeeId} updated successfully`);
      } else {
        await api.post('/employees', employeeFormData);
        toast.success('New employee created successfully');
      }
      setIsAddEmployeeOpen(false);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to mark ${emp.name} (${emp.employeeId}) as ${newStatus}?`)) return;
    try {
      await api.put(`/employees/${emp.employeeId}`, { status: newStatus });
      toast.success(`Employee status set to ${newStatus}`);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  // --- Handlers: Attendance ---
  const handleOpenMarkAttendance = (record) => {
    setSelectedAttendance(record);
    setAttFormCheckIn(record.checkInTime || record.scheduledCheckIn || '10:00');
    setAttFormCheckOut(record.checkOutTime || record.scheduledCheckOut || '18:00');
    setAttFormStatus(record.status === 'ABSENT' ? 'PRESENT' : record.status);
    setAttFormNotes(record.notes || '');
    setMarkingModalOpen(true);
  };

  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (!selectedAttendance) return;
    try {
      setLoading(true);
      await api.post('/employees/attendance/mark', {
        employeeId: selectedAttendance.employeeId,
        date: attendanceDate,
        checkInTime: attFormCheckIn,
        checkOutTime: attFormCheckOut,
        status: attFormStatus,
        notes: attFormNotes
      });
      toast.success(`Attendance updated for ${selectedAttendance.employeeName}`);
      setMarkingModalOpen(false);
      fetchDailyAttendance();
      fetchMonthlyAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMarkPresent = async () => {
    if (!window.confirm(`Mark all active employees PRESENT for ${attendanceDate} using their scheduled times?`)) return;
    try {
      setLoading(true);
      const records = dailyAttendance.map(rec => ({
        employeeId: rec.employeeId,
        checkInTime: rec.checkInTime || rec.scheduledCheckIn || '10:00',
        checkOutTime: rec.checkOutTime || rec.scheduledCheckOut || '18:00',
        status: 'PRESENT'
      }));
      await api.post('/employees/attendance/bulk-mark', {
        date: attendanceDate,
        records
      });
      toast.success(`Bulk attendance recorded for ${records.length} employees`);
      fetchDailyAttendance();
      fetchMonthlyAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to bulk mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAttendanceExcel = () => {
    const token = localStorage.getItem('token');
    const url = `/api/employees/attendance/export-excel?monthYear=${attMonthYear}`;
    window.open(url, '_blank');
    toast.success('Downloading Attendance Excel Sheet...');
  };

  // --- Handlers: Payroll ---
  const handleCalculatePayroll = async () => {
    try {
      setLoading(true);
      const res = await api.post('/employees/payroll/calculate', { monthYear: payrollMonthYear });
      if (res.data?.success) {
        toast.success(res.data.message || 'Payroll calculated successfully');
        fetchPayrolls();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to calculate payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdjustModal = (payroll) => {
    setSelectedPayroll(payroll);
    setAdjustFormData({
      basicSalary: payroll.basicSalary,
      lateDeductions: payroll.lateDeductions,
      earlyCheckoutDeductions: payroll.earlyCheckoutDeductions,
      absentDeductions: payroll.absentDeductions,
      overtimeAmount: payroll.overtimeAmount,
      fuelAllowance: payroll.fuelAllowance,
      travelAllowance: payroll.travelAllowance,
      otherAllowances: payroll.otherAllowances,
      loanDeduction: payroll.loanDeduction,
      advanceDeduction: payroll.advanceDeduction,
      otherDeductions: payroll.otherDeductions,
      eligibleProductionAmount: payroll.eligibleProductionAmount,
      productionEarning: payroll.productionEarning,
      manualAdjustment: payroll.manualAdjustment,
      adjustmentNote: payroll.adjustmentNote || ''
    });
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e) => {
    e.preventDefault();
    if (!selectedPayroll) return;
    try {
      setLoading(true);
      await api.put(`/employees/payroll/${selectedPayroll.id}/adjust`, adjustFormData);
      toast.success('Payroll adjusted successfully');
      setIsAdjustModalOpen(false);
      fetchPayrolls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to adjust payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizePayroll = async () => {
    if (!window.confirm(`Are you sure you want to FINALIZE and FREEZE payroll for ${payrollMonthYear}? Once finalized, records cannot be edited.`)) return;
    try {
      setLoading(true);
      const res = await api.post('/employees/payroll/finalize', { monthYear: payrollMonthYear });
      toast.success(res.data?.message || 'Monthly payroll finalized');
      fetchPayrolls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPayrollExcel = () => {
    const url = `/api/employees/payroll/export-excel?monthYear=${payrollMonthYear}`;
    window.open(url, '_blank');
    toast.success('Downloading Payroll Excel Sheet...');
  };

  const handleOpenPaySlip = (payroll) => {
    setSelectedPayroll(payroll);
    setIsSlipOpen(true);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  // Unique lists for filtering
  const branchesList = ['ALL', 'Johar Town', 'Jail Road', 'Railway Road', 'Marketing', 'Warehouse', 'Head Office'];
  const departmentsList = ['ALL', 'Sales / Outlet', 'Production', 'Logo / Engraving', 'Dispatch', 'Marketing', 'Management', 'Store / Warehouse'];

  // Summary stats
  const activeCount = employees.filter(e => e.status === 'ACTIVE').length;
  const totalSalaryBudget = employees.filter(e => e.status === 'ACTIVE').reduce((sum, e) => sum + (e.monthlySalary || 0), 0);

  const totalPayrollGross = payrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
  const totalPayrollDeductions = payrolls.reduce((sum, p) => sum + (p.totalDeductions || 0), 0);
  const totalPayrollNet = payrolls.reduce((sum, p) => sum + (p.netPayable || 0), 0);
  const isPayrollFinalized = payrolls.length > 0 && payrolls.every(p => p.isFinalized);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen text-slate-100 font-sans print:p-0 print:bg-white print:text-black">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl shadow-lg shadow-blue-500/10">
              <Users size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                Employee Data & Payroll System
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Complete staff profiles, attendance tracking, 3-late penalty rules, engraving earnings & monthly payroll
              </p>
            </div>
          </div>
        </div>

        {/* Action Tabs Navigation */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl shadow-inner">
          <button
            onClick={() => setActiveTab('employees')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'employees'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users size={16} />
            Staff Directory ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'attendance'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock size={16} />
            Attendance & Late Rules
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'payroll'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <DollarSign size={16} />
            Monthly Payroll ({payrolls.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EMPLOYEES DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && (
        <div className="space-y-6 print:hidden">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Employees</p>
                <h3 className="text-2xl font-black text-white mt-1">{employees.length}</h3>
                <span className="text-[11px] text-slate-500">Registered in company</span>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                <Users size={22} />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Staff</p>
                <h3 className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</h3>
                <span className="text-[11px] text-emerald-500/70">On active roster</span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Inactive Staff</p>
                <h3 className="text-2xl font-black text-amber-400 mt-1">{employees.length - activeCount}</h3>
                <span className="text-[11px] text-amber-500/70">Deactivated / Left</span>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                <AlertTriangle size={22} />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Base Salary Budget</p>
                <h3 className="text-2xl font-black text-purple-400 mt-1">₨ {totalSalaryBudget.toLocaleString()}</h3>
                <span className="text-[11px] text-purple-500/70">Active base commitment</span>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                <DollarSign size={22} />
              </div>
            </div>
          </div>

          {/* Search, Filters, and "Add Employee" Button */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by ID, Name, Phone, Designation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Branch Filter */}
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-blue-500"
              >
                {branchesList.map(b => (
                  <option key={b} value={b}>{b === 'ALL' ? 'All Branches' : b}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchEmployees}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all"
              >
                <UserPlus size={16} />
                Create New Employee
              </button>
            </div>
          </div>

          {/* Employees Table */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Name & Personal</th>
                    <th className="py-3 px-4">Branch & Dept</th>
                    <th className="py-3 px-4">Shift & Hours</th>
                    <th className="py-3 px-4">Monthly Salary</th>
                    <th className="py-3 px-4">Allowances / Deductions</th>
                    <th className="py-3 px-4">Production %</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500">
                        {loading ? 'Loading staff records...' : 'No employees found matching the filters.'}
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.employeeId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                            {emp.employeeId}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm">{emp.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            {emp.designation && <span>{emp.designation}</span>}
                            {emp.phone && <span className="text-slate-500 font-mono">• {emp.phone}</span>}
                          </div>
                          {emp.fatherName && (
                            <div className="text-[11px] text-slate-500">S/O: {emp.fatherName}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200">{emp.branch || '—'}</div>
                          <div className="text-[11px] text-slate-400">{emp.department || '—'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-xs text-slate-300 flex items-center gap-1.5">
                            <Clock size={12} className="text-blue-400" />
                            {emp.checkInTime || '10:00'} - {emp.checkOutTime || '18:00'}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {emp.workingHours || 8} hrs/day
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          ₨ {(emp.monthlySalary || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="text-slate-300">
                            Fuel: <span className="font-mono text-purple-400">₨ {emp.fuelAllowance || 0}</span>
                          </div>
                          <div className="text-slate-400 text-[11px]">
                            Loan: <span className="font-mono text-rose-400">₨ {emp.loan || 0}</span>
                            {emp.advance > 0 && <span className="ml-1">| Adv: ₨ {emp.advance}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {emp.productionPercentage > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-lg text-xs font-bold font-mono">
                              <Percent size={12} />
                              {emp.productionPercentage}%
                              <span className="text-[10px] text-amber-300/70">({emp.workType})</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">None (0%)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                              emp.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-all"
                              title="Edit Employee"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(emp)}
                              className={`p-1.5 rounded-lg transition-all ${
                                emp.status === 'ACTIVE'
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                              }`}
                              title={emp.status === 'ACTIVE' ? 'Deactivate Employee' : 'Activate Employee'}
                            >
                              <ShieldCheck size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ATTENDANCE & TIME MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="space-y-6 print:hidden">
          {/* Top Controls: Date Selector, Bulk Mark, Excel Export */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                <Calendar size={16} className="text-emerald-400" />
                <span className="text-xs font-bold text-slate-400">Date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="bg-transparent text-white text-xs sm:text-sm font-bold focus:outline-none"
                />
              </div>

              {/* Branch Filter */}
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none"
              >
                {branchesList.map(b => (
                  <option key={b} value={b}>{b === 'ALL' ? 'All Branches' : b}</option>
                ))}
              </select>

              <button
                onClick={fetchDailyAttendance}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBulkMarkPresent}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/30 transition-all"
              >
                <CheckCircle2 size={16} />
                Mark All Present Today
              </button>
              <button
                onClick={handleExportAttendanceExcel}
                className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-purple-600/30 transition-all"
              >
                <FileSpreadsheet size={16} />
                Export Monthly Excel
              </button>
            </div>
          </div>

          {/* Grace Period & Rule Banner */}
          <div className="bg-slate-900/60 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <Clock size={18} />
              </div>
              <div>
                <span className="font-bold text-white">Automated Grace Period & Late Calculation:</span>
                <span className="text-slate-300 ml-1">
                  15-min check-in grace (e.g. 10:00–10:15 is On Time; after 10:15 counts as late).
                  10-min checkout grace. 15-min overtime threshold.
                </span>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1.5 rounded-xl font-bold">
              <AlertTriangle size={14} />
              Three-Late Rule: 3 lates in a month = 1 day salary deduction
            </div>
          </div>

          {/* Daily Attendance Table */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Calendar size={16} className="text-emerald-400" />
                Daily Attendance Roster for {attendanceDate}
              </h3>
              <span className="text-xs text-slate-400">Total Staff: {dailyAttendance.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Scheduled Shift</th>
                    <th className="py-3 px-4">Check-in</th>
                    <th className="py-3 px-4">Check-out</th>
                    <th className="py-3 px-4">Late Mins (Grace 15m)</th>
                    <th className="py-3 px-4">Early Checkout</th>
                    <th className="py-3 px-4">Overtime Mins</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {dailyAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="py-12 text-center text-slate-500">
                        {loading ? 'Loading attendance...' : 'No active staff records.'}
                      </td>
                    </tr>
                  ) : (
                    dailyAttendance.map((rec) => (
                      <tr key={rec.employeeId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          {rec.employeeId}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {rec.employeeName}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {rec.branch || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                          {rec.scheduledCheckIn} - {rec.scheduledCheckOut}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {rec.checkInTime ? (
                            <span className="text-emerald-400 font-bold">{rec.checkInTime}</span>
                          ) : (
                            <span className="text-slate-600">--:--</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {rec.checkOutTime ? (
                            <span className="text-blue-400 font-bold">{rec.checkOutTime}</span>
                          ) : (
                            <span className="text-slate-600">--:--</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {rec.lateMinutes > 0 ? (
                            <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              +{rec.lateMinutes}m Late
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-xs">On Time</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {rec.earlyMinutes > 0 ? (
                            <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              -{rec.earlyMinutes}m Early
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {rec.overtimeMinutes > 0 ? (
                            <span className="font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              +{rec.overtimeMinutes}m OT
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                              rec.status === 'PRESENT'
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                : rec.status === 'LATE'
                                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                                : rec.status === 'HALF_DAY'
                                ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                                : rec.status === 'LEAVE'
                                ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenMarkAttendance(rec)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold rounded-lg text-xs transition-all"
                          >
                            Edit Punch
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Attendance & Three-Late Summary Roster */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-sm text-white flex items-center gap-2">
                  <Clock size={16} className="text-rose-400" />
                  Monthly Attendance Summary & 3-Late Penalty Ledger
                </h3>
                <span className="text-xs text-slate-400">
                  Tracking late counts across working days in month
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">Month:</span>
                <input
                  type="month"
                  value={attMonthYear}
                  onChange={(e) => setAttMonthYear(e.target.value)}
                  className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Present Days</th>
                    <th className="py-3 px-4">Absent Days</th>
                    <th className="py-3 px-4">Late Occurrences</th>
                    <th className="py-3 px-4">Three-Late Penalty</th>
                    <th className="py-3 px-4">Total Overtime Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {monthlyAttSummary.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">
                        No monthly records for {attMonthYear}.
                      </td>
                    </tr>
                  ) : (
                    monthlyAttSummary.map((sum) => (
                      <tr key={sum.employeeId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">{sum.employeeId}</td>
                        <td className="py-3 px-4 font-bold text-white">{sum.employeeName}</td>
                        <td className="py-3 px-4 text-slate-400">{sum.branch || '—'}</td>
                        <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{sum.presentDays}</td>
                        <td className="py-3 px-4 font-mono text-rose-400 font-bold">{sum.absentDays}</td>
                        <td className="py-3 px-4 font-mono">
                          {sum.lateDays > 0 ? (
                            <span className="text-amber-400 font-bold">{sum.lateDays} lates</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {sum.threeLatePenaltyDays > 0 ? (
                            <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              -{sum.threeLatePenaltyDays} Day Salary Deduction
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-xs">No deduction</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-purple-400 font-bold">
                          {sum.totalOvertimeHours} hrs
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MONTHLY PAYROLL SYSTEM */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="space-y-6 print:hidden">
          {/* Top Controls */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                <Calendar size={16} className="text-purple-400" />
                <span className="text-xs font-bold text-slate-400">Month:</span>
                <input
                  type="month"
                  value={payrollMonthYear}
                  onChange={(e) => setPayrollMonthYear(e.target.value)}
                  className="bg-transparent text-white text-xs sm:text-sm font-bold focus:outline-none"
                />
              </div>

              {/* Branch Filter */}
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none"
              >
                {branchesList.map(b => (
                  <option key={b} value={b}>{b === 'ALL' ? 'All Branches' : b}</option>
                ))}
              </select>

              <button
                onClick={fetchPayrolls}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCalculatePayroll}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/30 transition-all"
              >
                <Calculator size={16} />
                Calculate Monthly Payroll
              </button>

              <button
                onClick={handleFinalizePayroll}
                disabled={payrolls.length === 0 || isPayrollFinalized}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all ${
                  isPayrollFinalized
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                <Lock size={16} />
                {isPayrollFinalized ? 'Payroll Finalized & Frozen' : 'Finalize & Freeze Payroll'}
              </button>

              <button
                onClick={handleExportPayrollExcel}
                className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-purple-600/30 transition-all"
              >
                <FileSpreadsheet size={16} />
                Export Payroll Excel
              </button>
            </div>
          </div>

          {/* Payroll KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Gross Earnings</p>
                <h3 className="text-2xl font-black text-blue-400 mt-1">₨ {totalPayrollGross.toLocaleString()}</h3>
                <span className="text-[11px] text-slate-500">Base + OT + Allowances + Production</span>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                <DollarSign size={22} />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Deductions</p>
                <h3 className="text-2xl font-black text-rose-400 mt-1">₨ {totalPayrollDeductions.toLocaleString()}</h3>
                <span className="text-[11px] text-rose-500/70">3-Late + Absent + Loans + Advances</span>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                <AlertTriangle size={22} />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Net Payable Amount</p>
                <h3 className="text-2xl font-black text-emerald-400 mt-1">₨ {totalPayrollNet.toLocaleString()}</h3>
                <span className="text-[11px] text-emerald-500/70">Disbursement for {payrollMonthYear}</span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Payroll Status</p>
                <h3 className="text-2xl font-black text-purple-400 mt-1">
                  {isPayrollFinalized ? 'FINALIZED' : 'DRAFT / EDITABLE'}
                </h3>
                <span className="text-[11px] text-purple-500/70">
                  {isPayrollFinalized ? 'Frozen against future changes' : 'Adjustments permitted'}
                </span>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                <ShieldCheck size={22} />
              </div>
            </div>
          </div>

          {/* Payroll List Table */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Basic Salary</th>
                    <th className="py-3 px-4">Allowances</th>
                    <th className="py-3 px-4">Overtime Pay</th>
                    <th className="py-3 px-4">Production % Earning</th>
                    <th className="py-3 px-4">Total Deductions</th>
                    <th className="py-3 px-4">Net Payable</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {payrolls.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="py-12 text-center text-slate-500">
                        {loading ? 'Loading payroll records...' : 'No payroll generated yet for this month. Click "Calculate Monthly Payroll" to compute.'}
                      </td>
                    </tr>
                  ) : (
                    payrolls.map((p) => {
                      const totalAllow = (p.fuelAllowance || 0) + (p.travelAllowance || 0) + (p.otherAllowances || 0);
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">
                            {p.employeeId}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {p.employeeName}
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {p.branch || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            ₨ {(p.basicSalary || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-purple-400">
                            ₨ {totalAllow.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-amber-400">
                            ₨ {(p.overtimeAmount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            {p.productionEarning > 0 ? (
                              <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                ₨ {p.productionEarning.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono">₨ 0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-rose-400 font-bold">
                            -₨ {(p.totalDeductions || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                            ₨ {(p.netPayable || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                p.isFinalized
                                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                              }`}
                            >
                              {p.isFinalized ? 'FINAL' : 'DRAFT'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPaySlip(p)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition-all"
                                title="View Pay Slip & Full Breakdown"
                              >
                                <Eye size={14} />
                              </button>
                              {!p.isFinalized && (
                                <button
                                  onClick={() => handleOpenAdjustModal(p)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-all"
                                  title="Edit / Adjust Payroll"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT EMPLOYEE */}
      {/* ========================================================================= */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    {editingEmployee ? `Edit Employee (${editingEmployee.employeeId})` : 'Create New Employee'}
                  </h3>
                  <p className="text-xs text-slate-400">Complete staff profile, shift timings, allowances & production percentage</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEmployeeOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-6">
              {/* Section 1: Basic & Identification */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-1.5">
                  <Users size={14} /> Personal Information & Identification
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Employee ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. EMP-001 (auto if empty)"
                      value={employeeFormData.employeeId}
                      disabled={!!editingEmployee}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, employeeId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Muhammad Ali"
                      value={employeeFormData.name}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Father's Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Abdul Rehman"
                      value={employeeFormData.fatherName}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, fatherName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. 0300-1234567"
                      value={employeeFormData.phone}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">CNIC / ID Card</label>
                    <input
                      type="text"
                      placeholder="e.g. 35201-1234567-1"
                      value={employeeFormData.cnic}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, cnic: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={employeeFormData.dateOfBirth}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Department, Branch & Timings */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                  <Briefcase size={14} /> Organization & Working Shift
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Engraving Master / Sales Officer"
                      value={employeeFormData.designation}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, designation: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Production / Sales"
                      value={employeeFormData.department}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, department: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Branch / Outlet</label>
                    <select
                      value={employeeFormData.branch}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, branch: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Johar Town">Johar Town Outlet</option>
                      <option value="Jail Road">Jail Road Outlet</option>
                      <option value="Railway Road">Railway Road (Production/Engraving)</option>
                      <option value="Marketing">Marketing / Field</option>
                      <option value="Warehouse">Warehouse / Store</option>
                      <option value="Head Office">Head Office</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Scheduled Check-in Time</label>
                    <input
                      type="text"
                      placeholder="10:00"
                      value={employeeFormData.checkInTime}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, checkInTime: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">15m grace period allowed</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Scheduled Check-out Time</label>
                    <input
                      type="text"
                      placeholder="18:00"
                      value={employeeFormData.checkOutTime}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, checkOutTime: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">10m early grace, 15m OT start</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Working Hours / Day</label>
                    <input
                      type="number"
                      step="0.5"
                      value={employeeFormData.workingHours}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, workingHours: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Salary, Allowances, Loans, Production % */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-1.5">
                  <DollarSign size={14} /> Salary, Allowances, Loans & Production Incentive
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Monthly Basic Salary (₨) *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 50000"
                      value={employeeFormData.monthlySalary}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, monthlySalary: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Fuel Allowance (₨)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={employeeFormData.fuelAllowance}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, fuelAllowance: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Other Allowances (₨)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={employeeFormData.otherAllowances}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, otherAllowances: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Loan Balance (₨)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={employeeFormData.loan}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, loan: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Salary Advance (₨)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={employeeFormData.advance}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, advance: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Other Monthly Deductions (₨)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={employeeFormData.otherDeductions}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, otherDeductions: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Production % Share</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 10"
                        value={employeeFormData.productionPercentage}
                        onChange={(e) => setEmployeeFormData({ ...employeeFormData, productionPercentage: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-blue-500 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">e.g. Engraving share</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Work Type</label>
                    <select
                      value={employeeFormData.workType}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, workType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="STANDARD">Standard Staff</option>
                      <option value="ENGRAVING">Engraving / Logo Production</option>
                      <option value="CUSTOM">Custom Tailoring</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  {editingEmployee ? 'Update Employee' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT ATTENDANCE RECORD */}
      {/* ========================================================================= */}
      {markingModalOpen && selectedAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Clock size={20} className="text-emerald-400" />
                  Edit Attendance Record
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedAttendance.employeeName} ({selectedAttendance.employeeId}) • {attendanceDate}
                </p>
              </div>
              <button
                onClick={() => setMarkingModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Check-in Time</label>
                  <input
                    type="text"
                    placeholder="10:00"
                    value={attFormCheckIn}
                    onChange={(e) => setAttFormCheckIn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">Scheduled: {selectedAttendance.scheduledCheckIn}</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Check-out Time</label>
                  <input
                    type="text"
                    placeholder="18:00"
                    value={attFormCheckOut}
                    onChange={(e) => setAttFormCheckOut(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">Scheduled: {selectedAttendance.scheduledCheckOut}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Attendance Status</label>
                <select
                  value={attFormStatus}
                  onChange={(e) => setAttFormStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="HALF_DAY">HALF DAY</option>
                  <option value="LEAVE">APPROVED LEAVE</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Notes / Remarks</label>
                <textarea
                  rows="2"
                  placeholder="Optional notes or reason..."
                  value={attFormNotes}
                  onChange={(e) => setAttFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMarkingModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADJUST / EDIT PAYROLL */}
      {/* ========================================================================= */}
      {isAdjustModalOpen && selectedPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Edit2 size={20} className="text-blue-400" />
                  Adjust Payroll Record
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedPayroll.employeeName} ({selectedPayroll.employeeId}) • Month: {selectedPayroll.monthYear}
                </p>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Basic Salary (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.basicSalary}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, basicSalary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Overtime Pay (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.overtimeAmount}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, overtimeAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Production Earning (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.productionEarning}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, productionEarning: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Fuel Allowance (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.fuelAllowance}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, fuelAllowance: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Other Allowances (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.otherAllowances}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, otherAllowances: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Three-Late Deductions (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.lateDeductions}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, lateDeductions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Absent Deductions (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.absentDeductions}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, absentDeductions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Loan Deduction (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.loanDeduction}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, loanDeduction: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Advance Deduction (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.advanceDeduction}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, advanceDeduction: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Other Deductions (₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.otherDeductions}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, otherDeductions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Manual Adjust (+/- ₨)</label>
                  <input
                    type="number"
                    value={adjustFormData.manualAdjustment}
                    onChange={(e) => setAdjustFormData({ ...adjustFormData, manualAdjustment: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Adjustment Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Special festival bonus or advance override"
                  value={adjustFormData.adjustmentNote}
                  onChange={(e) => setAdjustFormData({ ...adjustFormData, adjustmentNote: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Update Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PAY SLIP & BREAKDOWN VIEW (PRINTABLE A4) */}
      {/* ========================================================================= */}
      {isSlipOpen && selectedPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl p-6 text-slate-200 print:bg-white print:text-black print:border-none print:shadow-none print:max-w-full print:p-8">
            {/* Modal Controls (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6 print:hidden">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FileText size={20} className="text-emerald-400" />
                Employee Monthly Pay Slip
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all"
                >
                  <Printer size={16} />
                  Print Pay Slip
                </button>
                <button
                  onClick={() => setIsSlipOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 print:bg-white print:border print:border-black/30 print:text-black print:p-6 font-sans">
              {/* Company Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-800 print:border-black pb-4 mb-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white print:text-black">
                    ENAMELS PRODUCTION
                  </h1>
                  <p className="text-xs text-slate-400 print:text-black font-semibold">
                    Monthly Salary & Compensation Voucher
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-blue-400 print:text-black">
                    Month: {selectedPayroll.monthYear}
                  </div>
                  <div className="text-xs text-slate-400 print:text-black">
                    Status: <span className="font-bold text-emerald-400 print:text-black">{selectedPayroll.status}</span>
                  </div>
                </div>
              </div>

              {/* Employee Bio Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 print:bg-gray-100 p-3 rounded-xl border border-slate-800/80 print:border-gray-300 text-xs mb-6">
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-bold">Employee ID</span>
                  <span className="font-mono font-bold text-white print:text-black">{selectedPayroll.employeeId}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-bold">Employee Name</span>
                  <span className="font-bold text-white print:text-black">{selectedPayroll.employeeName}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-bold">Designation</span>
                  <span className="font-medium text-slate-200 print:text-black">{selectedPayroll.designation || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-bold">Branch</span>
                  <span className="font-medium text-slate-200 print:text-black">{selectedPayroll.branch || 'Head Office'}</span>
                </div>
              </div>

              {/* Attendance Breakdown */}
              <div className="mb-6">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 print:text-black mb-2 flex items-center gap-1.5">
                  <Clock size={14} /> Attendance & Lates Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-900 print:bg-gray-50 border border-slate-800 print:border-gray-300 rounded-xl">
                    <span className="text-slate-400 print:text-gray-600 block text-[10px]">Present Days</span>
                    <span className="font-bold text-emerald-400 print:text-black text-sm">{selectedPayroll.presentDays || 0}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 print:bg-gray-50 border border-slate-800 print:border-gray-300 rounded-xl">
                    <span className="text-slate-400 print:text-gray-600 block text-[10px]">Absent Days</span>
                    <span className="font-bold text-rose-400 print:text-black text-sm">{selectedPayroll.absentDays || 0}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 print:bg-gray-50 border border-slate-800 print:border-gray-300 rounded-xl">
                    <span className="text-slate-400 print:text-gray-600 block text-[10px]">Late Days</span>
                    <span className="font-bold text-amber-400 print:text-black text-sm">{selectedPayroll.lateDays || 0}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 print:bg-gray-50 border border-slate-800 print:border-gray-300 rounded-xl">
                    <span className="text-slate-400 print:text-gray-600 block text-[10px]">3-Late Deductions</span>
                    <span className="font-bold text-rose-400 print:text-black text-sm">
                      {selectedPayroll.calculationBreakdown?.attendanceSummary?.threeLatePenaltyDays || 0} Day(s)
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 print:bg-gray-50 border border-slate-800 print:border-gray-300 rounded-xl">
                    <span className="text-slate-400 print:text-gray-600 block text-[10px]">Overtime Hours</span>
                    <span className="font-bold text-purple-400 print:text-black text-sm">{selectedPayroll.overtimeHours || 0} hrs</span>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                {/* Earnings Table */}
                <div className="border border-slate-800 print:border-gray-300 rounded-xl overflow-hidden">
                  <div className="bg-emerald-950/40 print:bg-gray-200 px-3 py-2 border-b border-slate-800 print:border-gray-300 font-bold text-xs text-emerald-400 print:text-black">
                    EARNINGS & ALLOWANCES
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
                      <tr>
                        <td className="py-2 px-3 text-slate-300 print:text-black">Basic Monthly Salary</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">₨ {selectedPayroll.basicSalary?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-300 print:text-black">Overtime Compensation</td>
                        <td className="py-2 px-3 text-right font-mono text-purple-400 print:text-black">₨ {selectedPayroll.overtimeAmount?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-300 print:text-black">Fuel Allowance</td>
                        <td className="py-2 px-3 text-right font-mono text-purple-400 print:text-black">₨ {selectedPayroll.fuelAllowance?.toLocaleString()}</td>
                      </tr>
                      {selectedPayroll.travelAllowance > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Travel Allowance</td>
                          <td className="py-2 px-3 text-right font-mono text-purple-400 print:text-black">₨ {selectedPayroll.travelAllowance?.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayroll.otherAllowances > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Other Allowances</td>
                          <td className="py-2 px-3 text-right font-mono text-purple-400 print:text-black">₨ {selectedPayroll.otherAllowances?.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayroll.productionEarning > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">
                            Production Incentive ({selectedPayroll.productionPercentage}%)
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-400 print:text-black font-bold">
                            ₨ {selectedPayroll.productionEarning?.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-900/60 print:bg-gray-100 font-bold">
                        <td className="py-2 px-3 text-white print:text-black">Gross Earnings</td>
                        <td className="py-2 px-3 text-right font-mono text-blue-400 print:text-black">₨ {selectedPayroll.grossSalary?.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Deductions Table */}
                <div className="border border-slate-800 print:border-gray-300 rounded-xl overflow-hidden">
                  <div className="bg-rose-950/40 print:bg-gray-200 px-3 py-2 border-b border-slate-800 print:border-gray-300 font-bold text-xs text-rose-400 print:text-black">
                    DEDUCTIONS & RECOVERIES
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
                      <tr>
                        <td className="py-2 px-3 text-slate-300 print:text-black">Three-Late Rule Deductions</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.lateDeductions?.toLocaleString()}</td>
                      </tr>
                      {selectedPayroll.absentDeductions > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Absent Deductions</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.absentDeductions?.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayroll.earlyCheckoutDeductions > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Early Checkout Penalty</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.earlyCheckoutDeductions?.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayroll.loanDeduction > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Loan Recovery</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.loanDeduction?.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayroll.advanceDeduction > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Advance Salary Recovery</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.advanceDeduction?.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayroll.otherDeductions > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Other Deductions</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.otherDeductions?.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-900/60 print:bg-gray-100 font-bold">
                        <td className="py-2 px-3 text-white print:text-black">Total Deductions</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.totalDeductions?.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Payable Highlight */}
              <div className="bg-emerald-950/30 print:bg-gray-100 border-2 border-emerald-500/40 print:border-black p-4 rounded-2xl flex items-center justify-between mb-8">
                <div>
                  <span className="text-xs uppercase font-black text-emerald-400 print:text-black tracking-wider block">
                    NET PAYABLE SALARY
                  </span>
                  <span className="text-[11px] text-slate-400 print:text-gray-600">
                    Gross Earnings - Total Deductions {selectedPayroll.manualAdjustment !== 0 && `(Manual Adjust: ₨ ${selectedPayroll.manualAdjustment})`}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 print:text-black">
                  ₨ {selectedPayroll.netPayable?.toLocaleString()}
                </div>
              </div>

              {/* Signatures & Bank Transfer Note */}
              <div className="pt-8 border-t border-slate-800 print:border-black grid grid-cols-2 gap-8 text-xs text-center text-slate-400 print:text-black">
                <div>
                  <div className="border-b border-slate-700 print:border-black pb-8 mb-2"></div>
                  <span className="font-bold">Employee Signature</span>
                </div>
                <div>
                  <div className="border-b border-slate-700 print:border-black pb-8 mb-2"></div>
                  <span className="font-bold">Authorized Signatory / Accounts Manager</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
