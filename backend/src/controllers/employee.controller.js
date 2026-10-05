const prisma = require('../prisma');
const XLSX = require('xlsx');

// Helper to convert time strings ("10:00", "10:15 AM", "18:00", "06:30 PM") to minutes from midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = String(timeStr).trim();
  const is12Hour = /am|pm/i.test(str);
  if (is12Hour) {
    const match = str.match(/(\d+):(\d+)(?::\d+)?\s*(am|pm)/i);
    if (!match) return null;
    let [_, hours, mins, modifier] = match;
    hours = parseInt(hours, 10);
    mins = parseInt(mins, 10);
    if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;
    return hours * 60 + mins;
  } else {
    const parts = str.split(':');
    if (parts.length < 2) return null;
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    return hours * 60 + mins;
  }
}

// Compute Late, Early Checkout, and Overtime minutes according to rules
function calculateAttendanceMetrics(scheduledIn, scheduledOut, actualIn, actualOut, status = 'PRESENT') {
  if (status === 'ABSENT' || status === 'LEAVE') {
    return { lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, workingHours: 0 };
  }

  const sIn = parseTimeToMinutes(scheduledIn || '10:00') ?? 600; // 10:00 AM
  const sOut = parseTimeToMinutes(scheduledOut || '18:00') ?? 1080; // 6:00 PM
  const aIn = parseTimeToMinutes(actualIn);
  const aOut = parseTimeToMinutes(actualOut);

  let lateMinutes = 0;
  let earlyMinutes = 0;
  let overtimeMinutes = 0;

  // 1. Check-in grace period: 15 minutes allowed
  // 10:00 - 10:15 -> On Time. After 10:15 -> Late (difference from scheduled)
  if (aIn !== null) {
    if (aIn > sIn + 15) {
      lateMinutes = aIn - sIn;
    }
  }

  // 2. Check-out early check: Up to 10 minutes early allowed (5:50 PM).
  // More than 10 minutes early -> early checkout minutes apply
  if (aOut !== null) {
    if (aOut < sOut - 10) {
      earlyMinutes = sOut - aOut;
    }
    // 3. Overtime: Up to 15 min after checkout (6:15 PM) -> no overtime.
    // After 15 minutes -> overtime starts
    if (aOut > sOut + 15) {
      overtimeMinutes = aOut - sOut;
    }
  }

  // Working hours
  let workingHours = 8;
  if (status === 'HALF_DAY') {
    workingHours = 4;
  } else if (aIn !== null && aOut !== null && aOut > aIn) {
    workingHours = Math.round(((aOut - aIn) / 60) * 10) / 10;
  }

  return { lateMinutes, earlyMinutes, overtimeMinutes, workingHours };
}

// ==========================================
// 1. EMPLOYEE DIRECTORY & PROFILE MANAGEMENT
// ==========================================

// GET /api/employees
const getEmployees = async (req, res) => {
  try {
    const { status, branch, department, search } = req.query;
    const where = {};

    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }
    if (branch && branch !== 'ALL') {
      where.branch = { contains: branch, mode: 'insensitive' };
    }
    if (department && department !== 'ALL') {
      where.department = { contains: department, mode: 'insensitive' };
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { employeeId: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } }
      ];
    }

    const employees = await prisma.employeeRecord.findMany({
      where,
      orderBy: { employeeId: 'asc' }
    });

    res.json({ success: true, count: employees.length, employees });
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch employees', error: err.message });
  }
};

// GET /api/employees/:employeeId
const getEmployeeById = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await prisma.employeeRecord.findUnique({
      where: { employeeId },
      include: {
        attendanceRecords: {
          take: 31,
          orderBy: { date: 'desc' }
        },
        payrollRecords: {
          take: 12,
          orderBy: { monthYear: 'desc' }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, employee });
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch employee', error: err.message });
  }
};

