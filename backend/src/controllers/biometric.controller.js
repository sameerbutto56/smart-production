const prisma = require('../prisma');
const {
  parseTimeToMinutes,
  calculateAttendanceMetrics
} = require('../utils/attendanceUtils');

// Memory buffer for recent punches (for live debugging & admin status)
const recentBiometricLogs = [];

function recordLog(entry) {
  recentBiometricLogs.unshift({
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (recentBiometricLogs.length > 50) {
    recentBiometricLogs.pop();
  }
}

/**
 * Normalizes date & time from Hikvision device payload.
 * Hikvision formats can be:
 * - "2026-10-08T11:14:33+05:00"
 * - "2026-10-08 11:14:33"
 * - ISO string
 */
function parseHikvisionDateTime(raw) {
  if (!raw) {
    const now = new Date();
    // Pakistan is UTC+5
    const pkDate = new Date(now.getTime() + (5 * 60 - now.getTimezoneOffset()) * 60000);
    return {
      date: pkDate.toISOString().slice(0, 10),
      timeStr: pkDate.toISOString().slice(11, 16)
    };
  }

  const str = String(raw).trim();
  // Check if starts with YYYY-MM-DD
  const m = str.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::\d{2})?/);
  if (m) {
    return {
      date: m[1],
      timeStr: m[2]
    };
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return {
      date: parsed.toISOString().slice(0, 10),
      timeStr: parsed.toISOString().slice(11, 16)
    };
  }

  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    timeStr: now.toISOString().slice(11, 16)
  };
}

/**
 * Finds employee in EmployeeRecord matching Hikvision identifier.
 */
async function findEmployeeByIdentifier(rawId, rawName) {
  if (!rawId && !rawName) return null;
  const idStr = String(rawId || '').trim();

  if (idStr) {
    // 1. Exact employeeId match e.g. "02"
    let emp = await prisma.employeeRecord.findUnique({
      where: { employeeId: idStr }
    });
    if (emp) return emp;

    // 2. Stripped leading zeros e.g. "02" -> "2" or vice versa
    const numPart = idStr.replace(/^0+/, '') || idStr;
    emp = await prisma.employeeRecord.findFirst({
      where: {
        OR: [
          { employeeId: numPart },
          { employeeId: numPart.padStart(2, '0') },
          { employeeId: `EMP-${numPart.padStart(3, '0')}` },
          { employeeId: `EMP-${numPart}` }
        ]
      }
    });
    if (emp) return emp;
  }

  // 3. Match by name if provided by device
  if (rawName && typeof rawName === 'string' && rawName.trim()) {
    const emp = await prisma.employeeRecord.findFirst({
      where: {
        name: { equals: rawName.trim(), mode: 'insensitive' }
      }
    });
    if (emp) return emp;
  }

  return null;
}

/**
 * Core punch processing logic.
 */
