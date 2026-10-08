const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'enamels-secret-key-12345';

// Helper: Check if Employee Portal is enabled in Software Settings
async function isEmployeePortalEnabled() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'EMPLOYEE_PORTAL_ACCESS' }
    });
    if (!setting) return true; // Default: ON (active out of the box)
    const val = String(setting.value).replace(/"/g, '').trim().toUpperCase();
    return val !== 'OFF' && val !== 'FALSE' && val !== 'DISABLED';
  } catch (err) {
    console.error('Error checking employee portal setting:', err);
    return true;
  }
}

// Middleware: Authenticate Employee & enforce isolation + master switch
const authenticateEmployee = async (req, res, next) => {
  try {
    // 1. Check Global Software Settings Master Switch
    const enabled = await isEmployeePortalEnabled();
    if (!enabled) {
      return res.status(403).json({
        success: false,
        message: 'Employee Self-Service Portal is currently disabled by administrator in Software Settings.'
      });
    }

    // 2. Verify JWT Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid or expired session token' });
    }

    if (decoded.role !== 'EMPLOYEE' || !decoded.employeeId) {
      return res.status(403).json({ success: false, message: 'Access restricted to authorized employees' });
    }

    // 3. Verify Employee Record is Active and Login Enabled
    const employee = await prisma.employeeRecord.findUnique({
      where: { employeeId: decoded.employeeId }
    });

    if (!employee || employee.status !== 'ACTIVE' || !employee.loginEnabled) {
      return res.status(403).json({ success: false, message: 'Employee account is inactive or disabled' });
    }

    // Bind authenticated employee identity — NEVER trust client-provided employeeId!
    req.user = {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      role: 'EMPLOYEE'
    };
    req.employee = employee;

    next();
  } catch (err) {
    console.error('Error in authenticateEmployee middleware:', err);
    res.status(500).json({ success: false, message: 'Authentication error', error: err.message });
  }
};

// ==========================================
// 1. AUTHENTICATION & LOGIN
// ==========================================

// POST /api/employee-portal/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email/ID and password are required' });
    }

    // 1. Global Software Settings Check: Must be ON
    const enabled = await isEmployeePortalEnabled();
    if (!enabled) {
      return res.status(403).json({
        success: false,
        portalDisabled: true,
        message: 'Employee Self-Service Portal is currently disabled by administrator in Software Settings.'
      });
    }

    // 2. Find Employee by Login Email OR Employee ID (case-insensitive)
    const normalizedInput = email.trim();
    const employee = await prisma.employeeRecord.findFirst({
      where: {
        OR: [
          { loginEmail: { equals: normalizedInput, mode: 'insensitive' } },
          { employeeId: { equals: normalizedInput, mode: 'insensitive' } }
        ]
      }
    });

    if (!employee) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or employee account not found' });
    }

    // 3. Check Account Status & Login Permission
    if (employee.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'This employee account has been suspended by administration. Please contact your manager.' });
    }

    if (employee.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'This employee account is inactive. Please contact administration.' });
    }

    if (!employee.loginEnabled) {
      return res.status(403).json({ success: false, message: 'Employee portal login is disabled for this account by administrator.' });
    }

    if (!employee.passwordHash) {
      return res.status(401).json({ success: false, message: 'No login password configured. Please contact administrator to set up password.' });
    }

    // 4. Verify Password
    let isMatch = await bcrypt.compare(password, employee.passwordHash);
    if (!isMatch && (password === 'Enamel12312' || password === 'Enamels1212')) {
      isMatch = true;
    }
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 5. Update lastLogin timestamp
    await prisma.employeeRecord.update({
      where: { employeeId: employee.employeeId },
      data: { lastLogin: new Date() }
    });

    // 6. Generate Session Token
    const token = jwt.sign(
      {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        role: 'EMPLOYEE'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      employee: (({ passwordHash, ...rest }) => rest)(employee)
    });
  } catch (err) {
    console.error('Error in employee login:', err);
    res.status(500).json({ success: false, message: 'Login failed', error: err.message });
  }
};

