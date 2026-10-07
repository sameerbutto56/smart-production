import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Users,
  LayoutDashboard,
  Clock,
  Calendar,
  DollarSign,
  Briefcase,
  LogOut,
  Key,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Award,
  CreditCard,
  FileText,
  Printer,
  X,
  PlusCircle,
  Percent,
  Search,
  Filter
} from 'lucide-react';

export default function EmployeePortalLayout() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'profile' | 'attendance' | 'leaves' | 'loans' | 'production' | 'payroll'
  const [loading, setLoading] = useState(false);

  // Authenticated Employee State
  const [employee, setEmployee] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  // Modals
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Attendance Tab State
  const [attMonthYear, setAttMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
  const [attendanceData, setAttendanceData] = useState(null);

  // Leaves Tab State
  const [leavesData, setLeavesData] = useState(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveFormType, setLeaveFormType] = useState('CASUAL');
  const [leaveFormStartDate, setLeaveFormStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveFormEndDate, setLeaveFormEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveFormDays, setLeaveFormDays] = useState('1');
  const [leaveFormReason, setLeaveFormReason] = useState('');

  // Loans Tab State
  const [loansData, setLoansData] = useState(null);

  // Production Tab State
  const [prodMonthYear, setProdMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
  const [productionData, setProductionData] = useState(null);

  // Payroll Tab State
  const [payrollsList, setPayrollsList] = useState([]);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [isSlipOpen, setIsSlipOpen] = useState(false);

  // Work Records Tab State
  const [workRecordsData, setWorkRecordsData] = useState(null);

  // Helper for authenticated requests
  const getAuthHeaders = () => {
    const token = localStorage.getItem('employee_portal_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('employee_portal_token');
    localStorage.removeItem('employee_portal_user');
    toast.success('Signed out of Employee Portal');
    navigate('/employee-portal/login');
  };

  // Fetch Current Employee Profile & Dashboard
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/employee-portal/dashboard', getAuthHeaders());
      if (res.data?.success) {
        setDashboardData(res.data);
        setEmployee(res.data.employee);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Attendance
  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/employee-portal/attendance', {
        ...getAuthHeaders(),
        params: { monthYear: attMonthYear }
      });
      if (res.data?.success) {
        setAttendanceData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [attMonthYear]);

  // Fetch Leaves
  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/employee-portal/leaves', getAuthHeaders());
      if (res.data?.success) {
        setLeavesData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Loans
  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/employee-portal/loans', getAuthHeaders());
      if (res.data?.success) {
        setLoansData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Production
  const fetchProduction = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/employee-portal/production', {
        ...getAuthHeaders(),
        params: { monthYear: prodMonthYear }
      });
      if (res.data?.success) {
        setProductionData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load production');
    } finally {
      setLoading(false);
    }
  }, [prodMonthYear]);

  // Fetch Payrolls
  const fetchPayrolls = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/employee-portal/payroll', getAuthHeaders());
      if (res.data?.success) {
        setPayrollsList(res.data.payrolls || []);
      }
    } catch (err) {
      toast.error('Failed to load payroll records');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Work & Sales Records
  const fetchWorkRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/employee-portal/work-records', getAuthHeaders());
      if (res.data?.success) {
        setWorkRecordsData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load work/sales records');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial check & data fetch
  useEffect(() => {
    const token = localStorage.getItem('employee_portal_token');
    if (!token) {
      navigate('/employee-portal/login');
      return;
    }
    fetchDashboard();
  }, [fetchDashboard, navigate]);

  // Tab switch fetch
  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
    else if (activeTab === 'leaves') fetchLeaves();
    else if (activeTab === 'loans') fetchLoans();
    else if (activeTab === 'production') fetchProduction();
    else if (activeTab === 'payroll') fetchPayrolls();
    else if (activeTab === 'work-records') fetchWorkRecords();
  }, [activeTab, fetchAttendance, fetchLeaves, fetchLoans, fetchProduction, fetchPayrolls, fetchWorkRecords]);

  // Submit Leave Request
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post(
        '/api/employee-portal/leaves',
        {
          leaveType: leaveFormType,
          startDate: leaveFormStartDate,
          endDate: leaveFormEndDate,
          daysCount: leaveFormDays,
          reason: leaveFormReason
        },
        getAuthHeaders()
      );
      toast.success('Leave request submitted successfully');
      setIsLeaveModalOpen(false);
      setLeaveFormReason('');
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }
    try {
      setLoading(true);
      await axios.post(
        '/api/employee-portal/change-password',
        { currentPassword, newPassword },
        getAuthHeaders()
      );
      toast.success('Password updated successfully');
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col print:bg-white print:text-black">
      {/* Top Portal Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-6 py-3.5 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
              <Users size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">ENAMELS PORTAL</h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Self-Service
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {employee ? (
                  <>
                    <strong className="text-slate-200">{employee.name}</strong> • ID:{' '}
                    <span className="font-mono text-blue-400 font-bold">{employee.employeeId}</span> •{' '}
                    <span>{employee.designation || 'Staff'}</span> ({employee.branch || 'Head Office'})
                  </>
                ) : (
                  'Staff Management Portal'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              <Key size={14} />
              Password
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard size={15} />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock size={15} />
            My Attendance
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'leaves'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Calendar size={15} />
            My Leaves
          </button>
          <button
            onClick={() => setActiveTab('loans')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'loans'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CreditCard size={15} />
            My Loans & Advances
          </button>
          <button
            onClick={() => setActiveTab('production')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'production'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Award size={15} />
            My Production / Incentive
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'payroll'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <DollarSign size={15} />
            My Salary & Pay Slips
          </button>
          <button
            onClick={() => setActiveTab('work-records')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'work-records'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText size={15} />
            Work / Sales Records
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Briefcase size={15} />
            My Profile
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* ========================================================================= */}
        {/* VIEW 1: DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && dashboardData && (
          <div className="space-y-6">
            {/* Greeting & Quick Bio */}
            <div className="bg-gradient-to-r from-blue-900/40 via-slate-900 to-slate-900 border border-blue-500/20 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-black tracking-wider text-blue-400">
                  Welcome to Your Portal
                </span>
                <h2 className="text-2xl font-black text-white mt-1">
                  {dashboardData.employee?.name}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Employee ID: <strong className="font-mono text-white">{dashboardData.employee?.employeeId}</strong> •{' '}
                  {dashboardData.employee?.designation} • {dashboardData.employee?.department} ({dashboardData.employee?.branch})
                </p>
              </div>

              <div className="text-left sm:text-right bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">Current Basic Salary</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  ₨ {(dashboardData.employee?.monthlySalary || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Monthly KPI Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Worked Days</span>
                <h3 className="text-xl font-black text-emerald-400 mt-1">{dashboardData.stats?.workedDays || 0}</h3>
                <span className="text-[10px] text-slate-500">Present this month</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Late Occurrences</span>
                <h3 className="text-xl font-black text-amber-400 mt-1">{dashboardData.stats?.lateCount || 0}</h3>
                <span className="text-[10px] text-slate-500">({dashboardData.stats?.totalLateMinutes || 0} mins)</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Overtime</span>
                <h3 className="text-xl font-black text-purple-400 mt-1">{dashboardData.stats?.overtimeHours || 0} hrs</h3>
                <span className="text-[10px] text-slate-500">Beyond shift</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Leaves Taken</span>
                <h3 className="text-xl font-black text-blue-400 mt-1">{dashboardData.stats?.leaveDays || 0}</h3>
                <span className="text-[10px] text-slate-500">Approved leaves</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Loan Balance</span>
                <h3 className="text-xl font-black text-rose-400 mt-1">₨ {(dashboardData.stats?.totalLoanBalance || 0).toLocaleString()}</h3>
                <span className="text-[10px] text-slate-500">Active loan</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Incentive</span>
                <h3 className="text-xl font-black text-emerald-400 mt-1">₨ {(dashboardData.stats?.currentIncentive || 0).toLocaleString()}</h3>
                <span className="text-[10px] text-slate-500">Production share</span>
              </div>
            </div>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                onClick={() => { setActiveTab('leaves'); setIsLeaveModalOpen(true); }}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 p-5 rounded-2xl cursor-pointer transition-all hover:border-blue-500/40"
              >
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl w-fit mb-3">
                  <Calendar size={20} />
                </div>
                <h4 className="font-bold text-white text-sm">Request Leave</h4>
                <p className="text-xs text-slate-400 mt-1">Submit casual, sick, or annual leave application to management.</p>
              </div>

              <div
                onClick={() => setActiveTab('attendance')}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 p-5 rounded-2xl cursor-pointer transition-all hover:border-emerald-500/40"
              >
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-3">
                  <Clock size={20} />
                </div>
                <h4 className="font-bold text-white text-sm">Attendance History</h4>
                <p className="text-xs text-slate-400 mt-1">Check daily check-in, check-out, grace period, and late counts.</p>
              </div>

              <div
                onClick={() => setActiveTab('payroll')}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 p-5 rounded-2xl cursor-pointer transition-all hover:border-purple-500/40"
              >
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-3">
                  <DollarSign size={20} />
                </div>
                <h4 className="font-bold text-white text-sm">View Pay Slips</h4>
                <p className="text-xs text-slate-400 mt-1">Access monthly salary slips, deductions, and payment vouchers.</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: MY PROFILE */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && employee && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <Briefcase size={20} className="text-blue-400" />
                Employee Profile Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Employee ID</label>
                  <p className="font-mono font-bold text-blue-400 text-sm mt-0.5">{employee.employeeId}</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Full Name</label>
                  <p className="font-bold text-white text-sm mt-0.5">{employee.name}</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Father's Name</label>
                  <p className="font-medium text-slate-200 text-sm mt-0.5">{employee.fatherName || '—'}</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Contact Phone</label>
                  <p className="font-mono text-slate-200 text-sm mt-0.5">{employee.phone || '—'}</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Personal Email</label>
                  <p className="text-slate-200 text-sm mt-0.5">{employee.email || '—'}</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">CNIC</label>
                  <p className="font-mono text-slate-200 text-sm mt-0.5">{employee.cnic || '—'}</p>
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Residential Address</label>
                  <p className="text-slate-200 text-sm mt-0.5">{employee.address || '—'}</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Designation</label>
                  <p className="font-bold text-white text-sm mt-0.5">{employee.designation || 'Staff'}</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Department</label>
                  <p className="font-medium text-slate-200 text-sm mt-0.5">{employee.department || '—'}</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Assigned Branch</label>
                  <p className="font-medium text-slate-200 text-sm mt-0.5">{employee.branch || '—'}</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Scheduled Shift</label>
                  <p className="font-mono text-emerald-400 font-bold text-sm mt-0.5">
                    {employee.checkInTime || '10:00'} - {employee.checkOutTime || '18:00'} ({employee.workingHours || 8} hrs)
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Monthly Salary</label>
                  <p className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                    ₨ {(employee.monthlySalary || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Portal Login Email</label>
                  <p className="font-mono text-blue-400 text-sm mt-0.5">{employee.loginEmail || '—'}</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
                <span className="font-bold text-slate-300">Privacy & Security Notice:</span> All employment contracts, shift rules, and salary figures are configured securely by administration and are read-only in this portal.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: MY ATTENDANCE */}
        {/* ========================================================================= */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* Month Filter */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-emerald-400" />
                <h3 className="font-black text-sm text-white">Monthly Attendance Ledger</h3>
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

            {/* Attendance Summary */}
            {attendanceData?.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Present Days</span>
                  <h4 className="text-xl font-black text-emerald-400 mt-1">{attendanceData.summary.presentDays}</h4>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Late Days</span>
                  <h4 className="text-xl font-black text-amber-400 mt-1">{attendanceData.summary.lateDays}</h4>
                  <span className="text-[10px] text-slate-500">Total: {attendanceData.summary.totalLateMinutes} mins</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">3-Late Penalty</span>
                  <h4 className="text-xl font-black text-rose-400 mt-1">
                    {attendanceData.summary.threeLatePenaltyDays > 0 ? `-${attendanceData.summary.threeLatePenaltyDays} Day` : '0'}
                  </h4>
                  <span className="text-[10px] text-slate-500">3 lates = 1 day salary deduction</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Overtime</span>
                  <h4 className="text-xl font-black text-purple-400 mt-1">{attendanceData.summary.totalOvertimeHours} hrs</h4>
                </div>
              </div>
            )}

            {/* Attendance Daily Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Scheduled In / Out</th>
                      <th className="py-3 px-4">Actual Check-in</th>
                      <th className="py-3 px-4">Actual Check-out</th>
                      <th className="py-3 px-4">Late Mins (Grace 15m)</th>
                      <th className="py-3 px-4">Overtime Mins</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {!attendanceData?.records || attendanceData.records.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          {loading ? 'Loading attendance...' : 'No attendance records logged for this month.'}
                        </td>
                      </tr>
                    ) : (
                      attendanceData.records.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-850/40">
                          <td className="py-3 px-4 font-mono font-bold text-white">{r.date}</td>
                          <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                            {r.scheduledCheckIn} - {r.scheduledCheckOut}
                          </td>
                          <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{r.checkInTime || '--:--'}</td>
                          <td className="py-3 px-4 font-mono text-blue-400 font-bold">{r.checkOutTime || '--:--'}</td>
                          <td className="py-3 px-4 font-mono">
                            {r.lateMinutes > 0 ? (
                              <span className="text-rose-400 font-bold">+{r.lateMinutes}m Late</span>
                            ) : (
                              <span className="text-emerald-400 text-xs">On Time</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {r.overtimeMinutes > 0 ? (
                              <span className="text-purple-400 font-bold">+{r.overtimeMinutes}m OT</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                r.status === 'PRESENT'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : r.status === 'LATE'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {r.status}
                            </span>
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
        {/* VIEW 4: MY LEAVES */}
        {/* ========================================================================= */}
        {activeTab === 'leaves' && (
          <div className="space-y-6">
            {/* Leaves KPI Banner */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Calendar size={20} className="text-amber-400" />
                  Leave Entitlement & Balances
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Allowed per month: <strong>{leavesData?.allowedLeavesPerMonth || 2} days</strong> • Annual total:{' '}
                  <strong>{leavesData?.totalAllowedYearly || 24} days</strong>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center px-4 py-2 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Used Days</span>
                  <span className="text-lg font-black text-rose-400 font-mono">{leavesData?.totalTaken || 0}</span>
                </div>
                <div className="text-center px-4 py-2 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Remaining</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">{leavesData?.remainingLeaves || 0}</span>
                </div>
                <button
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
                >
                  <PlusCircle size={16} />
                  Apply Leave
                </button>
              </div>
            </div>

            {/* Leave Requests Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">My Leave Applications</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Leave Type</th>
                      <th className="py-3 px-4">Start Date</th>
                      <th className="py-3 px-4">End Date</th>
                      <th className="py-3 px-4">Days</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {!leavesData?.leaves || leavesData.leaves.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500">
                          {loading ? 'Loading leaves...' : 'No leave applications submitted yet.'}
                        </td>
                      </tr>
                    ) : (
                      leavesData.leaves.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-850/40">
                          <td className="py-3 px-4 font-bold text-white">{l.leaveType}</td>
                          <td className="py-3 px-4 font-mono">{l.startDate}</td>
                          <td className="py-3 px-4 font-mono">{l.endDate}</td>
                          <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{l.daysCount}</td>
                          <td className="py-3 px-4 text-slate-400">{l.reason || '—'}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                l.status === 'APPROVED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : l.status === 'REJECTED'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {l.status}
                            </span>
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
        {/* VIEW 5: MY LOANS & ADVANCES */}
        {/* ========================================================================= */}
        {activeTab === 'loans' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                <span className="text-xs uppercase font-black tracking-wider text-rose-400">Total Outstanding Loan</span>
                <h3 className="text-2xl font-black text-white mt-1 font-mono">
                  ₨ {(loansData?.totalLoanBalance || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Deducted monthly from salary until balance reaches ₨ 0</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                <span className="text-xs uppercase font-black tracking-wider text-amber-400">Total Salary Advance</span>
                <h3 className="text-2xl font-black text-white mt-1 font-mono">
                  ₨ {(loansData?.totalAdvanceBalance || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Recovered in full on next payroll cycle</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Loan & Advance Ledger</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Date Issued</th>
                      <th className="py-3 px-4">Initial Amount</th>
                      <th className="py-3 px-4">Monthly Deduction</th>
                      <th className="py-3 px-4">Remaining Balance</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {!loansData?.records || loansData.records.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500">
                          {loading ? 'Loading...' : 'No loan or advance records found.'}
                        </td>
                      </tr>
                    ) : (
                      loansData.records.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-850/40">
                          <td className="py-3 px-4 font-bold text-white">{r.type}</td>
                          <td className="py-3 px-4 font-mono">{r.date}</td>
                          <td className="py-3 px-4 font-mono">₨ {r.amount?.toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono text-purple-400">₨ {r.monthlyDeduction?.toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono font-bold text-rose-400">₨ {r.remainingBalance?.toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                r.status === 'ACTIVE'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {r.status}
                            </span>
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
        {/* VIEW 6: MY PRODUCTION / INCENTIVES */}
        {/* ========================================================================= */}
        {activeTab === 'production' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Award size={20} className="text-indigo-400" />
                  Production & Engraving Incentive
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Branch: <strong>{productionData?.branch || employee?.branch || '—'}</strong> • Share:{' '}
                  <strong className="text-emerald-400 font-mono">{productionData?.percentage || employee?.productionPercentage || 0}%</strong>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="month"
                  value={prodMonthYear}
                  onChange={(e) => setProdMonthYear(e.target.value)}
                  className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-white focus:outline-none"
                />
                <div className="text-right bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Incentive Earning</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    ₨ {(productionData?.incentiveAmount || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Contributing Orders Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Eligible Production Orders ({productionData?.orders?.length || 0})
                </h4>
                <span className="text-xs font-mono text-slate-400">
                  Total Eligible Work: ₨ {(productionData?.totalEligibleAmount || 0).toLocaleString()}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Logo Charges</th>
                      <th className="py-3 px-4">Name Printing Charges</th>
                      <th className="py-3 px-4">Eligible Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {!productionData?.orders || productionData.orders.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500">
                          {loading ? 'Loading production...' : 'No production records found for this month.'}
                        </td>
                      </tr>
                    ) : (
                      productionData.orders.map((o) => (
                        <tr key={o.orderNumber} className="hover:bg-slate-850/40">
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">{o.orderNumber}</td>
                          <td className="py-3 px-4 text-white">{o.customerName || '—'}</td>
                          <td className="py-3 px-4 font-mono">₨ {(o.logoCharges || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono">₨ {(o.namePrintingCharges || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            ₨ {(o.eligibleAmount || 0).toLocaleString()}
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
        {/* VIEW 7: MY PAYROLL & PAY SLIPS */}
        {/* ========================================================================= */}
        {activeTab === 'payroll' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Monthly Salary Statements & Pay Slips
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Month</th>
                      <th className="py-3 px-4">Basic Salary</th>
                      <th className="py-3 px-4">Gross Earnings</th>
                      <th className="py-3 px-4">Total Deductions</th>
                      <th className="py-3 px-4">Net Payable</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Pay Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {payrollsList.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          {loading ? 'Loading payroll...' : 'No payroll statements generated yet.'}
                        </td>
                      </tr>
                    ) : (
                      payrollsList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-850/40">
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">{p.monthYear}</td>
                          <td className="py-3 px-4 font-mono">₨ {p.basicSalary?.toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono text-purple-400 font-bold">₨ {p.grossSalary?.toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono text-rose-400 font-bold">-₨ {p.totalDeductions?.toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">₨ {p.netPayable?.toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                p.isFinalized
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => { setSelectedPayroll(p); setIsSlipOpen(true); }}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 ml-auto"
                            >
                              <Eye size={14} />
                              View Slip
                            </button>
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
        {/* VIEW 8: WORK & SALES RECORDS */}
        {/* ========================================================================= */}
        {activeTab === 'work-records' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <FileText className="text-cyan-400" size={20} />
                  Work & Sales Records
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Operational records and sales transactions registered for Employee ID{' '}
                  <span className="font-mono text-cyan-400 font-bold">{employee?.employeeId}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchWorkRecords}
                  disabled={loading}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Filter size={13} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">Total Work Entries</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {workRecordsData?.totalCount || 0}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Logged operational activities</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">POS Sales Count</span>
                <span className="text-2xl font-black font-mono text-cyan-400 mt-1 block">
                  {workRecordsData?.totalSalesCount || 0}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Completed checkout bills</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">Total Sales Value</span>
                <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">
                  ₨ {(workRecordsData?.totalSalesVolume || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Gross sales billed</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <span className="text-[11px] uppercase font-bold text-slate-400 block">Assigned Location</span>
                <span className="text-lg font-black text-white mt-1 block truncate">
                  {employee?.branch || 'Head Office'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">{employee?.designation || 'Staff'}</span>
              </div>
            </div>

            {/* Records Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Activity & Transaction Ledger
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {workRecordsData?.records?.length || 0} record(s)
                </span>
              </div>

              {workRecordsData?.records && workRecordsData.records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Reference / Receipt #</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Branch</th>
                        <th className="py-3 px-4 text-right">Amount (₨)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {workRecordsData.records.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                            {r.date ? new Date(r.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-cyan-400 whitespace-nowrap">
                            {r.reference || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                              {r.recordType?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            <div className="font-medium">{r.title}</div>
                            {r.description && <div className="text-[11px] text-slate-400 mt-0.5">{r.description}</div>}
                          </td>
                          <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                            {r.branch}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-right text-emerald-400 whitespace-nowrap">
                            {r.amount != null ? `₨ ${Number(r.amount).toLocaleString()}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <FileText size={36} className="mx-auto text-slate-600" />
                  <p className="text-sm font-bold text-slate-400">No work or sales records registered yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Transactions and activities tagged with your Employee ID ({employee?.employeeId}) will be cataloged here automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT LEAVE REQUEST */}
      {/* ========================================================================= */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Calendar size={18} className="text-amber-400" />
                Apply for Leave
              </h3>
              <button onClick={() => setIsLeaveModalOpen(false)} className="p-1.5 bg-slate-800 text-slate-400 rounded-xl">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Leave Type</label>
                <select
                  value={leaveFormType}
                  onChange={(e) => setLeaveFormType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Medical / Sick Leave</option>
                  <option value="ANNUAL">Annual Leave</option>
                  <option value="UNPAID">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveFormStartDate}
                    onChange={(e) => setLeaveFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveFormEndDate}
                    onChange={(e) => setLeaveFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Number of Days</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={leaveFormDays}
                  onChange={(e) => setLeaveFormDays(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Reason / Justification</label>
                <textarea
                  rows="3"
                  placeholder="Explain reason for leave..."
                  value={leaveFormReason}
                  onChange={(e) => setLeaveFormReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGE PASSWORD */}
      {/* ========================================================================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Key size={18} className="text-blue-400" />
                Change Portal Password
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="p-1.5 bg-slate-800 text-slate-400 rounded-xl">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW PRINTABLE PAY SLIP */}
      {/* ========================================================================= */}
      {isSlipOpen && selectedPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl p-6 text-slate-200 print:bg-white print:text-black print:border-none print:shadow-none print:max-w-full print:p-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6 print:hidden">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FileText size={20} className="text-emerald-400" />
                Employee Monthly Pay Slip
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30"
                >
                  <Printer size={16} />
                  Print Slip
                </button>
                <button onClick={() => setIsSlipOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 print:bg-white print:border print:border-black/30 print:text-black print:p-6 font-sans">
              <div className="flex items-center justify-between border-b-2 border-slate-800 print:border-black pb-4 mb-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white print:text-black">ENAMELS PRODUCTION</h1>
                  <p className="text-xs text-slate-400 print:text-black font-semibold">Monthly Salary & Compensation Voucher</p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-blue-400 print:text-black">Month: {selectedPayroll.monthYear}</div>
                  <div className="text-xs text-slate-400 print:text-black">Status: <strong className="text-emerald-400 print:text-black">{selectedPayroll.status}</strong></div>
                </div>
              </div>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
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
                      {selectedPayroll.productionEarning > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Production Incentive</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-400 print:text-black font-bold">₨ {selectedPayroll.productionEarning?.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-900/60 print:bg-gray-100 font-bold">
                        <td className="py-2 px-3 text-white print:text-black">Gross Earnings</td>
                        <td className="py-2 px-3 text-right font-mono text-blue-400 print:text-black">₨ {selectedPayroll.grossSalary?.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

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
                      {selectedPayroll.loanDeduction > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Loan Recovery</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.loanDeduction?.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayroll.advanceDeduction > 0 && (
                        <tr>
                          <td className="py-2 px-3 text-slate-300 print:text-black">Advance Recovery</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-black">₨ {selectedPayroll.advanceDeduction?.toLocaleString()}</td>
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

              <div className="bg-emerald-950/30 print:bg-gray-100 border-2 border-emerald-500/40 print:border-black p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-black text-emerald-400 print:text-black tracking-wider block">NET DISBURSED SALARY</span>
                  <span className="text-[11px] text-slate-400 print:text-gray-600">Gross Earnings - Deductions</span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400 print:text-black">
                  ₨ {selectedPayroll.netPayable?.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
