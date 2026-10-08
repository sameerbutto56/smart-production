const prisma = require('../prisma');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const {
  parseTimeToMinutes,
  normalizeDateStr,
  calculateAttendanceMetrics
} = require('../utils/attendanceUtils');

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
        { designation: { contains: q, mode: 'insensitive' } },
        { loginEmail: { contains: q, mode: 'insensitive' } }
      ];
    }

    const employees = await prisma.employeeRecord.findMany({
      where,
      orderBy: { employeeId: 'asc' },
      select: {
        id: true,
        employeeId: true,
        name: true,
        fatherName: true,
        dateOfBirth: true,
        phone: true,
        email: true,
        cnic: true,
        address: true,
        designation: true,
        department: true,
        branch: true,
        joiningDate: true,
        monthlySalary: true,
        workingDays: true,
        workingHours: true,
        checkInTime: true,
        checkOutTime: true,
        breakTime: true,
        fuelAllowance: true,
        travelAllowance: true,
        otherAllowances: true,
        loan: true,
        advance: true,
        otherDeductions: true,
        productionEligible: true,
        productionPercentage: true,
        workType: true,
        allowedLeaves: true,
        status: true,
        notes: true,
        loginEmail: true,
        loginEnabled: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      }
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
        },
        leaves: {
          take: 12,
          orderBy: { startDate: 'desc' }
        },
        loansAndAdvances: {
          take: 12,
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const { passwordHash, ...safeEmployee } = employee;
    res.json({ success: true, employee: safeEmployee });
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
      address,
      designation,
      department,
      branch,
      joiningDate,
      monthlySalary,
      workingDays,
      workingHours,
      checkInTime,
      checkOutTime,
      breakTime,
      fuelAllowance,
      travelAllowance,
      otherAllowances,
      loan,
      advance,
      otherDeductions,
      productionEligible,
      productionPercentage,
      workType,
      allowedLeaves,
      status,
      notes,
      loginEmail,
      password,
      loginEnabled
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

    // Check unique loginEmail if provided
    let finalLoginEmail = loginEmail?.trim() || null;
    if (finalLoginEmail) {
      const existingEmail = await prisma.employeeRecord.findUnique({ where: { loginEmail: finalLoginEmail } });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: `Login email "${finalLoginEmail}" is already registered to another employee` });
      }
    }

    // Password hashing (default 'Enamel12312' if loginEnabled but no password provided)
    let passwordHash = null;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    } else if (loginEnabled) {
      passwordHash = await bcrypt.hash('Enamel12312', 10);
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
        address: address?.trim() || null,
        designation: designation?.trim() || null,
        department: department?.trim() || null,
        branch: branch?.trim() || null,
        joiningDate: joiningDate || null,
        monthlySalary: parseFloat(monthlySalary) || 0,
        workingDays: parseInt(workingDays, 10) || 30,
        workingHours: parseFloat(workingHours) || 8,
        checkInTime: checkInTime || '10:00',
        checkOutTime: checkOutTime || '18:00',
        breakTime: parseInt(breakTime, 10) || 60,
        fuelAllowance: parseFloat(fuelAllowance) || 0,
        travelAllowance: parseFloat(travelAllowance) || 0,
        otherAllowances: parseFloat(otherAllowances) || 0,
        loan: parseFloat(loan) || 0,
        advance: parseFloat(advance) || 0,
        otherDeductions: parseFloat(otherDeductions) || 0,
        productionEligible: Boolean(productionEligible) || (parseFloat(productionPercentage) > 0),
        productionPercentage: parseFloat(productionPercentage) || 0,
        workType: workType || 'STANDARD',
        allowedLeaves: parseFloat(allowedLeaves) || 2,
        status: status?.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        notes: notes?.trim() || null,
        loginEmail: finalLoginEmail,
        passwordHash,
        loginEnabled: Boolean(loginEnabled)
      }
    });

    const { passwordHash: _, ...safeEmployee } = employee;
    res.status(201).json({ success: true, message: 'Employee created successfully', employee: safeEmployee });
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
    if (data.workingDays !== undefined) data.workingDays = parseInt(data.workingDays, 10) || 30;
    if (data.workingHours !== undefined) data.workingHours = parseFloat(data.workingHours) || 8;
    if (data.breakTime !== undefined) data.breakTime = parseInt(data.breakTime, 10) || 60;
    if (data.fuelAllowance !== undefined) data.fuelAllowance = parseFloat(data.fuelAllowance) || 0;
    if (data.travelAllowance !== undefined) data.travelAllowance = parseFloat(data.travelAllowance) || 0;
    if (data.otherAllowances !== undefined) data.otherAllowances = parseFloat(data.otherAllowances) || 0;
    if (data.loan !== undefined) data.loan = parseFloat(data.loan) || 0;
    if (data.advance !== undefined) data.advance = parseFloat(data.advance) || 0;
    if (data.otherDeductions !== undefined) data.otherDeductions = parseFloat(data.otherDeductions) || 0;
    if (data.productionPercentage !== undefined) {
      data.productionPercentage = parseFloat(data.productionPercentage) || 0;
      if (data.productionPercentage > 0) data.productionEligible = true;
    }
    if (data.allowedLeaves !== undefined) data.allowedLeaves = parseFloat(data.allowedLeaves) || 2;
    if (data.status) data.status = data.status.toUpperCase();
    if (data.loginEnabled !== undefined) data.loginEnabled = Boolean(data.loginEnabled);

    // Login email update & uniqueness check
    if (data.loginEmail !== undefined) {
      const trimmedEmail = data.loginEmail?.trim() || null;
      if (trimmedEmail && trimmedEmail !== existing.loginEmail) {
        const emailCheck = await prisma.employeeRecord.findUnique({ where: { loginEmail: trimmedEmail } });
        if (emailCheck) {
          return res.status(400).json({ success: false, message: `Email "${trimmedEmail}" is already in use by another employee` });
        }
      }
      data.loginEmail = trimmedEmail;
    }

    // Password reset if provided
    if (data.password && data.password.trim()) {
      data.passwordHash = await bcrypt.hash(data.password.trim(), 10);
    }
    delete data.password;

    // Prevent changing employeeId or internal id in update payload
    delete data.employeeId;
    delete data.id;

    const updated = await prisma.employeeRecord.update({
      where: { employeeId },
      data
    });

    const { passwordHash: _, ...safeEmployee } = updated;
    res.json({ success: true, message: 'Employee updated successfully', employee: safeEmployee });
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

    // Soft delete: set status to INACTIVE and loginEnabled to false
    await prisma.employeeRecord.update({
      where: { employeeId },
      data: { status: 'INACTIVE', loginEnabled: false }
    });

    res.json({ success: true, message: `Employee ${employeeId} marked as INACTIVE and login disabled` });
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

    let finalStatus = status;
    if (status === 'PRESENT' && lateMinutes > 0) {
      finalStatus = 'LATE';
    }

    const existing = await prisma.employeeAttendance.findUnique({
      where: { employeeId_date: { employeeId, date } }
    });

    if (existing) {
      if (existing.checkInTime !== checkInTime) {
        await prisma.attendanceAuditLog.create({
          data: {
            employeeId,
            attendanceDate: date,
            fieldChanged: 'checkInTime',
            oldValue: existing.checkInTime || 'None',
            newValue: checkInTime || 'None',
            reason: notes || 'Admin Manual Edit',
            changedById: req.user?.id || null,
            changedByName: req.user?.name || 'Admin'
          }
        }).catch(() => {});
      }
      if (existing.checkOutTime !== checkOutTime) {
        await prisma.attendanceAuditLog.create({
          data: {
            employeeId,
            attendanceDate: date,
            fieldChanged: 'checkOutTime',
            oldValue: existing.checkOutTime || 'None',
            newValue: checkOutTime || 'None',
            reason: notes || 'Admin Manual Edit',
            changedById: req.user?.id || null,
            changedByName: req.user?.name || 'Admin'
          }
        }).catch(() => {});
      }
      if (existing.status !== finalStatus) {
        await prisma.attendanceAuditLog.create({
          data: {
            employeeId,
            attendanceDate: date,
            fieldChanged: 'status',
            oldValue: existing.status,
            newValue: finalStatus,
            reason: notes || 'Admin Manual Edit',
            changedById: req.user?.id || null,
            changedByName: req.user?.name || 'Admin'
          }
        }).catch(() => {});
      }
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

    try {
      const io = req?.app?.get('io');
      if (io) {
        io.emit('attendance:punched', { employeeId, date, status: finalStatus });
        io.emit('attendance:updated');
      }
    } catch (sErr) {}

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

// POST /api/employees/attendance/import-excel
const importAttendanceExcel = async (req, res) => {
  try {
    const { rows, monthYear, mode = 'update', fileName = 'attendance.xlsx', validateOnly = false } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'rows array is required' });
    }

    const errors = [];
    const validRowsToProcess = [];
    const seenEmpIdsInDate = new Set();
    const datesInUpload = new Set();

    // 1. Fetch active employees dictionary for fast lookup
    const allEmployees = await prisma.employeeRecord.findMany();
    const employeeMap = new Map(allEmployees.map(e => [e.employeeId, e]));

    // 2. Validate row by row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // considering header as row 1

      const empId = String(row['Employee ID'] || row['employeeId'] || row['EmployeeID'] || row['ID'] || '').trim();
      const rawDate = row['Date'] || row['date'] || null;
      const date = normalizeDateStr(rawDate);

      if (!empId) {
        errors.push(`Row ${rowNum}: Missing Employee ID`);
        continue;
      }
      if (!date) {
        errors.push(`Row ${rowNum} (${empId}): Invalid or missing date format (got "${rawDate}")`);
        continue;
      }

      // Check duplicates in uploaded batch
      const key = `${empId}_${date}`;
      if (seenEmpIdsInDate.has(key)) {
        errors.push(`Row ${rowNum}: Duplicate attendance record for Employee ID "${empId}" on date "${date}"`);
        continue;
      }
      seenEmpIdsInDate.add(key);

      // Validate Employee ID in database
      const employee = employeeMap.get(empId);
      if (!employee) {
        errors.push(`Row ${rowNum}: Unknown Employee ID "${empId}". Employee does not exist in directory.`);
        continue;
      }

      const checkIn = row['Check-in'] || row['CheckIn'] || row['checkInTime'] || null;
      const checkOut = row['Check-out'] || row['CheckOut'] || row['checkOutTime'] || null;

      // Check-out earlier than check-in validation
      const aInMin = parseTimeToMinutes(checkIn);
      const aOutMin = parseTimeToMinutes(checkOut);
      if (aInMin !== null && aOutMin !== null && aOutMin < aInMin) {
        errors.push(`Row ${rowNum} (${empId}): Invalid times: Check-out (${checkOut}) cannot be earlier than Check-in (${checkIn}) on ${date}`);
        continue;
      }

      datesInUpload.add(date);
      validRowsToProcess.push({ rowNum, empId, date, checkIn, checkOut, row, employee });
    }

    // If validation-only preview requested
    if (validateOnly) {
      return res.json({
        success: errors.length === 0,
        totalRows: rows.length,
        validRows: validRowsToProcess.length,
        errorsCount: errors.length,
        errors,
        previewDates: Array.from(datesInUpload).sort()
      });
    }

    // 3. If mode === 'replace', clean existing records for the month or dates
    if (mode === 'replace' && monthYear) {
      await prisma.employeeAttendance.deleteMany({
        where: { date: { startsWith: monthYear } }
      });
    }

    const importedRecords = [];

    // 4. Process all valid rows from Excel
    for (const item of validRowsToProcess) {
      const { empId, date, checkIn, checkOut, row, employee } = item;
      const statusRaw = String(row['Attendance Status'] || row['Status'] || row['status'] || '').toUpperCase().trim();

      // Check incomplete attendance case (Point 18): one time missing
      let status = 'PRESENT';
      if (['PRESENT', 'LATE', 'HALF_DAY', 'LEAVE', 'ABSENT'].includes(statusRaw)) {
        status = statusRaw;
      } else if ((checkIn && !checkOut) || (!checkIn && checkOut)) {
        status = 'INCOMPLETE';
      }

      const sIn = employee.checkInTime || '10:00';
      const sOut = employee.checkOutTime || '18:00';

      const { lateMinutes, earlyMinutes, overtimeMinutes, workingHours } = calculateAttendanceMetrics(
        sIn,
        sOut,
        checkIn,
        checkOut,
        status
      );

      let finalStatus = status;
      if (status === 'PRESENT' && lateMinutes > 0) finalStatus = 'LATE';

      let note = row['Notes'] || row['notes'] || null;
      if (status === 'INCOMPLETE' && !note) {
        note = 'Incomplete Attendance — Missing check-in or check-out (Review Required)';
      }

      const rec = await prisma.employeeAttendance.upsert({
        where: { employeeId_date: { employeeId: empId, date } },
        update: {
          employeeName: employee.name,
          checkInTime: checkIn ? String(checkIn).trim() : null,
          checkOutTime: checkOut ? String(checkOut).trim() : null,
          scheduledCheckIn: sIn,
          scheduledCheckOut: sOut,
          lateMinutes,
          earlyMinutes,
          overtimeMinutes,
          status: finalStatus,
          workingHours,
          notes: note
        },
        create: {
          employeeId: empId,
          employeeName: employee.name,
          date,
          checkInTime: checkIn ? String(checkIn).trim() : null,
          checkOutTime: checkOut ? String(checkOut).trim() : null,
          scheduledCheckIn: sIn,
          scheduledCheckOut: sOut,
          lateMinutes,
          earlyMinutes,
          overtimeMinutes,
          status: finalStatus,
          workingHours,
          notes: note
        }
      });

      importedRecords.push(rec);
    }

    // 5. AUTOMATIC ABSENCE DETECTION (Points 15-17, 50-51)
    // Reconcile All Active Employees against Excel uploaded dates
    let autoAbsentCount = 0;
    const activeEmployees = allEmployees.filter(e => e.status === 'ACTIVE');
    const uploadDates = Array.from(datesInUpload);

    if (uploadDates.length > 0) {
      const minDate = uploadDates.reduce((min, d) => d < min ? d : min, uploadDates[0]);
      const maxDate = uploadDates.reduce((max, d) => d > max ? d : max, uploadDates[0]);

      // Fetch approved leaves covering this date range
      const approvedLeaves = await prisma.employeeLeave.findMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: maxDate },
          endDate: { gte: minDate }
        }
      });

      for (const emp of activeEmployees) {
        for (const date of uploadDates) {
          const key = `${emp.employeeId}_${date}`;
          if (!seenEmpIdsInDate.has(key)) {
            // Check Priority 1: Weekly Off / Sunday
            const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
            if (dayOfWeek === 0) {
              await prisma.employeeAttendance.upsert({
                where: { employeeId_date: { employeeId: emp.employeeId, date } },
                update: {},
                create: {
                  employeeId: emp.employeeId,
                  employeeName: emp.name,
                  date,
                  scheduledCheckIn: emp.checkInTime || '10:00',
                  scheduledCheckOut: emp.checkOutTime || '18:00',
                  status: 'WEEKLY_OFF',
                  workingHours: 0,
                  notes: 'Weekly Off / Non-Working Day'
                }
              });
              continue;
            }

            // Check Priority 2: Approved Leave
            const onLeave = approvedLeaves.find(l => l.employeeId === emp.employeeId && l.startDate <= date && l.endDate >= date);
            if (onLeave) {
              await prisma.employeeAttendance.upsert({
                where: { employeeId_date: { employeeId: emp.employeeId, date } },
                update: {},
                create: {
                  employeeId: emp.employeeId,
                  employeeName: emp.name,
                  date,
                  scheduledCheckIn: emp.checkInTime || '10:00',
                  scheduledCheckOut: emp.checkOutTime || '18:00',
                  status: 'LEAVE',
                  workingHours: 0,
                  notes: `Approved ${onLeave.leaveType} Leave`
                }
              });
              continue;
            }

            // Priority 3: Mark ABSENT
            await prisma.employeeAttendance.upsert({
              where: { employeeId_date: { employeeId: emp.employeeId, date } },
              update: {},
              create: {
                employeeId: emp.employeeId,
                employeeName: emp.name,
                date,
                scheduledCheckIn: emp.checkInTime || '10:00',
                scheduledCheckOut: emp.checkOutTime || '18:00',
                lateMinutes: 0,
                earlyMinutes: 0,
                overtimeMinutes: 0,
                status: 'ABSENT',
                workingHours: 0,
                notes: 'Automatically marked Absent (Missing from Attendance Excel)'
              }
            });
            autoAbsentCount++;
          }
        }
      }
    }

    // 6. Record in AttendanceImportHistory (Point 41)
    try {
      const derivedMonth = monthYear || (uploadDates[0] ? uploadDates[0].slice(0, 7) : new Date().toISOString().slice(0, 7));
      await prisma.attendanceImportHistory.create({
        data: {
          fileName: String(fileName || 'attendance.xlsx'),
          monthYear: derivedMonth,
          uploadedBy: req.user?.name || 'Admin',
          totalRows: rows.length,
          successfulRows: importedRecords.length,
          failedRows: errors.length,
          absentCount: autoAbsentCount,
          status: errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
          errorsList: errors.length > 0 ? JSON.stringify(errors.slice(0, 50)) : null
        }
      });
    } catch (histErr) {
      console.warn('Could not save import history record:', histErr.message);
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedRecords.length} records. Auto-reconciled ${autoAbsentCount} absent records for active staff.`,
      totalRows: rows.length,
      importedCount: importedRecords.length,
      autoAbsentCount,
      errorsCount: errors.length,
      errors
    });
  } catch (err) {
    console.error('Error importing attendance excel:', err);
    res.status(500).json({ success: false, message: 'Failed to import attendance excel', error: err.message });
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

// GET /api/employees/attendance/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&employeeId=...&branch=...
const getAttendanceRange = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, branch } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required (YYYY-MM-DD)' });
    }

    const empWhere = { status: 'ACTIVE' };
    if (employeeId && employeeId !== 'ALL') {
      empWhere.employeeId = employeeId;
    }
    if (branch && branch !== 'ALL') {
      empWhere.branch = { contains: branch, mode: 'insensitive' };
    }

    const employees = await prisma.employeeRecord.findMany({
      where: empWhere,
      orderBy: { employeeId: 'asc' }
    });

    // Query all attendance records in this date range
    const attendances = await prisma.employeeAttendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(employeeId && employeeId !== 'ALL' ? { employeeId } : {})
      },
      orderBy: { date: 'asc' }
    });

    // Query approved leaves in date range
    const leaves = await prisma.employeeLeave.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });

    const attMap = new Map();
    attendances.forEach(a => {
      const key = `${a.employeeId}_${a.date}`;
      attMap.set(key, a);
    });

    // Generate date array
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateList = [];
    let cur = new Date(start);
    while (cur <= end) {
      dateList.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const records = [];
    let summaryPresent = 0;
    let summaryAbsent = 0;
    let summaryLeaves = 0;
    let summaryLates = 0;
    let summaryTotalLateMinutes = 0;
    let summaryEarlyCheckouts = 0;
    let summaryTotalEarlyMinutes = 0;
    let summaryWorkedHours = 0;
    let summaryOvertimeMinutes = 0;

    for (const emp of employees) {
      for (const d of dateList) {
        const key = `${emp.employeeId}_${d}`;
        const att = attMap.get(key);

        if (att) {
          records.push({
            ...att,
            branch: emp.branch,
            department: emp.department,
            designation: emp.designation,
            monthlySalary: emp.monthlySalary
          });

          if (['PRESENT', 'LATE', 'HALF_DAY'].includes(att.status)) {
            summaryPresent++;
          } else if (att.status === 'LEAVE') {
            summaryLeaves++;
          } else if (att.status === 'ABSENT') {
            summaryAbsent++;
          }

          if (att.lateMinutes > 0) {
            summaryLates++;
            summaryTotalLateMinutes += att.lateMinutes;
          }
          if (att.earlyMinutes > 0) {
            summaryEarlyCheckouts++;
            summaryTotalEarlyMinutes += att.earlyMinutes;
          }
          summaryWorkedHours += (att.workingHours || 0);
          summaryOvertimeMinutes += (att.overtimeMinutes || 0);
        } else {
          // Check if employee had approved leave on this date
          const onLeave = leaves.find(l => l.employeeId === emp.employeeId && l.startDate <= d && l.endDate >= d);
          const autoStatus = onLeave ? 'LEAVE' : 'ABSENT';

          if (autoStatus === 'LEAVE') summaryLeaves++;
          else summaryAbsent++;

          records.push({
            id: null,
            employeeId: emp.employeeId,
            employeeName: emp.name,
            branch: emp.branch,
            department: emp.department,
            designation: emp.designation,
            date: d,
            checkInTime: null,
            checkOutTime: null,
            scheduledCheckIn: emp.checkInTime || '10:00',
            scheduledCheckOut: emp.checkOutTime || '18:00',
            lateMinutes: 0,
            earlyMinutes: 0,
            overtimeMinutes: 0,
            status: autoStatus,
            workingHours: 0,
            monthlySalary: emp.monthlySalary,
            notes: onLeave ? `Approved ${onLeave.leaveType} Leave` : 'Automatically marked Absent'
          });
        }
      }
    }

    const totalWorkingSlots = employees.length * dateList.length;
    const attPercentage = totalWorkingSlots > 0 ? Math.round((summaryPresent / totalWorkingSlots) * 100) : 0;

    res.json({
      success: true,
      startDate,
      endDate,
      totalDays: dateList.length,
      employeesCount: employees.length,
      count: records.length,
      summary: {
        totalWorkingDays: totalWorkingSlots,
        present: summaryPresent,
        absent: summaryAbsent,
        leaves: summaryLeaves,
        lateOccurrences: summaryLates,
        totalLateMinutes: summaryTotalLateMinutes,
        earlyCheckouts: summaryEarlyCheckouts,
        totalEarlyMinutes: summaryTotalEarlyMinutes,
        totalWorkedHours: Math.round(summaryWorkedHours * 10) / 10,
        totalOvertimeMinutes: summaryOvertimeMinutes,
        totalOvertimeHours: Math.round((summaryOvertimeMinutes / 60) * 10) / 10,
        attendancePercentage: attPercentage
      },
      records
    });
  } catch (err) {
    console.error('Error fetching attendance range:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance range', error: err.message });
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

// GET /api/employees/attendance/import-history
const getAttendanceImportHistory = async (req, res) => {
  try {
    const history = await prisma.attendanceImportHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({ success: true, count: history.length, history });
  } catch (err) {
    console.error('Error fetching attendance import history:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch import history', error: err.message });
  }
};

// ==========================================
// 3. LEAVES MANAGEMENT
// ==========================================

// GET /api/employees/leaves
const getLeaves = async (req, res) => {
  try {
    const { employeeId, status, monthYear } = req.query;
    const where = {};
    if (employeeId && employeeId !== 'ALL') where.employeeId = employeeId;
    if (status && status !== 'ALL') where.status = status.toUpperCase();
    if (monthYear) where.startDate = { startsWith: monthYear };

    const leaves = await prisma.employeeLeave.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: { employee: true }
    });

    res.json({ success: true, count: leaves.length, leaves });
  } catch (err) {
    console.error('Error fetching leaves:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch leaves', error: err.message });
  }
};

// POST /api/employees/leaves
const createLeave = async (req, res) => {
  try {
    const { employeeId, leaveType = 'CASUAL', startDate, endDate, daysCount, reason, status = 'APPROVED' } = req.body;
    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'employeeId, startDate, and endDate are required' });
    }

    const employee = await prisma.employeeRecord.findUnique({ where: { employeeId } });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const leave = await prisma.employeeLeave.create({
      data: {
        employeeId,
        employeeName: employee.name,
        leaveType,
        startDate,
        endDate,
        daysCount: parseFloat(daysCount) || 1,
        reason: reason?.trim() || null,
        status: status.toUpperCase(),
        approvedBy: req.user?.name || 'Admin',
        approvedAt: status.toUpperCase() === 'APPROVED' ? new Date() : null
      }
    });

    res.status(201).json({ success: true, message: 'Leave recorded successfully', leave });
  } catch (err) {
    console.error('Error creating leave:', err);
    res.status(500).json({ success: false, message: 'Failed to create leave', error: err.message });
  }
};

// PUT /api/employees/leaves/:id/status
const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status is required' });

    const leave = await prisma.employeeLeave.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
        approvedBy: req.user?.name || 'Admin',
        approvedAt: status.toUpperCase() === 'APPROVED' ? new Date() : null
      }
    });

    res.json({ success: true, message: `Leave status updated to ${status}`, leave });
  } catch (err) {
    console.error('Error updating leave status:', err);
    res.status(500).json({ success: false, message: 'Failed to update leave', error: err.message });
  }
};

// ==========================================
// 4. LOAN & ADVANCE MANAGEMENT
// ==========================================

// GET /api/employees/loans
const getLoans = async (req, res) => {
  try {
    const { employeeId, status, type } = req.query;
    const where = {};
    if (employeeId && employeeId !== 'ALL') where.employeeId = employeeId;
    if (status && status !== 'ALL') where.status = status.toUpperCase();
    if (type && type !== 'ALL') where.type = type.toUpperCase();

    const records = await prisma.employeeLoanAdvance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { employee: true }
    });

    res.json({ success: true, count: records.length, records });
  } catch (err) {
    console.error('Error fetching loans:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch loans', error: err.message });
  }
};

// POST /api/employees/loans
const createLoan = async (req, res) => {
  try {
    const { employeeId, type = 'LOAN', amount, monthlyDeduction, date, notes } = req.body;
    if (!employeeId || !amount) {
      return res.status(400).json({ success: false, message: 'employeeId and amount are required' });
    }

    const employee = await prisma.employeeRecord.findUnique({ where: { employeeId } });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const amt = parseFloat(amount) || 0;
    const mDed = parseFloat(monthlyDeduction) || 0;
    const recDate = date || new Date().toISOString().slice(0, 10);

    const record = await prisma.employeeLoanAdvance.create({
      data: {
        employeeId,
        employeeName: employee.name,
        type: type.toUpperCase(),
        amount: amt,
        monthlyDeduction: mDed,
        remainingBalance: amt,
        date: recDate,
        status: 'ACTIVE',
        notes: notes?.trim() || null
      }
    });

    // Update employee profile summary balance
    if (type.toUpperCase() === 'LOAN') {
      await prisma.employeeRecord.update({
        where: { employeeId },
        data: { loan: { increment: amt } }
      });
    } else {
      await prisma.employeeRecord.update({
        where: { employeeId },
        data: { advance: { increment: amt } }
      });
    }

    res.status(201).json({ success: true, message: `${type} record created`, record });
  } catch (err) {
    console.error('Error creating loan:', err);
    res.status(500).json({ success: false, message: 'Failed to create loan', error: err.message });
  }
};

// PUT /api/employees/loans/:id
const updateLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, monthlyDeduction, remainingBalance, notes } = req.body;

    const data = {};
    if (status) data.status = status.toUpperCase();
    if (monthlyDeduction !== undefined) data.monthlyDeduction = parseFloat(monthlyDeduction) || 0;
    if (remainingBalance !== undefined) data.remainingBalance = parseFloat(remainingBalance) || 0;
    if (notes !== undefined) data.notes = notes;

    const record = await prisma.employeeLoanAdvance.update({
      where: { id },
      data
    });

    res.json({ success: true, message: 'Loan record updated', record });
  } catch (err) {
    console.error('Error updating loan:', err);
    res.status(500).json({ success: false, message: 'Failed to update loan', error: err.message });
  }
};

// ==========================================
// 5. PRODUCTION & ENGRAVING EARNING LOOKUP
// ==========================================

async function getEligibleProductionAmount(branch, monthYear, workType = 'ENGRAVING') {
  if (!branch) return { amount: 0, count: 0, orders: [] };

  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  try {
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
      // Per spec 25: Count actual engraving work (logoCharges + namePrintingCharges).
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

// GET /api/employees/production/summary?monthYear=YYYY-MM
const getProductionSummary = async (req, res) => {
  try {
    const monthYear = req.query.monthYear || new Date().toISOString().slice(0, 7);

    const eligibleEmployees = await prisma.employeeRecord.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { productionEligible: true },
          { productionPercentage: { gt: 0 } }
        ]
      }
    });

    const results = [];
    for (const emp of eligibleEmployees) {
      const prodData = await getEligibleProductionAmount(emp.branch, monthYear, emp.workType);
      const incentive = Math.round((prodData.amount * (emp.productionPercentage || 0)) / 100);
      results.push({
        employeeId: emp.employeeId,
        name: emp.name,
        branch: emp.branch,
        workType: emp.workType,
        percentage: emp.productionPercentage,
        ordersCount: prodData.count,
        totalEligibleAmount: prodData.amount,
        incentiveAmount: incentive,
        orders: prodData.orders
      });
    }

    res.json({ success: true, monthYear, count: results.length, employees: results });
  } catch (err) {
    console.error('Error fetching production summary:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch production summary', error: err.message });
  }
};

// ==========================================
// 6. PAYROLL CALCULATION & LIFECYCLE
// ==========================================

// GET /api/employees/payroll/list?monthYear=YYYY-MM&status=STATUS&branch=BRANCH&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
const getMonthlyPayrollList = async (req, res) => {
  try {
    const { monthYear, branch, status, startDate, endDate } = req.query;

    const where = {};
    if (monthYear && monthYear !== 'ALL') {
      where.monthYear = monthYear;
    } else if (startDate && endDate) {
      where.OR = [
        { startDate: { gte: startDate, lte: endDate } },
        { monthYear: { startsWith: startDate.slice(0, 7) } }
      ];
    } else if (!status && !branch) {
      where.monthYear = new Date().toISOString().slice(0, 7);
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (branch && branch !== 'ALL') {
      where.branch = { contains: branch, mode: 'insensitive' };
    }

    const payrolls = await prisma.monthlyPayroll.findMany({
      where,
      include: { employee: true },
      orderBy: [{ monthYear: 'desc' }, { employeeId: 'asc' }]
    });

    res.json({ success: true, monthYear: where.monthYear || 'ALL', count: payrolls.length, payrolls });
  } catch (err) {
    console.error('Error fetching payrolls:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll list', error: err.message });
  }
};

// POST /api/employees/payroll/calculate?monthYear=YYYY-MM or { startDate, endDate, branch }
const calculateMonthlyPayroll = async (req, res) => {
  try {
    const startDate = req.body?.startDate || req.query.startDate;
    const endDate = req.body?.endDate || req.query.endDate;
    let monthYear = req.body?.monthYear || req.query.monthYear;
    const branch = req.body?.branch || req.query.branch;
    const employeeIdFilter = req.body?.employeeId;
    const recalculateDraft = req.body?.recalculate === true || req.body?.recalculate === 'true';

    if (!monthYear) {
      if (startDate) monthYear = startDate.slice(0, 7);
      else monthYear = new Date().toISOString().slice(0, 7);
    }

    const empWhere = { status: 'ACTIVE' };
    if (employeeIdFilter) empWhere.employeeId = employeeIdFilter;
    if (branch && branch !== 'ALL') {
      empWhere.branch = { contains: branch, mode: 'insensitive' };
    }

    const employees = await prisma.employeeRecord.findMany({
      where: empWhere,
      orderBy: { employeeId: 'asc' }
    });

    const attWhere = {};
    if (startDate && endDate) {
      attWhere.date = { gte: startDate, lte: endDate };
    } else {
      attWhere.date = { startsWith: monthYear };
    }

    const attendances = await prisma.employeeAttendance.findMany({
      where: attWhere
    });

    const attByEmp = new Map();
    attendances.forEach(a => {
      if (!attByEmp.has(a.employeeId)) attByEmp.set(a.employeeId, []);
      attByEmp.get(a.employeeId).push(a);
    });

    // Query active loans and advances
    const activeLoansAndAdvances = await prisma.employeeLoanAdvance.findMany({
      where: { status: 'ACTIVE' }
    });
    const loansByEmp = new Map();
    activeLoansAndAdvances.forEach(r => {
      if (!loansByEmp.has(r.employeeId)) loansByEmp.set(r.employeeId, []);
      loansByEmp.get(r.employeeId).push(r);
    });

    const calculatedPayrolls = [];
    const skippedPayrolls = [];

    for (const emp of employees) {
      // Check if existing payroll is APPROVED or PAID or FINALIZED — preserved historical snapshot! (Section 25, 31, 42)
      const existing = await prisma.monthlyPayroll.findUnique({
        where: { employeeId_monthYear: { employeeId: emp.employeeId, monthYear } }
      });

      if (existing) {
        if (existing.isFinalized || existing.status === 'PAID' || existing.status === 'PENDING_PAYMENT') {
          skippedPayrolls.push({ employeeId: emp.employeeId, reason: `Payroll is ${existing.status} (historical snapshot protected)` });
          calculatedPayrolls.push(existing);
          continue;
        }
      }

      const records = attByEmp.get(emp.employeeId) || [];
      const presentDays = records.filter(r => ['PRESENT', 'LATE'].includes(r.status)).length;
      const absentDays = records.filter(r => r.status === 'ABSENT').length;
      const lateDays = records.filter(r => r.lateMinutes > 0).length;
      const halfDays = records.filter(r => r.status === 'HALF_DAY').length;

      // Three-Late Rule (Section 11): 3 Late Occurrences = 1 Day Salary Deduction
      const lateDeductionDays = Math.floor(lateDays / 3);
      const perDaySalary = Math.round((emp.monthlySalary || 0) / (emp.workingDays || 30));
      const lateDeductions = lateDeductionDays * perDaySalary;

      // Absent deductions
      const absentDeductions = absentDays * perDaySalary;

      // Early checkout deductions
      const totalEarlyMinutes = records.reduce((sum, r) => sum + (r.earlyMinutes || 0), 0);
      const perMinuteSalary = perDaySalary / ((emp.workingHours || 8) * 60);
      const earlyCheckoutDeductions = Math.round(totalEarlyMinutes * perMinuteSalary);

      // Overtime
      const totalOvertimeMinutes = records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
      const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10;
      const hourlyRate = (emp.monthlySalary || 0) / ((emp.workingDays || 30) * (emp.workingHours || 8));
      const overtimeAmount = Math.round(overtimeHours * hourlyRate);

      // Loan & Advance Deductions from active records
      const empLoanRecs = loansByEmp.get(emp.employeeId) || [];
      const loanDeduction = empLoanRecs
        .filter(r => r.type === 'LOAN')
        .reduce((sum, r) => sum + Math.min(r.monthlyDeduction || 0, r.remainingBalance || 0), 0) || (emp.loan ? Math.min(emp.loan, 2000) : 0);

      const advanceDeduction = empLoanRecs
        .filter(r => r.type === 'ADVANCE')
        .reduce((sum, r) => sum + Math.min(r.monthlyDeduction || 0, r.remainingBalance || 0), 0) || (emp.advance || 0);

      // Allowances
      const fuelAllowance = emp.fuelAllowance || 0;
      const travelAllowance = emp.travelAllowance || 0;
      const otherAllowances = emp.otherAllowances || 0;
      const fullAttendanceBonus = existing?.fullAttendanceBonus || 0;
      const reimbursement = existing?.reimbursement || 0;
      const otherDeductions = emp.otherDeductions || 0;

      // Production / Engraving Incentive
      let eligibleProductionAmount = 0;
      let productionEarning = 0;
      if (emp.productionEligible || emp.productionPercentage > 0) {
        const prodData = await getEligibleProductionAmount(emp.branch, monthYear, emp.workType);
        eligibleProductionAmount = prodData.amount;
        productionEarning = Math.round((eligibleProductionAmount * (emp.productionPercentage || 0)) / 100);
      }

      const manualAdjustment = existing?.manualAdjustment || 0;
      const adjustmentNote = existing?.adjustmentNote || null;

      // Final calculations (Section 22)
      const grossSalary = Math.round(
        (emp.monthlySalary || 0) +
        overtimeAmount +
        fuelAllowance +
        travelAllowance +
        otherAllowances +
        fullAttendanceBonus +
        reimbursement +
        productionEarning
      );

      const totalDeductions = Math.round(
        lateDeductions +
        absentDeductions +
        earlyCheckoutDeductions +
        loanDeduction +
        advanceDeduction +
        otherDeductions
      );

      const netPayable = Math.max(0, Math.round(grossSalary - totalDeductions + manualAdjustment));

      const breakdown = {
        startDate: startDate || `${monthYear}-01`,
        endDate: endDate || `${monthYear}-30`,
        attendanceSummary: {
          presentDays,
          absentDays,
          lateDays,
          halfDays,
          lateDeductionDays,
          totalEarlyMinutes,
          totalOvertimeMinutes,
          overtimeHours
        },
        formula: {
          perDaySalary,
          hourlyRate: Math.round(hourlyRate),
          threeLatePenaltyDays: lateDeductionDays,
          threeLateDeduction: lateDeductions
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
          basicSalary: emp.monthlySalary,
          workingDays: emp.workingDays || 30,
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
          fullAttendanceBonus,
          reimbursement,
          loanDeduction,
          advanceDeduction,
          otherDeductions,
          productionPercentage: emp.productionPercentage,
          eligibleProductionAmount,
          productionEarning,
          manualAdjustment,
          adjustmentNote,
          grossSalary,
          totalDeductions,
          netPayable,
          startDate: startDate || `${monthYear}-01`,
          endDate: endDate || `${monthYear}-30`,
          status: existing?.status || 'DRAFT',
          calculationBreakdown: breakdown
        },
        create: {
          monthYear,
          startDate: startDate || `${monthYear}-01`,
          endDate: endDate || `${monthYear}-30`,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          designation: emp.designation,
          department: emp.department,
          branch: emp.branch,
          basicSalary: emp.monthlySalary,
          workingDays: emp.workingDays || 30,
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
          fullAttendanceBonus,
          reimbursement,
          loanDeduction,
          advanceDeduction,
          otherDeductions,
          productionPercentage: emp.productionPercentage,
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
      startDate: startDate || `${monthYear}-01`,
      endDate: endDate || `${monthYear}-30`,
      payrolls: calculatedPayrolls,
      skipped: skippedPayrolls
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

    if (existing.isFinalized || existing.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Cannot edit finalized or paid payroll record' });
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
      fullAttendanceBonus,
      reimbursement,
      loanDeduction,
      advanceDeduction,
      otherDeductions,
      eligibleProductionAmount,
      productionEarning,
      manualAdjustment,
      adjustmentNote,
      status
    } = req.body;

    const bSalary = basicSalary !== undefined ? parseFloat(basicSalary) : existing.basicSalary;
    const lDed = lateDeductions !== undefined ? parseFloat(lateDeductions) : existing.lateDeductions;
    const eDed = earlyCheckoutDeductions !== undefined ? parseFloat(earlyCheckoutDeductions) : existing.earlyCheckoutDeductions;
    const aDed = absentDeductions !== undefined ? parseFloat(absentDeductions) : existing.absentDeductions;
    const otAmt = overtimeAmount !== undefined ? parseFloat(overtimeAmount) : existing.overtimeAmount;
    const fAllow = fuelAllowance !== undefined ? parseFloat(fuelAllowance) : existing.fuelAllowance;
    const tAllow = travelAllowance !== undefined ? parseFloat(travelAllowance) : existing.travelAllowance;
    const oAllow = otherAllowances !== undefined ? parseFloat(otherAllowances) : existing.otherAllowances;
    const fullAttBonus = fullAttendanceBonus !== undefined ? parseFloat(fullAttendanceBonus) : (existing.fullAttendanceBonus || 0);
    const reimb = reimbursement !== undefined ? parseFloat(reimbursement) : (existing.reimbursement || 0);
    const loanDed = loanDeduction !== undefined ? parseFloat(loanDeduction) : existing.loanDeduction;
    const advDed = advanceDeduction !== undefined ? parseFloat(advanceDeduction) : existing.advanceDeduction;
    const othDed = otherDeductions !== undefined ? parseFloat(otherDeductions) : existing.otherDeductions;
    const prodEarn = productionEarning !== undefined ? parseFloat(productionEarning) : existing.productionEarning;
    const manAdj = manualAdjustment !== undefined ? parseFloat(manualAdjustment) : existing.manualAdjustment;

    // Record audit trail entries (Section 23, 40)
    const auditLogs = [];
    if (manAdj !== existing.manualAdjustment) {
      auditLogs.push({ field: 'manualAdjustment', oldVal: existing.manualAdjustment, newVal: manAdj });
    }
    if (fullAttBonus !== (existing.fullAttendanceBonus || 0)) {
      auditLogs.push({ field: 'fullAttendanceBonus', oldVal: existing.fullAttendanceBonus || 0, newVal: fullAttBonus });
    }
    if (reimb !== (existing.reimbursement || 0)) {
      auditLogs.push({ field: 'reimbursement', oldVal: existing.reimbursement || 0, newVal: reimb });
    }
    if (fAllow !== existing.fuelAllowance) {
      auditLogs.push({ field: 'fuelAllowance', oldVal: existing.fuelAllowance, newVal: fAllow });
    }
    if (lDed !== existing.lateDeductions) {
      auditLogs.push({ field: 'lateDeductions', oldVal: existing.lateDeductions, newVal: lDed });
    }
    if (aDed !== existing.absentDeductions) {
      auditLogs.push({ field: 'absentDeductions', oldVal: existing.absentDeductions, newVal: aDed });
    }

    for (const log of auditLogs) {
      await prisma.payrollAuditLog.create({
        data: {
          payrollId: existing.id,
          employeeId: existing.employeeId,
          period: existing.monthYear,
          fieldChanged: log.field,
          oldValue: String(log.oldVal),
          newValue: String(log.newVal),
          reason: adjustmentNote || 'Admin adjustment',
          changedById: req.user?.id || null,
          changedByName: req.user?.name || 'Admin'
        }
      }).catch(() => {});
    }

    const grossSalary = Math.round(bSalary + fAllow + tAllow + oAllow + otAmt + fullAttBonus + reimb + prodEarn);
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
        fullAttendanceBonus: fullAttBonus,
        reimbursement: reimb,
        loanDeduction: loanDed,
        advanceDeduction: advDed,
        otherDeductions: othDed,
        ...(eligibleProductionAmount !== undefined ? { eligibleProductionAmount: parseFloat(eligibleProductionAmount) } : {}),
        productionEarning: prodEarn,
        manualAdjustment: manAdj,
        adjustmentNote: adjustmentNote !== undefined ? adjustmentNote : existing.adjustmentNote,
        grossSalary,
        totalDeductions,
        netPayable,
        status: status ? status.toUpperCase() : existing.status
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

    // 1. Freeze all payroll records for monthYear
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

    // 2. Automatically update remaining balance of active loans/advances
    const payrolls = await prisma.monthlyPayroll.findMany({
      where: { monthYear }
    });

    for (const p of payrolls) {
      if (p.loanDeduction > 0) {
        const activeLoans = await prisma.employeeLoanAdvance.findMany({
          where: { employeeId: p.employeeId, type: 'LOAN', status: 'ACTIVE' }
        });
        for (const al of activeLoans) {
          const newBal = Math.max(0, al.remainingBalance - p.loanDeduction);
          await prisma.employeeLoanAdvance.update({
            where: { id: al.id },
            data: {
              remainingBalance: newBal,
              status: newBal === 0 ? 'COMPLETED' : 'ACTIVE'
            }
          });
        }
      }

      if (p.advanceDeduction > 0) {
        const activeAdvances = await prisma.employeeLoanAdvance.findMany({
          where: { employeeId: p.employeeId, type: 'ADVANCE', status: 'ACTIVE' }
        });
        for (const aa of activeAdvances) {
          const newBal = Math.max(0, aa.remainingBalance - p.advanceDeduction);
          await prisma.employeeLoanAdvance.update({
            where: { id: aa.id },
            data: {
              remainingBalance: newBal,
              status: newBal === 0 ? 'COMPLETED' : 'ACTIVE'
            }
          });
        }
      }
    }

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

// POST /api/employees/payroll/approve
// Moves payroll from DRAFT / UNDER_REVIEW to PENDING_PAYMENT (Section 25)
const approvePayrolls = async (req, res) => {
  try {
    const { payrollIds, monthYear } = req.body;
    const where = {};
    if (Array.isArray(payrollIds) && payrollIds.length > 0) {
      where.id = { in: payrollIds };
    } else if (monthYear) {
      where.monthYear = monthYear;
    } else {
      return res.status(400).json({ success: false, message: 'payrollIds or monthYear is required' });
    }

    where.status = { in: ['DRAFT', 'UNDER_REVIEW'] };

    const result = await prisma.monthlyPayroll.updateMany({
      where,
      data: {
        status: 'PENDING_PAYMENT',
        approvedAt: new Date(),
        approvedBy: req.user?.name || 'Admin'
      }
    });

    const io = req?.app?.get('io');
    if (io) {
      io.emit('payroll:updated');
    }

    res.json({
      success: true,
      message: `Approved ${result.count} payroll(s). Moved to Pending Payment.`,
      count: result.count
    });
  } catch (err) {
    console.error('Error approving payroll:', err);
    res.status(500).json({ success: false, message: 'Failed to approve payroll', error: err.message });
  }
};

// POST /api/employees/payroll/:id/approve
const approveSinglePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.monthlyPayroll.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }

    const updated = await prisma.monthlyPayroll.update({
      where: { id },
      data: {
        status: 'PENDING_PAYMENT',
        approvedAt: new Date(),
        approvedBy: req.user?.name || 'Admin'
      }
    });

    const io = req?.app?.get('io');
    if (io) io.emit('payroll:updated');

    res.json({ success: true, message: `Payroll approved for ${existing.employeeName}`, payroll: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve payroll', error: err.message });
  }
};

// POST /api/employees/payroll/:id/mark-paid
// Moves payroll from PENDING_PAYMENT to PAID, records payment metadata, and auto-settles loans (Section 27)
const markPayrollPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate, paymentMethod = 'BANK_TRANSFER', paymentReference, paymentNotes } = req.body;

    const payroll = await prisma.monthlyPayroll.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    if (payroll.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Payroll is already marked as PAID' });
    }

    const payDate = paymentDate ? new Date(paymentDate) : new Date();

    const updated = await prisma.monthlyPayroll.update({
      where: { id },
      data: {
        status: 'PAID',
        isFinalized: true,
        paymentDate: payDate,
        paymentMethod: paymentMethod.toUpperCase(),
        paymentReference: paymentReference?.trim() || null,
        paymentNotes: paymentNotes?.trim() || null,
        paidById: req.user?.id || null,
        paidByName: req.user?.name || 'Admin',
        finalizedAt: new Date(),
        finalizedBy: req.user?.name || 'Admin'
      }
    });

    // Auto-deduct from active loans & advances
    if (payroll.loanDeduction > 0) {
      const activeLoans = await prisma.employeeLoanAdvance.findMany({
        where: { employeeId: payroll.employeeId, type: 'LOAN', status: 'ACTIVE' }
      });
      for (const al of activeLoans) {
        const newBal = Math.max(0, al.remainingBalance - payroll.loanDeduction);
        await prisma.employeeLoanAdvance.update({
          where: { id: al.id },
          data: {
            remainingBalance: newBal,
            status: newBal === 0 ? 'COMPLETED' : 'ACTIVE'
          }
        });
      }
    }

    if (payroll.advanceDeduction > 0) {
      const activeAdvances = await prisma.employeeLoanAdvance.findMany({
        where: { employeeId: payroll.employeeId, type: 'ADVANCE', status: 'ACTIVE' }
      });
      for (const aa of activeAdvances) {
        const newBal = Math.max(0, aa.remainingBalance - payroll.advanceDeduction);
        await prisma.employeeLoanAdvance.update({
          where: { id: aa.id },
          data: {
            remainingBalance: newBal,
            status: newBal === 0 ? 'COMPLETED' : 'ACTIVE'
          }
        });
      }
    }

    // Emit real-time socket events so Employee Portal updates immediately (Section 28)
    const io = req?.app?.get('io');
    if (io) {
      io.emit('payroll:updated');
      io.emit('payroll:paid', { employeeId: payroll.employeeId, id: payroll.id });
    }

    res.json({
      success: true,
      message: `Payroll marked as PAID for ${payroll.employeeName}`,
      payroll: updated
    });
  } catch (err) {
    console.error('Error marking payroll paid:', err);
    res.status(500).json({ success: false, message: 'Failed to mark payroll paid', error: err.message });
  }
};

// GET /api/employees/payroll/pending
// Pending payment section (Section 26)
const getPendingPayrolls = async (req, res) => {
  try {
    const branch = req.query.branch;
    const where = { status: 'PENDING_PAYMENT' };
    if (branch && branch !== 'ALL') {
      where.branch = { contains: branch, mode: 'insensitive' };
    }
    const payrolls = await prisma.monthlyPayroll.findMany({
      where,
      include: { employee: true },
      orderBy: { employeeId: 'asc' }
    });
    res.json({ success: true, count: payrolls.length, payrolls });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch pending payrolls', error: err.message });
  }
};

// GET /api/employees/audit/attendance
const getAttendanceAuditLogs = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const where = employeeId ? { employeeId } : {};
    const logs = await prisma.attendanceAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load attendance audit logs', error: err.message });
  }
};

// GET /api/employees/audit/payroll
const getPayrollAuditLogs = async (req, res) => {
  try {
    const { payrollId, employeeId } = req.query;
    const where = {};
    if (payrollId) where.payrollId = payrollId;
    if (employeeId) where.employeeId = employeeId;
    const logs = await prisma.payrollAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load payroll audit logs', error: err.message });
  }
};

// GET /api/employees/settings/portal-status
const getPortalStatus = async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'EMPLOYEE_PORTAL_ACCESS' }
    });
    const val = setting ? String(setting.value).replace(/"/g, '').trim().toUpperCase() : 'ON';
    const enabled = val !== 'OFF' && val !== 'FALSE' && val !== 'DISABLED';
    res.json({ success: true, enabled, settingValue: val });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error checking portal status', error: err.message });
  }
};

// POST /api/employees/settings/portal-status
const setPortalStatus = async (req, res) => {
  try {
    const { enabled } = req.body;
    const val = enabled ? 'ON' : 'OFF';
    await prisma.systemSetting.upsert({
      where: { key: 'EMPLOYEE_PORTAL_ACCESS' },
      update: { value: val },
      create: { key: 'EMPLOYEE_PORTAL_ACCESS', value: val }
    });
    res.json({ success: true, enabled: !!enabled, message: `Employee Portal access turned ${val}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating portal status', error: err.message });
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

    const summaryRows = payrolls.map((p, idx) => ({
      'Sr': idx + 1,
      'Employee ID': p.employeeId,
      'Employee': p.employeeName,
      'Designation': p.designation || 'Staff',
      'Department': p.department || 'General',
      'Location': p.branch || 'Head Office',
      'Worked Days': p.presentDays,
      'Gross Pay': p.grossSalary,
      'Fuel Allowance': p.fuelAllowance,
      'Absent Deduction': p.absentDeductions,
      'Late Deduction': p.lateDeductions,
      'Advance Deduction': p.advanceDeduction,
      'Loan Deduction': p.loanDeduction,
      'Overtime': p.overtimeAmount,
      'Full Attendance': p.fullAttendanceBonus || 0,
      'Incentive': p.productionEarning,
      'Reimbursement': p.reimbursement || 0,
      'Other Deductions': p.otherDeductions,
      'Net Pay': p.netPayable,
      'Status': p.status
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ 'Message': `No payroll found for ${monthYear}` }]);
    XLSX.utils.book_append_sheet(wb, ws, `Payroll_${monthYear}`);

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
  importAttendanceExcel,
  getAttendanceImportHistory,
  getMonthlyAttendance,
  getAttendanceRange,
  exportAttendanceExcel,
  getLeaves,
  createLeave,
  updateLeaveStatus,
  getLoans,
  createLoan,
  updateLoan,
  getProductionSummary,
  getMonthlyPayrollList,
  calculateMonthlyPayroll,
  adjustPayroll,
  approvePayrolls,
  approveSinglePayroll,
  markPayrollPaid,
  getPendingPayrolls,
  finalizeMonthlyPayroll,
  exportPayrollExcel,
  getAttendanceAuditLogs,
  getPayrollAuditLogs,
  getPortalStatus,
  setPortalStatus
};