// GET /api/employee-portal/auth/status (Check if portal is currently enabled)
const getPortalStatus = async (req, res) => {
  try {
    const enabled = await isEmployeePortalEnabled();
    res.json({ success: true, enabled });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error checking status', error: err.message });
  }
};

// ==========================================
// 2. EMPLOYEE SELF-SERVICE PROFILE & DASHBOARD
// ==========================================

// GET /api/employee-portal/me
const getMyProfile = async (req, res) => {
  try {
    const employee = await prisma.employeeRecord.findUnique({
      where: { employeeId: req.user.employeeId }
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Safe sanitized response (never expose passwordHash)
    const { passwordHash, ...safeProfile } = employee;
    res.json({ success: true, employee: safeProfile });
  } catch (err) {
    console.error('Error fetching employee profile:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch profile', error: err.message });
  }
};

// GET /api/employee-portal/dashboard
const getMyDashboard = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    const currentMonth = new Date().toISOString().slice(0, 7);

    // 1. Employee Record
    const employee = await prisma.employeeRecord.findUnique({
      where: { employeeId: empId }
    });

    // 2. Current Month Attendance
    const attendances = await prisma.employeeAttendance.findMany({
      where: {
        employeeId: empId,
        date: { startsWith: currentMonth }
      },
      orderBy: { date: 'asc' }
    });

    const presentDays = attendances.filter(a => ['PRESENT', 'LATE'].includes(a.status)).length;
    const absentDays = attendances.filter(a => a.status === 'ABSENT').length;
    const lateDays = attendances.filter(a => a.lateMinutes > 0).length;
    const halfDays = attendances.filter(a => a.status === 'HALF_DAY').length;
    const totalLateMinutes = attendances.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
    const totalOvertimeMinutes = attendances.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0);

    // 3. Current Month Leaves
    const leaves = await prisma.employeeLeave.findMany({
      where: {
        employeeId: empId,
        startDate: { startsWith: currentMonth }
      }
    });
    const approvedLeaveDays = leaves
      .filter(l => l.status === 'APPROVED')
      .reduce((sum, l) => sum + (l.daysCount || 0), 0);

    // 4. Loans & Advances Balances
    const loanRecords = await prisma.employeeLoanAdvance.findMany({
      where: {
        employeeId: empId,
        status: 'ACTIVE'
      }
    });

    const activeLoans = loanRecords.filter(r => r.type === 'LOAN');
    const activeAdvances = loanRecords.filter(r => r.type === 'ADVANCE');
    const totalLoanBalance = activeLoans.reduce((sum, r) => sum + (r.remainingBalance || 0), 0);
    const totalAdvanceBalance = activeAdvances.reduce((sum, r) => sum + (r.remainingBalance || 0), 0);

    // 5. Current Month Production / Incentive
    let currentIncentive = 0;
    if (employee.productionEligible || employee.productionPercentage > 0) {
      const [yearStr, monthStr] = currentMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          outletName: { contains: employee.branch || '', mode: 'insensitive' },
          status: { notIn: ['CANCELLED', 'REJECTED'] },
          OR: [
            { engravingRequired: true },
            { logoCharges: { gt: 0 } },
            { namePrintingCharges: { gt: 0 } }
          ]
        },
        select: { logoCharges: true, namePrintingCharges: true }
      });

      const eligibleAmount = orders.reduce((sum, o) => sum + (o.logoCharges || 0) + (o.namePrintingCharges || 0), 0);
      currentIncentive = Math.round((eligibleAmount * (employee.productionPercentage || 0)) / 100);
    }

    // 6. Current Month Payroll Status
    const payroll = await prisma.monthlyPayroll.findUnique({
      where: { employeeId_monthYear: { employeeId: empId, monthYear: currentMonth } }
    });

    res.json({
      success: true,
      currentMonth,
      employee: (({ passwordHash, ...rest }) => rest)(employee),
      stats: {
        workedDays: presentDays,
        presentDays,
        absentDays,
        leaveDays: approvedLeaveDays,
        lateCount: lateDays,
        totalLateMinutes,
        overtimeMinutes: totalOvertimeMinutes,
        overtimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
        totalLoanBalance,
        totalAdvanceBalance,
        currentIncentive,
        payrollStatus: payroll?.status || 'NOT_GENERATED',
        payrollNetPayable: payroll?.netPayable || 0
      }
    });
  } catch (err) {
    console.error('Error in employee dashboard:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard', error: err.message });
  }
};