async function processEmployeePunch({
  employeeId,
  employeeName,
  date,
  timeStr,
  verifyMode = 'BIOMETRIC',
  deviceName = 'Hikvision Terminal',
  req
}) {
  const emp = await findEmployeeByIdentifier(employeeId, employeeName);

  if (!emp) {
    recordLog({
      type: 'UNMATCHED',
      rawId: employeeId,
      rawName: employeeName,
      date,
      time: timeStr,
      verifyMode,
      deviceName,
      message: `Employee not found for ID "${employeeId}" / Name "${employeeName || ''}"`
    });
    return {
      success: false,
      matched: false,
      message: `Employee not registered for ID: ${employeeId}`
    };
  }

  const resolvedEmpId = emp.employeeId;
  const sIn = emp.checkInTime || '10:00';
  const sOut = emp.checkOutTime || '18:00';

  // Check if attendance already exists for today
  const existing = await prisma.employeeAttendance.findUnique({
    where: { employeeId_date: { employeeId: resolvedEmpId, date } }
  });

  let checkIn = existing?.checkInTime || null;
  let checkOut = existing?.checkOutTime || null;
  let punchType = 'CHECK_IN';

  const punchMinutes = parseTimeToMinutes(timeStr);

  if (!checkIn) {
    // First punch of the day -> Check In
    checkIn = timeStr;
    punchType = 'CHECK_IN';
  } else {
    const inMinutes = parseTimeToMinutes(checkIn);
    const diff = (punchMinutes !== null && inMinutes !== null) ? (punchMinutes - inMinutes) : 999;

    if (diff < 3) {
      // Accidental double punch within 3 minutes of check-in
      recordLog({
        type: 'DUPLICATE_PUNCH',
        employeeId: resolvedEmpId,
        employeeName: emp.name,
        date,
        time: timeStr,
        verifyMode,
        deviceName,
        message: `Ignored duplicate punch within ${diff}m of Check-In`
      });
      return {
        success: true,
        matched: true,
        employee: emp,
        action: 'IGNORED_DUPLICATE',
        message: 'Duplicate punch ignored (within 3m of check-in)'
      };
    }

    // Subsequent punch -> Check Out (or updated latest check-out)
    if (!checkOut) {
      checkOut = timeStr;
      punchType = 'CHECK_OUT';
    } else {
      const outMinutes = parseTimeToMinutes(checkOut);
      if (punchMinutes !== null && outMinutes !== null && punchMinutes > outMinutes) {
        checkOut = timeStr;
        punchType = 'CHECK_OUT_UPDATED';
      } else {
        punchType = 'CHECK_OUT_KEPT';
      }
    }
  }

  // Calculate metrics
  const { lateMinutes, earlyMinutes, overtimeMinutes, workingHours } = calculateAttendanceMetrics(
    sIn,
    sOut,
    checkIn,
    checkOut,
    'PRESENT'
  );

  let finalStatus = 'PRESENT';
  if (lateMinutes > 0) {
    finalStatus = 'LATE';
  }

  const record = await prisma.employeeAttendance.upsert({
    where: {
      employeeId_date: { employeeId: resolvedEmpId, date }
    },
    update: {
      employeeName: emp.name,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      scheduledCheckIn: sIn,
      scheduledCheckOut: sOut,
      lateMinutes,
      earlyMinutes,
      overtimeMinutes,
      status: finalStatus,
      workingHours,
      notes: `Punch via ${deviceName} (${verifyMode})`
    },
    create: {
      employeeId: resolvedEmpId,
      employeeName: emp.name,
      date,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      scheduledCheckIn: sIn,
      scheduledCheckOut: sOut,
      lateMinutes,
      earlyMinutes,
      overtimeMinutes,
      status: finalStatus,
      workingHours,
      notes: `Punch via ${deviceName} (${verifyMode})`
    }
  });

  recordLog({
    type: 'PUNCH_SUCCESS',
    employeeId: resolvedEmpId,
    employeeName: emp.name,
    date,
    time: timeStr,
    punchType,
    status: finalStatus,
    lateMinutes,
    overtimeMinutes,
    verifyMode,
    deviceName
  });

  // Socket notification
  try {
    const io = req?.app?.get('io');
    if (io) {
      io.emit('attendance:punched', {
        employeeId: resolvedEmpId,
        employeeName: emp.name,
        date,
        time: timeStr,
        punchType,
        status: finalStatus,
        verifyMode,
        deviceName
      });
      io.emit('attendance:updated');
    }
  } catch (sockErr) {
    // Fail-soft
  }

  return {
    success: true,
    matched: true,
    employee: emp,
    punchType,
    record
  };
}

/**
 * POST /api/biometric/hikvision
 * Main webhook handler receiving HTTP Push from Hikvision DS-K1T342MFWX.
 */
const receiveHikvisionEvent = async (req, res) => {
  try {
    let payload = req.body || {};

    // Check if multipart form uploaded event_log or AcsEvent as a file
    if (Array.isArray(req.files) && req.files.length > 0) {
      for (const file of req.files) {
        const fname = file.fieldname || '';
        if (fname === 'event_log' || fname === 'AcsEvent' || fname.includes('event') || (file.mimetype && (file.mimetype.includes('json') || file.mimetype.includes('text') || file.mimetype.includes('xml')))) {
          try {
            const str = file.buffer ? file.buffer.toString('utf8') : '';
            if (str.trim().startsWith('{')) {
              payload = { ...payload, ...JSON.parse(str) };
            } else if (str.includes('<employeeNoString>')) {
              const idMatch = str.match(/<employeeNoString>([^<]+)<\/employeeNoString>/);
              const timeMatch = str.match(/<dateTime>([^<]+)<\/dateTime>/);
              const nameMatch = str.match(/<name>([^<]+)<\/name>/);
              payload = {
                ...payload,
                AccessControllerEvent: {
                  employeeNoString: idMatch ? idMatch[1] : null,
                  name: nameMatch ? nameMatch[1] : null
                },
                dateTime: timeMatch ? timeMatch[1] : null
              };
            }
          } catch (fileParseErr) {
            console.warn('Could not parse file from multipart:', fname, fileParseErr.message);
          }
        }
      }
    }

    // 1. Hikvision multipart / event_log parsing
    if (typeof payload.event_log === 'string') {
      try {
        payload = { ...payload, ...JSON.parse(payload.event_log) };
      } catch (e) {
        // Continue with raw payload
      }
    } else if (typeof payload.AcsEvent === 'string') {
      try {
        payload = { ...payload, ...JSON.parse(payload.AcsEvent) };
      } catch (e) {
        // Continue
      }
    } else if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        // Handle XML string if present
        const idMatch = payload.match(/<employeeNoString>([^<]+)<\/employeeNoString>/);
        const timeMatch = payload.match(/<dateTime>([^<]+)<\/dateTime>/);
        const nameMatch = payload.match(/<name>([^<]+)<\/name>/);
        payload = {
          AccessControllerEvent: {
            employeeNoString: idMatch ? idMatch[1] : null,
            name: nameMatch ? nameMatch[1] : null
          },
          dateTime: timeMatch ? timeMatch[1] : null
        };
      }
    }

    const acs = payload.AccessControllerEvent || payload.AcsEvent || payload.EventNotificationAlert || payload;
    const rawEmployeeId = acs.employeeNoString || acs.cardNo || acs.employeeNo || payload.employeeNoString || payload.employeeId || null;
    const rawName = acs.name || payload.employeeName || null;
    const rawTime = payload.dateTime || acs.dateTime || payload.time || null;
    const verifyMode = acs.currentVerifyMode || acs.verifyMode || payload.verifyMode || 'face';
    const deviceName = acs.deviceName || payload.deviceName || 'DS-K1T342MFWX';

    // If device sends a keep-alive / test without an employee id
    if (!rawEmployeeId && !rawName) {
      recordLog({
        type: 'HEARTBEAT',
        deviceName,
        contentType: req.headers['content-type'] || 'unknown',
        bodyKeys: Object.keys(payload || {}),
        filesCount: Array.isArray(req.files) ? req.files.length : 0,
        message: 'Device probe / heartbeat received'
      });
      return res.status(200).json({
        statusCode: 1,
        statusString: 'OK',
        message: 'Hikvision probe received'
      });
    }

    const { date, timeStr } = parseHikvisionDateTime(rawTime);

    const result = await processEmployeePunch({
      employeeId: rawEmployeeId,
      employeeName: rawName,
      date,
      timeStr,
      verifyMode,
      deviceName,
      req
    });

    // Hikvision standard response format
    res.status(200).json({
      statusCode: 1,
      statusString: 'OK',
      subStatusCode: 'ok',
      message: result.message || 'Event processed successfully',
      employeeId: rawEmployeeId,
      punchType: result.punchType || 'UNKNOWN'
    });
  } catch (err) {
    console.error('Error handling Hikvision event:', err);
    recordLog({
      type: 'ERROR',
      error: err.message
    });
    // Always return 200 to Hikvision so terminal doesn't stall network
    res.status(200).json({
      statusCode: 0,
      statusString: 'Processed with error',
      error: err.message
    });
  }
};