// POST /api/employees
const createEmployee = async (req, res) => {
  try {
    const {
      employeeId,
      name,
      fatherName,
      dateOfBirth,
      phone,
      email,
      cnic,
      designation,
      department,
      branch,
      joiningDate,
      monthlySalary,
      workingHours,
      checkInTime,
      checkOutTime,
      fuelAllowance,
      travelAllowance,
      otherAllowances,
      loan,
      advance,
      otherDeductions,
      productionPercentage,
      workType,
      status,
      notes
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Employee name is required' });
    }

    // Auto-generate employeeId if not provided e.g. EMP-001
    let finalEmpId = (employeeId || '').trim();
    if (!finalEmpId) {
      const count = await prisma.employeeRecord.count();
      finalEmpId = `EMP-${String(count + 1).padStart(3, '0')}`;
    }

    // Check unique employeeId
    const existing = await prisma.employeeRecord.findUnique({ where: { employeeId: finalEmpId } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Employee ID "${finalEmpId}" is already in use` });
    }

    const employee = await prisma.employeeRecord.create({
      data: {
        employeeId: finalEmpId,
        name: name.trim(),
        fatherName: fatherName?.trim() || null,
        dateOfBirth: dateOfBirth || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        cnic: cnic?.trim() || null,
        designation: designation?.trim() || null,
        department: department?.trim() || null,
        branch: branch?.trim() || null,
        joiningDate: joiningDate || null,
        monthlySalary: parseFloat(monthlySalary) || 0,
        workingHours: parseFloat(workingHours) || 8,
        checkInTime: checkInTime || '10:00',
        checkOutTime: checkOutTime || '18:00',
        fuelAllowance: parseFloat(fuelAllowance) || 0,
        travelAllowance: parseFloat(travelAllowance) || 0,
        otherAllowances: parseFloat(otherAllowances) || 0,
        loan: parseFloat(loan) || 0,
        advance: parseFloat(advance) || 0,
        otherDeductions: parseFloat(otherDeductions) || 0,
        productionPercentage: parseFloat(productionPercentage) || 0,
        workType: workType || 'STANDARD',
        status: status?.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        notes: notes?.trim() || null
      }
    });

    res.status(201).json({ success: true, message: 'Employee created successfully', employee });
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(500).json({ success: false, message: 'Failed to create employee', error: err.message });
  }
};

// PUT /api/employees/:employeeId
const updateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const existing = await prisma.employeeRecord.findUnique({ where: { employeeId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const data = { ...req.body };
    // Numeric fields parsing
    if (data.monthlySalary !== undefined) data.monthlySalary = parseFloat(data.monthlySalary) || 0;
    if (data.workingHours !== undefined) data.workingHours = parseFloat(data.workingHours) || 8;
    if (data.fuelAllowance !== undefined) data.fuelAllowance = parseFloat(data.fuelAllowance) || 0;
    if (data.travelAllowance !== undefined) data.travelAllowance = parseFloat(data.travelAllowance) || 0;
    if (data.otherAllowances !== undefined) data.otherAllowances = parseFloat(data.otherAllowances) || 0;
    if (data.loan !== undefined) data.loan = parseFloat(data.loan) || 0;
    if (data.advance !== undefined) data.advance = parseFloat(data.advance) || 0;
    if (data.otherDeductions !== undefined) data.otherDeductions = parseFloat(data.otherDeductions) || 0;
    if (data.productionPercentage !== undefined) data.productionPercentage = parseFloat(data.productionPercentage) || 0;
    if (data.status) data.status = data.status.toUpperCase();

    // Prevent changing employeeId in update payload
    delete data.employeeId;
    delete data.id;

    const updated = await prisma.employeeRecord.update({
      where: { employeeId },
      data
    });

    res.json({ success: true, message: 'Employee updated successfully', employee: updated });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ success: false, message: 'Failed to update employee', error: err.message });
  }
};

// DELETE /api/employees/:employeeId
const deleteEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const existing = await prisma.employeeRecord.findUnique({ where: { employeeId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Soft delete: set status to INACTIVE
    await prisma.employeeRecord.update({
      where: { employeeId },
      data: { status: 'INACTIVE' }
    });

    res.json({ success: true, message: `Employee ${employeeId} marked as INACTIVE` });
  } catch (err) {
    console.error('Error deleting employee:', err);
    res.status(500).json({ success: false, message: 'Failed to delete employee', error: err.message });
  }
};

// ==========================================
// 2. ATTENDANCE & TIME MANAGEMENT
// ==========================================

// GET /api/employees/attendance/daily?date=YYYY-MM-DD
const getDailyAttendance = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const branch = req.query.branch;

    const empWhere = { status: 'ACTIVE' };
    if (branch && branch !== 'ALL') {
      empWhere.branch = { contains: branch, mode: 'insensitive' };
    }

    const employees = await prisma.employeeRecord.findMany({
      where: empWhere,
      orderBy: { employeeId: 'asc' }
    });

    const attendances = await prisma.employeeAttendance.findMany({
      where: { date }
    });

    const attMap = new Map();
    attendances.forEach(a => attMap.set(a.employeeId, a));

    // Combine employees with their attendance for this day
    const records = employees.map(emp => {
      const att = attMap.get(emp.employeeId);
      if (att) {
        return {
          ...att,
          branch: emp.branch,
          department: emp.department,
          designation: emp.designation,
          monthlySalary: emp.monthlySalary
        };
      }
      return {
        id: null,
        employeeId: emp.employeeId,
        employeeName: emp.name,
        branch: emp.branch,
        department: emp.department,
        designation: emp.designation,
        date,
        checkInTime: null,
        checkOutTime: null,
        scheduledCheckIn: emp.checkInTime || '10:00',
        scheduledCheckOut: emp.checkOutTime || '18:00',
        lateMinutes: 0,
        earlyMinutes: 0,
        overtimeMinutes: 0,
        status: 'ABSENT',
        workingHours: emp.workingHours || 8,
        monthlySalary: emp.monthlySalary,
        notes: null
      };
    });

    res.json({ success: true, date, count: records.length, records });
  } catch (err) {
    console.error('Error fetching daily attendance:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: err.message });
  }
};

// POST /api/employees/attendance/mark
const markAttendance = async (req, res) => {
  try {
    const {
      employeeId,
      date,
      checkInTime,
      checkOutTime,
      status = 'PRESENT',
      notes
    } = req.body;

    if (!employeeId || !date) {
      return res.status(400).json({ success: false, message: 'employeeId and date are required' });
    }

    const employee = await prisma.employeeRecord.findUnique({ where: { employeeId } });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const sIn = employee.checkInTime || '10:00';
    const sOut = employee.checkOutTime || '18:00';

    const { lateMinutes, earlyMinutes, overtimeMinutes, workingHours } = calculateAttendanceMetrics(
      sIn,
      sOut,
      checkInTime,
      checkOutTime,
      status
    );

    // Auto-adjust status: if on time with lateMinutes > 0, set status LATE if was marked PRESENT
    let finalStatus = status;
    if (status === 'PRESENT' && lateMinutes > 0) {
      finalStatus = 'LATE';
    }

    const record = await prisma.employeeAttendance.upsert({
      where: {
        employeeId_date: { employeeId, date }
      },
      update: {
        employeeName: employee.name,
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        scheduledCheckIn: sIn,
        scheduledCheckOut: sOut,
        lateMinutes,
        earlyMinutes,
        overtimeMinutes,
        status: finalStatus,
        workingHours,
        notes: notes || null
      },
      create: {
        employeeId,
        employeeName: employee.name,
        date,
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        scheduledCheckIn: sIn,
        scheduledCheckOut: sOut,
        lateMinutes,
        earlyMinutes,
        overtimeMinutes,
        status: finalStatus,
        workingHours,
        notes: notes || null
      }
    });

    res.json({ success: true, message: 'Attendance recorded', record });
  } catch (err) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ success: false, message: 'Failed to record attendance', error: err.message });
  }
};

// POST /api/employees/attendance/bulk-mark
const bulkMarkAttendance = async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'date and records array are required' });
    }

    const results = [];
    for (const item of records) {
      if (!item.employeeId) continue;
      const employee = await prisma.employeeRecord.findUnique({ where: { employeeId: item.employeeId } });
      if (!employee) continue;

      const sIn = employee.checkInTime || '10:00';
      const sOut = employee.checkOutTime || '18:00';
      const status = item.status || 'PRESENT';

      const { lateMinutes, earlyMinutes, overtimeMinutes, workingHours } = calculateAttendanceMetrics(
        sIn,
        sOut,
        item.checkInTime,
        item.checkOutTime,
        status
      );

      let finalStatus = status;
      if (status === 'PRESENT' && lateMinutes > 0) finalStatus = 'LATE';

      const rec = await prisma.employeeAttendance.upsert({
        where: {
          employeeId_date: { employeeId: item.employeeId, date }
        },
        update: {
          employeeName: employee.name,
          checkInTime: item.checkInTime || null,
          checkOutTime: item.checkOutTime || null,
          scheduledCheckIn: sIn,
          scheduledCheckOut: sOut,
          lateMinutes,
          earlyMinutes,
          overtimeMinutes,
          status: finalStatus,
          workingHours,
          notes: item.notes || null
        },
        create: {
          employeeId: item.employeeId,
          employeeName: employee.name,
          date,
          checkInTime: item.checkInTime || null,
          checkOutTime: item.checkOutTime || null,
          scheduledCheckIn: sIn,
          scheduledCheckOut: sOut,
          lateMinutes,
          earlyMinutes,
          overtimeMinutes,
          status: finalStatus,
          workingHours,
          notes: item.notes || null
        }
      });
      results.push(rec);
    }

    res.json({ success: true, message: `Updated ${results.length} attendance records`, count: results.length });
  } catch (err) {
    console.error('Error in bulkMarkAttendance:', err);
    res.status(500).json({ success: false, message: 'Failed to bulk mark attendance', error: err.message });
  }
};

// GET /api/employees/attendance/monthly?monthYear=YYYY-MM
const getMonthlyAttendance = async (req, res) => {
  try {
    const monthYear = req.query.monthYear || new Date().toISOString().slice(0, 7);
    const branch = req.query.branch;

    const empWhere = { status: 'ACTIVE' };
    if (branch && branch !== 'ALL') {
      empWhere.branch = { contains: branch, mode: 'insensitive' };
    }

    const employees = await prisma.employeeRecord.findMany({
      where: empWhere,
      orderBy: { employeeId: 'asc' }
    });

    const attendances = await prisma.employeeAttendance.findMany({
      where: {
        date: { startsWith: monthYear }
      },
      orderBy: { date: 'asc' }
    });

    // Group by employeeId
    const attByEmp = new Map();
    attendances.forEach(a => {
      if (!attByEmp.has(a.employeeId)) attByEmp.set(a.employeeId, []);
      attByEmp.get(a.employeeId).push(a);
    });

    const summary = employees.map(emp => {
      const records = attByEmp.get(emp.employeeId) || [];
      const presentDays = records.filter(r => ['PRESENT', 'LATE'].includes(r.status)).length;
      const absentDays = records.filter(r => r.status === 'ABSENT').length;
      const lateDays = records.filter(r => r.lateMinutes > 0).length;
      const halfDays = records.filter(r => r.status === 'HALF_DAY').length;
      const totalLateMinutes = records.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
      const totalEarlyMinutes = records.reduce((sum, r) => sum + (r.earlyMinutes || 0), 0);
      const totalOvertimeMinutes = records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);

      // Three-Late Rule: Every 3 lates = 1 day salary deduction
      const threeLatePenaltyDays = Math.floor(lateDays / 3);

      return {
        employeeId: emp.employeeId,
        employeeName: emp.name,
        branch: emp.branch,
        department: emp.department,
        designation: emp.designation,
        monthlySalary: emp.monthlySalary,
        totalRecords: records.length,
        presentDays,
        absentDays,
        lateDays,
        halfDays,
        threeLatePenaltyDays,
        totalLateMinutes,
        totalEarlyMinutes,
        totalOvertimeMinutes,
        totalOvertimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10
      };
    });

    res.json({ success: true, monthYear, summary, detailedAttendances: attendances });
  } catch (err) {
    console.error('Error fetching monthly attendance:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly attendance', error: err.message });
  }
};

// GET /api/employees/attendance/export-excel?monthYear=YYYY-MM
const exportAttendanceExcel = async (req, res) => {
  try {
    const monthYear = req.query.monthYear || new Date().toISOString().slice(0, 7);

    const attendances = await prisma.employeeAttendance.findMany({
      where: {
        date: { startsWith: monthYear }
      },
      include: {
        employee: true
      },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }]
    });

    const rows = attendances.map(a => ({
      'Employee ID': a.employeeId,
      'Employee Name': a.employeeName,
      'Branch': a.employee?.branch || 'N/A',
      'Department': a.employee?.department || 'N/A',
      'Date': a.date,
      'Check-in': a.checkInTime || '--:--',
      'Check-out': a.checkOutTime || '--:--',
      'Scheduled Check-in': a.scheduledCheckIn,
      'Scheduled Check-out': a.scheduledCheckOut,
      'Late Minutes': a.lateMinutes,
      'Early Minutes': a.earlyMinutes,
      'Overtime Minutes': a.overtimeMinutes,
      'Attendance Status': a.status,
      'Working Hours': a.workingHours,
      'Notes': a.notes || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Message': `No attendance records found for ${monthYear}` }]);
    XLSX.utils.book_append_sheet(wb, ws, `Attendance_${monthYear}`);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="Attendance_${monthYear}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting attendance excel:', err);
    res.status(500).json({ success: false, message: 'Failed to export excel', error: err.message });
  }
};

// ==========================================
// 3. PRODUCTION & ENGRAVING EARNING LOOKUP
// ==========================================

// Helper: Query eligible branch-specific engraving/production work in a month
async function getEligibleProductionAmount(branch, monthYear, workType = 'ENGRAVING') {
  if (!branch) return { amount: 0, count: 0, orders: [] };

  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  try {
    // Orders matching branch in month with engraving
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        outletName: { contains: branch, mode: 'insensitive' },
        status: { notIn: ['CANCELLED', 'REJECTED'] },
        OR: [
          { engravingRequired: true },
          { logoCharges: { gt: 0 } },
          { namePrintingCharges: { gt: 0 } }
        ]
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        outletName: true,
        logoCharges: true,
        namePrintingCharges: true,
        customizationPrice: true,
        createdAt: true
      }
    });

    let totalAmount = 0;
    const contributingOrders = orders.map(o => {
      // Per spec 7: Count actual engraving work (logoCharges + namePrintingCharges).
      // Do not count unrelated customization / custom-size charges.
      const engAmount = (o.logoCharges || 0) + (o.namePrintingCharges || 0);
      totalAmount += engAmount;
      return {
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        logoCharges: o.logoCharges || 0,
        namePrintingCharges: o.namePrintingCharges || 0,
        eligibleAmount: engAmount
      };
    });

    return {
      amount: totalAmount,
      count: contributingOrders.length,
      orders: contributingOrders
    };
  } catch (err) {
    console.warn('Warning querying production/engraving amount:', err.message);
    return { amount: 0, count: 0, orders: [] };
  }
}

// ==========================================
// 4. PAYROLL CALCULATION & LIFECYCLE
// ==========================================

// GET /api/employees/payroll?monthYear=YYYY-MM
const getMonthlyPayrollList = async (req, res) => {
  try {
    const monthYear = req.query.monthYear || new Date().toISOString().slice(0, 7);
    const branch = req.query.branch;

    const where = { monthYear };
    if (branch && branch !== 'ALL') {
      where.branch = { contains: branch, mode: 'insensitive' };
    }

    const payrolls = await prisma.monthlyPayroll.findMany({
      where,
      include: { employee: true },
      orderBy: { employeeId: 'asc' }
    });

    res.json({ success: true, monthYear, count: payrolls.length, payrolls });
  } catch (err) {
    console.error('Error fetching payrolls:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll list', error: err.message });
  }
};

// POST /api/employees/payroll/calculate?monthYear=YYYY-MM
const calculateMonthlyPayroll = async (req, res) => {
  try {
    const monthYear = req.body?.monthYear || req.query.monthYear || new Date().toISOString().slice(0, 7);
    const employeeIdFilter = req.body?.employeeId;

    const empWhere = { status: 'ACTIVE' };
    if (employeeIdFilter) empWhere.employeeId = employeeIdFilter;

    const employees = await prisma.employeeRecord.findMany({
      where: empWhere,
      orderBy: { employeeId: 'asc' }
    });

    const attendances = await prisma.employeeAttendance.findMany({
      where: { date: { startsWith: monthYear } }
    });

    const attByEmp = new Map();
    attendances.forEach(a => {
      if (!attByEmp.has(a.employeeId)) attByEmp.set(a.employeeId, []);
      attByEmp.get(a.employeeId).push(a);
    });

    const calculatedPayrolls = [];

    for (const emp of employees) {
      // Check if existing payroll is FINALIZED — preserved historical payroll!
      const existing = await prisma.monthlyPayroll.findUnique({
        where: { employeeId_monthYear: { employeeId: emp.employeeId, monthYear } }
      });

      if (existing?.isFinalized) {
        calculatedPayrolls.push(existing);
        continue;
      }

      const records = attByEmp.get(emp.employeeId) || [];
      const presentDays = records.filter(r => ['PRESENT', 'LATE'].includes(r.status)).length;
      const absentDays = records.filter(r => r.status === 'ABSENT').length;
      const lateDays = records.filter(r => r.lateMinutes > 0).length;
      const halfDays = records.filter(r => r.status === 'HALF_DAY').length;

      const totalLateMinutes = records.reduce((s, r) => s + (r.lateMinutes || 0), 0);
      const totalEarlyMinutes = records.reduce((s, r) => s + (r.earlyMinutes || 0), 0);
      const totalOvertimeMinutes = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
      const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10;

      const basicSalary = emp.monthlySalary || 0;
      const workingDays = 30; // standard 30-day denominator
      const perDaySalary = workingDays > 0 ? (basicSalary / workingDays) : 0;
      const hourlyRate = (emp.workingHours && emp.workingHours > 0) ? (perDaySalary / emp.workingHours) : (perDaySalary / 8);

      // Three-Late Rule: Every 3 lates = 1 day salary deduction
      const threeLatePenaltyDays = Math.floor(lateDays / 3);
      const lateDeductions = Math.round(threeLatePenaltyDays * perDaySalary);

      // Absent & Half day deduction
      const absentDeductions = Math.round((absentDays * perDaySalary) + (halfDays * 0.5 * perDaySalary));

      // Early checkout deduction
      const earlyCheckoutDeductions = Math.round((totalEarlyMinutes / 60) * hourlyRate);

      // Overtime amount (1.0x rate)
      const overtimeAmount = Math.round(overtimeHours * hourlyRate);

      // Allowances
      const fuelAllowance = emp.fuelAllowance || 0;
      const travelAllowance = emp.travelAllowance || 0;
      const otherAllowances = emp.otherAllowances || 0;
      const totalAllowances = fuelAllowance + travelAllowance + otherAllowances;

      // Loans & Deductions
      const loanDeduction = existing?.loanDeduction ?? (emp.advance || 0); // monthly deduction
      const advanceDeduction = existing?.advanceDeduction ?? 0;
      const otherDeductions = emp.otherDeductions || 0;

      // Production / Engraving calculation
      let eligibleProductionAmount = 0;
      let productionEarning = 0;
      let productionOrders = [];

      if ((emp.productionPercentage || 0) > 0) {
        const prodData = await getEligibleProductionAmount(emp.branch, monthYear, emp.workType);
        eligibleProductionAmount = existing?.eligibleProductionAmount ?? prodData.amount;
        productionEarning = Math.round(eligibleProductionAmount * (emp.productionPercentage / 100));
        productionOrders = prodData.orders;
      }

      // Manual adjustment
      const manualAdjustment = existing?.manualAdjustment || 0;
      const adjustmentNote = existing?.adjustmentNote || null;

      // Formula: Gross Salary + Allowances + Overtime - Deductions = Net Payable Salary
      const grossSalary = Math.round(basicSalary + totalAllowances + overtimeAmount + productionEarning);
      const totalDeductions = Math.round(absentDeductions + lateDeductions + earlyCheckoutDeductions + loanDeduction + advanceDeduction + otherDeductions);
      const netPayable = Math.max(0, Math.round(grossSalary - totalDeductions + manualAdjustment));

      const breakdown = {
        calculatedAt: new Date().toISOString(),
        perDaySalary: Math.round(perDaySalary),
        hourlyRate: Math.round(hourlyRate),
        attendanceSummary: {
          totalRecords: records.length,
          presentDays,
          absentDays,
          lateDays,
          halfDays,
          totalLateMinutes,
          totalEarlyMinutes,
          totalOvertimeMinutes
        },
        productionBreakdown: {
          branch: emp.branch,
          percentage: emp.productionPercentage,
          eligibleProductionAmount,
          ordersCount: productionOrders.length,
          orders: productionOrders
        }
      };

      const payroll = await prisma.monthlyPayroll.upsert({
        where: {
          employeeId_monthYear: { employeeId: emp.employeeId, monthYear }
        },
        update: {
          employeeName: emp.name,
          designation: emp.designation,
          department: emp.department,
          branch: emp.branch,
          basicSalary,
          workingDays,
          presentDays,
          absentDays,
          lateDays,
          halfDays,
          lateDeductions,
          earlyCheckoutDeductions,
          absentDeductions,
          overtimeHours,
          overtimeAmount,
          fuelAllowance,
          travelAllowance,
          otherAllowances,
          loanDeduction,
          advanceDeduction,
          otherDeductions,
          productionPercentage: emp.productionPercentage || 0,
          eligibleProductionAmount,
          productionEarning,
          manualAdjustment,
          adjustmentNote,
          grossSalary,
          totalDeductions,
          netPayable,
          calculationBreakdown: breakdown
        },
        create: {
          monthYear,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          designation: emp.designation,
          department: emp.department,
          branch: emp.branch,
          basicSalary,
          workingDays,
          presentDays,
          absentDays,
          lateDays,
          halfDays,
          lateDeductions,
          earlyCheckoutDeductions,
          absentDeductions,
          overtimeHours,
          overtimeAmount,
          fuelAllowance,
          travelAllowance,
          otherAllowances,
          loanDeduction,
          advanceDeduction,
          otherDeductions,
          productionPercentage: emp.productionPercentage || 0,
          eligibleProductionAmount,
          productionEarning,
          manualAdjustment,
          adjustmentNote,
          grossSalary,
          totalDeductions,
          netPayable,
          status: 'DRAFT',
          calculationBreakdown: breakdown
        }
      });

      calculatedPayrolls.push(payroll);
    }

    res.json({
      success: true,
      message: `Calculated payroll for ${calculatedPayrolls.length} employees`,
      monthYear,
      payrolls: calculatedPayrolls
    });
  } catch (err) {
    console.error('Error calculating payroll:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate payroll', error: err.message });
  }
};

// PUT /api/employees/payroll/:id/adjust
const adjustPayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.monthlyPayroll.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    if (existing.isFinalized) {
      return res.status(400).json({ success: false, message: 'Cannot edit finalized payroll record' });
    }

    const {
      basicSalary,
      lateDeductions,
      earlyCheckoutDeductions,
      absentDeductions,
      overtimeAmount,
      fuelAllowance,
      travelAllowance,
      otherAllowances,
      loanDeduction,
      advanceDeduction,
      otherDeductions,
      eligibleProductionAmount,
      productionEarning,
      manualAdjustment,
      adjustmentNote
    } = req.body;

    const bSalary = basicSalary !== undefined ? parseFloat(basicSalary) : existing.basicSalary;
    const lDed = lateDeductions !== undefined ? parseFloat(lateDeductions) : existing.lateDeductions;
    const eDed = earlyCheckoutDeductions !== undefined ? parseFloat(earlyCheckoutDeductions) : existing.earlyCheckoutDeductions;
    const aDed = absentDeductions !== undefined ? parseFloat(absentDeductions) : existing.absentDeductions;
    const otAmt = overtimeAmount !== undefined ? parseFloat(overtimeAmount) : existing.overtimeAmount;
    const fAllow = fuelAllowance !== undefined ? parseFloat(fuelAllowance) : existing.fuelAllowance;
    const tAllow = travelAllowance !== undefined ? parseFloat(travelAllowance) : existing.travelAllowance;
    const oAllow = otherAllowances !== undefined ? parseFloat(otherAllowances) : existing.otherAllowances;
    const loanDed = loanDeduction !== undefined ? parseFloat(loanDeduction) : existing.loanDeduction;
    const advDed = advanceDeduction !== undefined ? parseFloat(advanceDeduction) : existing.advanceDeduction;
    const othDed = otherDeductions !== undefined ? parseFloat(otherDeductions) : existing.otherDeductions;
    const prodEarn = productionEarning !== undefined ? parseFloat(productionEarning) : existing.productionEarning;
    const manAdj = manualAdjustment !== undefined ? parseFloat(manualAdjustment) : existing.manualAdjustment;

    const grossSalary = Math.round(bSalary + fAllow + tAllow + oAllow + otAmt + prodEarn);
    const totalDeductions = Math.round(lDed + eDed + aDed + loanDed + advDed + othDed);
    const netPayable = Math.max(0, Math.round(grossSalary - totalDeductions + manAdj));

    const updated = await prisma.monthlyPayroll.update({
      where: { id },
      data: {
        basicSalary: bSalary,
        lateDeductions: lDed,
        earlyCheckoutDeductions: eDed,
        absentDeductions: aDed,
        overtimeAmount: otAmt,
        fuelAllowance: fAllow,
        travelAllowance: tAllow,
        otherAllowances: oAllow,
        loanDeduction: loanDed,
        advanceDeduction: advDed,
        otherDeductions: othDed,
        ...(eligibleProductionAmount !== undefined ? { eligibleProductionAmount: parseFloat(eligibleProductionAmount) } : {}),
        productionEarning: prodEarn,
        manualAdjustment: manAdj,
        adjustmentNote: adjustmentNote !== undefined ? adjustmentNote : existing.adjustmentNote,
        grossSalary,
        totalDeductions,
        netPayable
      }
    });

    res.json({ success: true, message: 'Payroll adjusted successfully', payroll: updated });
  } catch (err) {
    console.error('Error adjusting payroll:', err);
    res.status(500).json({ success: false, message: 'Failed to adjust payroll', error: err.message });
  }
};

// POST /api/employees/payroll/finalize?monthYear=YYYY-MM
const finalizeMonthlyPayroll = async (req, res) => {
  try {
    const monthYear = req.body?.monthYear || req.query.monthYear;
    if (!monthYear) {
      return res.status(400).json({ success: false, message: 'monthYear is required' });
    }

    const updated = await prisma.monthlyPayroll.updateMany({
      where: {
        monthYear,
        isFinalized: false
      },
      data: {
        isFinalized: true,
        status: 'FINALIZED',
        finalizedAt: new Date(),
        finalizedBy: req.user?.name || 'Admin'
      }
    });

    res.json({
      success: true,
      message: `Finalized monthly payroll for ${monthYear} (${updated.count} records frozen)`,
      count: updated.count
    });
  } catch (err) {
    console.error('Error finalizing payroll:', err);
    res.status(500).json({ success: false, message: 'Failed to finalize payroll', error: err.message });
  }
};

// GET /api/employees/payroll/export-excel?monthYear=YYYY-MM
const exportPayrollExcel = async (req, res) => {
  try {
    const monthYear = req.query.monthYear || new Date().toISOString().slice(0, 7);

    const payrolls = await prisma.monthlyPayroll.findMany({
      where: { monthYear },
      include: { employee: true },
      orderBy: { employeeId: 'asc' }
    });

    const summaryRows = payrolls.map(p => ({
      'Employee ID': p.employeeId,
      'Employee Name': p.employeeName,
      'Department': p.department || 'N/A',
      'Branch': p.branch || 'N/A',
      'Basic Salary (PKR)': p.basicSalary,
      'Present Days': p.presentDays,
      'Absent Days': p.absentDays,
      'Late Days': p.lateDays,
      'Overtime Amount (PKR)': p.overtimeAmount,
      'Fuel Allowance (PKR)': p.fuelAllowance,
      'Travel Allowance (PKR)': p.travelAllowance,
      'Other Allowances (PKR)': p.otherAllowances,
      'Production Earning (PKR)': p.productionEarning,
      'Late Deduction (PKR)': p.lateDeductions,
      'Early Checkout Deduction (PKR)': p.earlyCheckoutDeductions,
      'Absent Deduction (PKR)': p.absentDeductions,
      'Loan/Advance Deduction (PKR)': p.loanDeduction + p.advanceDeduction,
      'Other Deductions (PKR)': p.otherDeductions,
      'Gross Salary (PKR)': p.grossSalary,
      'Total Deductions (PKR)': p.totalDeductions,
      'Manual Adjustment (PKR)': p.manualAdjustment,
      'Net Payable (PKR)': p.netPayable,
      'Status': p.status,
      'Adjustment Note': p.adjustmentNote || ''
    }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ Message: `No payroll records for ${monthYear}` }]);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Payroll_Summary');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="Payroll_${monthYear}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting payroll excel:', err);
    res.status(500).json({ success: false, message: 'Failed to export payroll excel', error: err.message });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getDailyAttendance,
  markAttendance,
  bulkMarkAttendance,
  getMonthlyAttendance,
  exportAttendanceExcel,
  getMonthlyPayrollList,
  calculateMonthlyPayroll,
  adjustPayroll,
  finalizeMonthlyPayroll,
  exportPayrollExcel
};