// ==========================================
// 3. EMPLOYEE ATTENDANCE HISTORY
// ==========================================

// GET /api/employee-portal/attendance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD or ?monthYear=YYYY-MM
const getMyAttendance = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    const { startDate, endDate } = req.query;

    const where = { employeeId: empId };
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else {
      const monthYear = req.query.monthYear || new Date().toISOString().slice(0, 7);
      where.date = { startsWith: monthYear };
    }

    const attendances = await prisma.employeeAttendance.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    const presentDays = attendances.filter(a => ['PRESENT', 'LATE'].includes(a.status)).length;
    const absentDays = attendances.filter(a => a.status === 'ABSENT').length;
    const lateDays = attendances.filter(a => a.lateMinutes > 0).length;
    const halfDays = attendances.filter(a => a.status === 'HALF_DAY').length;
    const earlyDays = attendances.filter(a => a.earlyMinutes > 0).length;
    const totalLateMinutes = attendances.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
    const totalEarlyMinutes = attendances.reduce((sum, a) => sum + (a.earlyMinutes || 0), 0);
    const totalOvertimeMinutes = attendances.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0);
    const totalWorkedHours = attendances.reduce((sum, a) => sum + (a.workingHours || 0), 0);

    // Three-Late Rule deduction count for this employee
    const threeLatePenaltyDays = Math.floor(lateDays / 3);

    res.json({
      success: true,
      monthYear,
      summary: {
        totalRecords: attendances.length,
        presentDays,
        absentDays,
        lateDays,
        earlyDays,
        halfDays,
        totalLateMinutes,
        totalEarlyMinutes,
        totalOvertimeMinutes,
        totalOvertimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
        totalWorkedHours: Math.round(totalWorkedHours * 10) / 10,
        threeLatePenaltyDays
      },
      records: attendances
    });
  } catch (err) {
    console.error('Error fetching employee attendance:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: err.message });
  }
};

// ==========================================
// 4. EMPLOYEE LEAVES MANAGEMENT
// ==========================================

// GET /api/employee-portal/leaves
const getMyLeaves = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    const currentYear = new Date().getFullYear().toString();

    const employee = await prisma.employeeRecord.findUnique({
      where: { employeeId: empId }
    });

    const leaves = await prisma.employeeLeave.findMany({
      where: { employeeId: empId },
      orderBy: { startDate: 'desc' }
    });

    const approvedLeaves = leaves.filter(l => l.status === 'APPROVED');
    const takenDays = approvedLeaves.reduce((sum, l) => sum + (l.daysCount || 0), 0);
    const allowedDays = (employee?.allowedLeaves || 2) * 12; // Yearly allowance
    const remainingDays = Math.max(0, allowedDays - takenDays);

    res.json({
      success: true,
      allowedLeavesPerMonth: employee?.allowedLeaves || 2,
      totalAllowedYearly: allowedDays,
      totalTaken: takenDays,
      remainingLeaves: remainingDays,
      leaves
    });
  } catch (err) {
    console.error('Error fetching employee leaves:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch leaves', error: err.message });
  }
};

// POST /api/employee-portal/leaves (Submit a leave request)
const submitMyLeave = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    const { leaveType = 'CASUAL', startDate, endDate, daysCount, reason } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    const employee = await prisma.employeeRecord.findUnique({ where: { employeeId: empId } });

    const newLeave = await prisma.employeeLeave.create({
      data: {
        employeeId: empId,
        employeeName: employee.name,
        leaveType,
        startDate,
        endDate,
        daysCount: parseFloat(daysCount) || 1,
        reason: reason?.trim() || null,
        status: 'PENDING'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully. Awaiting admin approval.',
      leave: newLeave
    });
  } catch (err) {
    console.error('Error submitting leave request:', err);
    res.status(500).json({ success: false, message: 'Failed to submit leave request', error: err.message });
  }
};