/**
 * GET /api/biometric/hikvision
 * Device probe / connection check & configuration guide.
 */
const getHikvisionProbe = async (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Enamels Biometric Attendance Gateway',
    supportedDevice: 'Hikvision DS-K1T342MFWX',
    serverTime: new Date().toISOString(),
    webhookUrl: 'https://smart-production-v2.vercel.app/api/biometric/hikvision',
    instructions: {
      protocol: 'HTTP / HTTPS POST',
      menuPath: 'Device Web GUI -> Network -> Advanced Settings -> HTTP Listening (or Alarm Host)',
      targetUrl: 'https://smart-production-v2.vercel.app/api/biometric/hikvision'
    }
  });
};

/**
 * POST /api/biometric/punch
 * Manual or bridge direct punch endpoint.
 */
const recordDirectPunch = async (req, res) => {
  try {
    const { employeeId, employeeName, time, date, verifyMode, deviceName } = req.body;

    if (!employeeId && !employeeName) {
      return res.status(400).json({ success: false, message: 'employeeId or employeeName is required' });
    }

    const parsed = parseHikvisionDateTime(time || new Date().toISOString());
    const finalDate = date || parsed.date;
    const finalTimeStr = parsed.timeStr;

    const result = await processEmployeePunch({
      employeeId,
      employeeName,
      date: finalDate,
      timeStr: finalTimeStr,
      verifyMode: verifyMode || 'MANUAL_TEST',
      deviceName: deviceName || 'Direct Punch API',
      req
    });

    res.json({
      success: result.success,
      matched: result.matched,
      punchType: result.punchType,
      message: result.message || 'Punch processed',
      record: result.record
    });
  } catch (err) {
    console.error('Error in recordDirectPunch:', err);
    res.status(500).json({ success: false, message: 'Failed to record punch', error: err.message });
  }
};

/**
 * GET /api/biometric/status
 * Returns gateway status, recent punches, and mapped employees.
 */
const getBiometricStatus = async (req, res) => {
  try {
    const employees = await prisma.employeeRecord.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        employeeId: true,
        name: true,
        branch: true,
        designation: true,
        checkInTime: true,
        checkOutTime: true
      },
      orderBy: { employeeId: 'asc' }
    });

    res.json({
      success: true,
      gateway: {
        status: 'ACTIVE',
        model: 'Hikvision DS-K1T342MFWX',
        webhookUrl: 'https://smart-production-v2.vercel.app/api/biometric/hikvision',
        port: 443,
        protocol: 'HTTPS'
      },
      registeredEmployeesCount: employees.length,
      registeredEmployees: employees,
      recentPunches: recentBiometricLogs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load biometric status', error: err.message });
  }
};

module.exports = {
  receiveHikvisionEvent,
  getHikvisionProbe,
  recordDirectPunch,
  getBiometricStatus
};