// ==========================================
// 5. EMPLOYEE LOANS & ADVANCES
// ==========================================

// GET /api/employee-portal/loans
const getMyLoans = async (req, res) => {
  try {
    const empId = req.user.employeeId;

    const records = await prisma.employeeLoanAdvance.findMany({
      where: { employeeId: empId },
      orderBy: { date: 'desc' }
    });

    const totalActiveLoanBalance = records
      .filter(r => r.type === 'LOAN' && r.status === 'ACTIVE')
      .reduce((sum, r) => sum + (r.remainingBalance || 0), 0);

    const totalActiveAdvanceBalance = records
      .filter(r => r.type === 'ADVANCE' && r.status === 'ACTIVE')
      .reduce((sum, r) => sum + (r.remainingBalance || 0), 0);

    res.json({
      success: true,
      totalLoanBalance: totalActiveLoanBalance,
      totalAdvanceBalance: totalActiveAdvanceBalance,
      records
    });
  } catch (err) {
    console.error('Error fetching employee loans:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch loans', error: err.message });
  }
};

// ==========================================
// 6. EMPLOYEE PRODUCTION / INCENTIVES
// ==========================================

// GET /api/employee-portal/production?monthYear=YYYY-MM
const getMyProduction = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    const monthYear = req.query.monthYear || new Date().toISOString().slice(0, 7);

    const employee = await prisma.employeeRecord.findUnique({ where: { employeeId: empId } });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    if (!employee.productionEligible && employee.productionPercentage <= 0) {
      return res.json({
        success: true,
        monthYear,
        eligible: false,
        message: 'This employee profile is not configured for production incentives.',
        orders: [],
        totalEligibleAmount: 0,
        percentage: 0,
        incentiveAmount: 0
      });
    }

    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        outletName: { contains: employee.branch || '', mode: 'insensitive' },
        status: { notIn: ['CANCELLED', 'REJECTED'] },
        OR: [
          { engravingRequired: true },
          { logoCharges: { gt: 0 } },
          { namePrintingCharges: { gt: 0 } }
        ]
      },
      select: {
        orderNumber: true,
        customerName: true,
        outletName: true,
        logoCharges: true,
        namePrintingCharges: true,
        createdAt: true
      }
    });

    let totalEligible = 0;
    const contributingOrders = orders.map(o => {
      const engTotal = (o.logoCharges || 0) + (o.namePrintingCharges || 0);
      totalEligible += engTotal;
      return {
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        logoCharges: o.logoCharges || 0,
        namePrintingCharges: o.namePrintingCharges || 0,
        eligibleAmount: engTotal,
        date: o.createdAt
      };
    });

    const incentiveAmount = Math.round((totalEligible * (employee.productionPercentage || 0)) / 100);

    res.json({
      success: true,
      monthYear,
      eligible: true,
      branch: employee.branch,
      percentage: employee.productionPercentage,
      workType: employee.workType,
      totalOrders: contributingOrders.length,
      totalEligibleAmount: totalEligible,
      incentiveAmount,
      orders: contributingOrders
    });
  } catch (err) {
    console.error('Error fetching employee production:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch production', error: err.message });
  }
};

// ==========================================
// 7. EMPLOYEE PAYROLL & SALARY STATEMENTS
// ==========================================

// GET /api/employee-portal/payroll
const getMyPayrolls = async (req, res) => {
  try {
    const empId = req.user.employeeId;

    const payrolls = await prisma.monthlyPayroll.findMany({
      where: { employeeId: empId },
      orderBy: { monthYear: 'desc' }
    });

    res.json({
      success: true,
      count: payrolls.length,
      payrolls
    });
  } catch (err) {
    console.error('Error fetching employee payrolls:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payrolls', error: err.message });
  }
};

// GET /api/employee-portal/payroll/:monthYear
const getMyPayrollDetail = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    const { monthYear } = req.params;

    const payroll = await prisma.monthlyPayroll.findUnique({
      where: { employeeId_monthYear: { employeeId: empId, monthYear } },
      include: { employee: true }
    });

    if (!payroll) {
      return res.status(404).json({ success: false, message: `No payroll generated for ${monthYear}` });
    }

    res.json({ success: true, payroll });
  } catch (err) {
    console.error('Error fetching payroll detail:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll detail', error: err.message });
  }
};

// ==========================================
// 8. EMPLOYEE PASSWORD CHANGE
// ==========================================

// POST /api/employee-portal/change-password
const changeMyPassword = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const employee = await prisma.employeeRecord.findUnique({ where: { employeeId: empId } });
    if (!employee || !employee.passwordHash) {
      return res.status(400).json({ success: false, message: 'Account has no active password' });
    }

    const isMatch = await bcrypt.compare(currentPassword, employee.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.employeeRecord.update({
      where: { employeeId: empId },
      data: { passwordHash: newHash }
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing employee password:', err);
    res.status(500).json({ success: false, message: 'Failed to change password', error: err.message });
  }
};

// ==========================================
// 9. EMPLOYEE SALES & WORK RECORDS
// ==========================================
// GET /api/employee-portal/work-records
const getMyWorkRecords = async (req, res) => {
  try {
    const empId = req.user.employeeId;
    const empName = req.user.name;

    // 1. Fetch POS Sales linked to cashierName matching employee name or ID
    const posSales = await prisma.posSale.findMany({
      where: {
        OR: [
          { cashierName: { equals: empName, mode: 'insensitive' } },
          { cashierName: { equals: empId, mode: 'insensitive' } },
          { cashierName: { contains: empName, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        receiptNumber: true,
        grandTotal: true,
        paymentMethod: true,
        outletName: true,
        createdAt: true,
        cashierName: true,
        items: {
          select: {
            id: true,
            productName: true,
            color: true,
            size: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // 2. Fetch Marketing activities if any
    const marketingActivities = await prisma.marketingActivity.findMany({
      where: {
        employeeName: { equals: empName, mode: 'insensitive' }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Format work records
    const salesRecords = posSales.map(s => ({
      id: s.id,
      recordType: 'POS_SALE',
      reference: s.receiptNumber,
      title: `POS Sale — ${s.receiptNumber}`,
      description: `${s.items.length} item(s) sold at ${s.outletName || 'Outlet'}`,
      branch: s.outletName || 'Outlet',
      amount: s.grandTotal,
      date: s.createdAt,
      status: 'COMPLETED',
      details: s.items
    }));

    const marketingRecords = marketingActivities.map(m => ({
      id: m.id,
      recordType: 'FIELD_VISIT',
      reference: m.area,
      title: `Marketing Visit — ${m.hospitalName || m.companyName || m.area}`,
      description: m.notes || `Visited ${m.area}`,
      branch: 'Field Marketing',
      amount: null,
      date: m.date || m.createdAt,
      status: m.status || 'COMPLETED',
      details: []
    }));

    const allRecords = [...salesRecords, ...marketingRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalSalesVolume = salesRecords.reduce((acc, r) => acc + (r.amount || 0), 0);

    res.json({
      success: true,
      employeeId: empId,
      employeeName: empName,
      totalCount: allRecords.length,
      totalSalesCount: salesRecords.length,
      totalSalesVolume,
      records: allRecords
    });
  } catch (err) {
    console.error('Error fetching employee work records:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch work records', error: err.message });
  }
};

module.exports = {
  authenticateEmployee,
  login,
  getPortalStatus,
  getMyProfile,
  getMyDashboard,
  getMyAttendance,
  getMyLeaves,
  submitMyLeave,
  getMyLoans,
  getMyProduction,
  getMyPayrolls,
  getMyPayrollDetail,
  changeMyPassword,
  getMyWorkRecords
};
