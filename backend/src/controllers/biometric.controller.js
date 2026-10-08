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
  if (recentBiometricLogs.length > 100) {
    recentBiometricLogs.pop();
  }
}

/**
 * Normalizes date & time from machine payload.
 * Guarantee: Preserves exact machine time in Asia/Karachi operating timezone.
 * NEVER estimates, rounds, or adds/subtracts arbitrary offsets.
 */
function parseMachineDateTime(raw) {
  if (!raw) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(now);
    const p = {};
    parts.forEach(x => { p[x.type] = x.value; });
    return {
      date: `${p.year}-${p.month}-${p.day}`,
      timeStr: `${p.hour}:${p.minute}:${p.second}`,
      rawTimestamp: 'SERVER_FALLBACK'
    };
  }

  const str = String(raw).trim();

  // Pattern A: Plain datetime "YYYY-MM-DD HH:MM:SS" or "YYYY/MM/DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  // If followed by +05:00 or no timezone, it's ALREADY in Pakistan local time!
  const matchPlainOrPkt = str.match(/^(\d{4}[-/]\d{2}[-/]\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)(?:\+05:?00)?$/i);
  if (matchPlainOrPkt) {
    const d = matchPlainOrPkt[1].replace(/\//g, '-');
    let t = matchPlainOrPkt[2];
    if (t.length === 5) t = `${t}:00`;
    return {
      date: d,
      timeStr: t,
      rawTimestamp: str
    };
  }

  // Pattern B: Time only "HH:MM:SS" or "HH:MM" (e.g. "10:03:27")
  const matchTimeOnly = str.match(/^(\d{2}:\d{2}(?::\d{2})?)$/);
  if (matchTimeOnly) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    let t = matchTimeOnly[1];
    if (t.length === 5) t = `${t}:00`;
    return {
      date: today,
      timeStr: t,
      rawTimestamp: str
    };
  }

  // Pattern C: ISO with explicit timezone Z or offset other than +05:00 (e.g. 2026-10-08T05:00:25Z)
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(dt);
    const p = {};
    parts.forEach(x => { p[x.type] = x.value; });
    return {
      date: `${p.year}-${p.month}-${p.day}`,
      timeStr: `${p.hour}:${p.minute}:${p.second}`,
      rawTimestamp: str
    };
  }

  // Fallback if unparseable
  return {
    date: new Date().toISOString().slice(0, 10),
    timeStr: '10:00:00',
    rawTimestamp: str
  };
}

// Active employees memory cache to ensure 0ms lookup latency
let cachedActiveEmployees = null;
let cachedActiveEmployeesExpiry = 0;

async function getActiveEmployeesList() {
  const now = Date.now();
  if (cachedActiveEmployees && cachedActiveEmployeesExpiry > now) {
    return cachedActiveEmployees;
  }
  try {
    cachedActiveEmployees = await prisma.employeeRecord.findMany({
      where: { status: 'ACTIVE' }
    });
    cachedActiveEmployeesExpiry = now + 60000; // cache for 60s
  } catch (_) {
    if (!cachedActiveEmployees) cachedActiveEmployees = [];
  }
  return cachedActiveEmployees;
}

/**
 * Finds employee in EmployeeRecord matching Hikvision identifier.
 * Active employees always take strict precedence.
 * Supports:
 * - Direct machineUserId match
 * - Direct employeeId match
 * - Number normalization (e.g. "02" <-> "2")
 * - Name matching: exact, bidirectional substring, token overlap (e.g. "Ali Raza" <-> "ALI", "Sajawal" <-> "MUHAMMAD SAJAWAL")
 * - Auto-linking: when matched, persists machineUserId to active EmployeeRecord for instant future lookups.
 */
async function findEmployeeByIdentifier(rawId, rawName) {
  if (!rawId && !rawName) return null;
  const idStr = String(rawId || '').trim();
  const cleanName = typeof rawName === 'string' ? rawName.trim() : '';

  const activeEmployees = await getActiveEmployeesList();

  if (idStr && idStr !== 'UNKNOWN' && idStr !== '0') {
    // 1. Explicit machineUserId mapping
    let emp = activeEmployees.find(e => e.machineUserId === idStr);
    if (emp) return emp;

    // 2. Exact employeeId match e.g. "02" or "5" or "13"
    emp = activeEmployees.find(e => e.employeeId === idStr);
    if (emp) return emp;

    // 3. Normalized numeric variations (e.g. "02" <-> "2", "005" <-> "5")
    const numPart = idStr.replace(/^0+/, '') || idStr;
    emp = activeEmployees.find(e => {
      const eNum = String(e.employeeId || '').replace(/^0+/, '');
      const mNum = String(e.machineUserId || '').replace(/^0+/, '');
      return eNum === numPart || mNum === numPart;
    });
    if (emp) return emp;
  }

  // 4. Name matching
  if (cleanName) {
    const cleanLower = cleanName.toLowerCase();
    const cleanTokens = cleanLower.split(/\s+/).filter(Boolean);

    // 4a. Exact name
    let emp = activeEmployees.find(e => e.name.toLowerCase() === cleanLower);
    if (emp) return emp;

    // 4b. Bidirectional substring
    emp = activeEmployees.find(e => {
      const candLower = e.name.toLowerCase();
      return cleanLower.includes(candLower) || candLower.includes(cleanLower);
    });
    if (emp) return emp;

    // 4c. Token match
    emp = activeEmployees.find(e => {
      const candTokens = e.name.toLowerCase().split(/\s+/).filter(Boolean);
      return cleanTokens.some(t =>
        candTokens.some(ct => (t.length >= 3 && ct.length >= 3 && (t === ct || ct.startsWith(t) || t.startsWith(ct))) || (t.length === 3 && ct === t))
      );
    });
    if (emp) return emp;
  }

  return null;
}

/**
 * Core punch processing logic.
 * 1. Upserts raw punch into MachineAttendance.
 * 2. Recalculates first & last punch for the day.
 * 3. Applies attendance engine rules.
 * 4. Updates EmployeeAttendance with source: 'MACHINE'.
 */
async function processEmployeePunch({
  employeeId,
  employeeName,
  date,
  timeStr,
  rawTimestamp = null,
  transactionId = null,
  verifyMode = 'BIOMETRIC',
  deviceName = 'DS-K1T342MFWX',
  rawPayload = null,
  source = 'MACHINE',
  req = null
}) {
  const emp = await findEmployeeByIdentifier(employeeId, employeeName);

  if (!emp) {
    // Store in MachineAttendance as UNMATCHED so Admin can audit unrecognized punches
    try {
      await prisma.machineAttendance.upsert({
        where: {
          machineId_machineUserId_punchDate_punchTime: {
            machineId: deviceName,
            machineUserId: String(employeeId || 'UNKNOWN'),
            punchDate: date,
            punchTime: timeStr
          }
        },
        update: {
          employeeName: employeeName || null,
          rawTimestamp: rawTimestamp || timeStr,
          transactionId: transactionId || null,
          status: 'UNMATCHED',
          verifyMode,
          source,
          rawPayload: rawPayload ? rawPayload : undefined
        },
        create: {
          machineId: deviceName,
          machineUserId: String(employeeId || 'UNKNOWN'),
          employeeId: null,
          employeeName: employeeName || null,
          punchDate: date,
          punchTime: timeStr,
          rawTimestamp: rawTimestamp || timeStr,
          transactionId: transactionId || null,
          punchType: 'UNKNOWN',
          verifyMode,
          location: 'Johar Town',
          source,
          rawPayload: rawPayload ? rawPayload : undefined,
          status: 'UNMATCHED'
        }
      });
    } catch (_) {}

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
      message: `Employee not registered for Machine ID: ${employeeId}`
    };
  }

  const resolvedEmpId = emp.employeeId;
  const sIn = emp.checkInTime || '10:00';
  const sOut = emp.checkOutTime || '18:00';

  // 1. Store raw machine punch in MachineAttendance FIRST (Source of Truth)
  try {
    await prisma.machineAttendance.upsert({
      where: {
        machineId_machineUserId_punchDate_punchTime: {
          machineId: deviceName,
          machineUserId: String(employeeId || resolvedEmpId),
          punchDate: date,
          punchTime: timeStr
        }
      },
      update: {
        employeeId: resolvedEmpId,
        employeeName: emp.name,
        rawTimestamp: rawTimestamp || timeStr,
        transactionId: transactionId || null,
        verifyMode,
        location: emp.branch || 'Johar Town',
        source,
        rawPayload: rawPayload ? rawPayload : undefined,
        status: 'PROCESSED'
      },
      create: {
        machineId: deviceName,
        machineUserId: String(employeeId || resolvedEmpId),
        employeeId: resolvedEmpId,
        employeeName: emp.name,
        punchDate: date,
        punchTime: timeStr,
        rawTimestamp: rawTimestamp || timeStr,
        transactionId: transactionId || null,
        punchType: 'CHECK_IN',
        verifyMode,
        location: emp.branch || 'Johar Town',
        source,
        rawPayload: rawPayload ? rawPayload : undefined,
        status: 'PROCESSED'
      }
    });
  } catch (_) {}

  // 2. Query ALL raw punches for this employee on this date (Section 15 & 16)
  const allPunches = await prisma.machineAttendance.findMany({
    where: {
      employeeId: resolvedEmpId,
      punchDate: date,
      status: { not: 'UNMATCHED' }
    },
    orderBy: { punchTime: 'asc' }
  });

  let checkIn = null;
  let checkOut = null;
  let rawPunchIn = null;
  let rawPunchOut = null;

  if (allPunches.length === 1) {
    checkIn = allPunches[0].punchTime;
    rawPunchIn = allPunches[0].rawTimestamp || allPunches[0].punchTime;
  } else if (allPunches.length > 1) {
    checkIn = allPunches[0].punchTime;
    rawPunchIn = allPunches[0].rawTimestamp || allPunches[0].punchTime;
    checkOut = allPunches[allPunches.length - 1].punchTime;
    rawPunchOut = allPunches[allPunches.length - 1].rawTimestamp || allPunches[allPunches.length - 1].punchTime;
  }

  // 3. Calculate attendance metrics from the exact real machine punches
  const {
    earlyArrivalMinutes,
    earlyCheckInOt,
    lateMinutes,
    earlyMinutes,
    checkoutOtMinutes,
    overtimeMinutes,
    workingHours
  } = calculateAttendanceMetrics(
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

  // 4. Update EmployeeAttendance with source: 'MACHINE'
  const record = await prisma.employeeAttendance.upsert({
    where: {
      employeeId_date: { employeeId: resolvedEmpId, date }
    },
    update: {
      employeeName: emp.name,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      rawPunchIn,
      rawPunchOut,
      scheduledCheckIn: sIn,
      scheduledCheckOut: sOut,
      earlyArrivalMinutes,
      earlyCheckInOt,
      lateMinutes,
      earlyMinutes,
      checkoutOtMinutes,
      overtimeMinutes,
      status: finalStatus,
      workingHours,
      machineId: deviceName,
      source: 'MACHINE',
      notes: `Punch via ${deviceName} (${verifyMode}) [Punches count: ${allPunches.length}]`
    },
    create: {
      employeeId: resolvedEmpId,
      employeeName: emp.name,
      date,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      rawPunchIn,
      rawPunchOut,
      scheduledCheckIn: sIn,
      scheduledCheckOut: sOut,
      earlyArrivalMinutes,
      earlyCheckInOt,
      lateMinutes,
      earlyMinutes,
      checkoutOtMinutes,
      overtimeMinutes,
      status: finalStatus,
      workingHours,
      machineId: deviceName,
      source: 'MACHINE',
      notes: `Punch via ${deviceName} (${verifyMode}) [Punches count: ${allPunches.length}]`
    }
  });

  try {
    const io = req?.app?.get('io');
    if (io) {
      io.emit('attendance:punched', { employeeId: resolvedEmpId, date, status: finalStatus });
      io.emit('attendance:updated');
    }
  } catch (_) {}

  recordLog({
    type: 'PUNCH_SUCCESS',
    employeeId: resolvedEmpId,
    employeeName: emp.name,
    date,
    time: timeStr,
    rawTimestamp,
    punchesCount: allPunches.length,
    checkIn,
    checkOut,
    verifyMode,
    deviceName,
    message: `Recorded ${verifyMode} punch for ${emp.name} (${resolvedEmpId}) at ${timeStr}`
  });

  return {
    success: true,
    matched: true,
    employee: emp,
    punchType: checkOut ? 'CHECK_OUT' : 'CHECK_IN',
    record
  };
}

/**
 * Extracts raw punch parameters from Hikvision HTTP Push payloads.
 */
function extractHikvisionData(req) {
  let rawEmployeeId = null;
  let rawName = null;
  let rawTime = null;
  let transactionId = null;
  let verifyMode = 'face';
  let deviceName = 'DS-K1T342MFWX';
  let punchTypeHint = null;
  let mergedPayload = {};

  function deepFind(obj, depth = 0) {
    if (!obj || depth > 5) return;

    if (!rawEmployeeId) {
      for (const k of ['employeeNoString', 'employeeNo', 'cardNo', 'personId', 'id', 'UserCode', 'EnrollNumber', 'pin']) {
        if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '' && String(obj[k]) !== '0') {
          rawEmployeeId = String(obj[k]).trim();
          break;
        }
      }
    }

    if (!rawName) {
      for (const k of ['name', 'employeeName', 'userName', 'personName']) {
        if (typeof obj[k] === 'string' && obj[k].trim() !== '') {
          rawName = obj[k].trim();
          break;
        }
      }
    }

    if (!rawTime) {
      for (const k of ['dateTime', 'time', 'punchTime', 'timestamp', 'eventTime', 'PunchDate']) {
        if (obj[k] && typeof obj[k] === 'string' && obj[k].trim() !== '') {
          rawTime = obj[k].trim();
          break;
        }
      }
    }

    if (!transactionId) {
      for (const k of ['serialNo', 'logId', 'eventID', 'transactionId', 'EventSerialNo']) {
        if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
          transactionId = String(obj[k]).trim();
          break;
        }
      }
    }

    if (!punchTypeHint) {
      for (const k of ['attendanceStatus', 'attendStatus', 'punchType', 'direction']) {
        if (typeof obj[k] === 'string' && obj[k].trim() !== '') {
          punchTypeHint = obj[k].trim();
          break;
        }
      }
    }

    if (obj.currentVerifyMode || obj.verifyMode) {
      verifyMode = String(obj.currentVerifyMode || obj.verifyMode);
    }
    if (obj.deviceName || obj.deviceDescription) {
      deviceName = String(obj.deviceName || obj.deviceDescription);
    }

    if (Array.isArray(obj)) {
      for (const item of obj) deepFind(item, depth + 1);
    } else {
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') {
          deepFind(val, depth + 1);
        }
      }
    }
  }

  // 1. Process files from multipart memory storage
  if (Array.isArray(req.files) && req.files.length > 0) {
    for (const file of req.files) {
      try {
        const text = file.buffer ? file.buffer.toString('utf8') : '';
        if (text) {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              mergedPayload = { ...mergedPayload, ...parsed };
              deepFind(parsed);
            } catch (_) {}
          }
          if (text.includes('<')) {
            const idM = text.match(/<employeeNoString[^>]*>([^<]+)<\/employeeNoString>/i) ||
                        text.match(/<employeeNo[^>]*>([^<]+)<\/employeeNo>/i) ||
                        text.match(/<cardNo[^>]*>([^<]+)<\/cardNo>/i) ||
                        text.match(/<personId[^>]*>([^<]+)<\/personId>/i);
            const nameM = text.match(/<name[^>]*>([^<]+)<\/name>/i) ||
                          text.match(/<employeeName[^>]*>([^<]+)<\/employeeName>/i);
            const timeM = text.match(/<dateTime[^>]*>([^<]+)<\/dateTime>/i) ||
                          text.match(/<time[^>]*>([^<]+)<\/time>/i);
            const devM = text.match(/<deviceName[^>]*>([^<]+)<\/deviceName>/i);
            const serialM = text.match(/<serialNo[^>]*>([^<]+)<\/serialNo>/i);
            if (idM && !rawEmployeeId) rawEmployeeId = idM[1].trim();
            if (nameM && !rawName) rawName = nameM[1].trim();
            if (timeM && !rawTime) rawTime = timeM[1].trim();
            if (devM) deviceName = devM[1].trim();
            if (serialM) transactionId = serialM[1].trim();
          }
        }
      } catch (err) {
        console.warn('Error reading multipart file:', err.message);
      }
    }
  }

  // 2. Process req.body
  let body = req.body;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        body = JSON.parse(trimmed);
      } catch (_) {}
    } else if (trimmed.includes('<')) {
      const idM = trimmed.match(/<employeeNoString[^>]*>([^<]+)<\/employeeNoString>/i) ||
                  trimmed.match(/<employeeNo[^>]*>([^<]+)<\/employeeNo>/i) ||
                  trimmed.match(/<cardNo[^>]*>([^<]+)<\/cardNo>/i);
      const nameM = trimmed.match(/<name[^>]*>([^<]+)<\/name>/i);
      const timeM = trimmed.match(/<dateTime[^>]*>([^<]+)<\/dateTime>/i) ||
                    trimmed.match(/<time[^>]*>([^<]+)<\/time>/i);
      const devM = trimmed.match(/<deviceName[^>]*>([^<]+)<\/deviceName>/i);
      const serialM = trimmed.match(/<serialNo[^>]*>([^<]+)<\/serialNo>/i);
      if (idM && !rawEmployeeId) rawEmployeeId = idM[1].trim();
      if (nameM && !rawName) rawName = nameM[1].trim();
      if (timeM && !rawTime) rawTime = timeM[1].trim();
      if (devM) deviceName = devM[1].trim();
      if (serialM) transactionId = serialM[1].trim();
    }
  }

  if (body && typeof body === 'object') {
    mergedPayload = { ...mergedPayload, ...body };
    deepFind(body);

    for (const key of Object.keys(body)) {
      if (typeof body[key] === 'string' && (body[key].includes('{') || body[key].includes('<'))) {
        try {
          const parsed = JSON.parse(body[key]);
          deepFind(parsed);
        } catch (_) {
          const idM = body[key].match(/<employeeNoString[^>]*>([^<]+)<\/employeeNoString>/i);
          if (idM && !rawEmployeeId) rawEmployeeId = idM[1].trim();
        }
      }
    }
  }

  return {
    rawEmployeeId,
    rawName,
    rawTime,
    transactionId,
    verifyMode,
    deviceName,
    punchTypeHint,
    payload: mergedPayload
  };
}

/**
 * Helper to respond to Hikvision DS-K1T342MFWX HTTP Listening push.
 * Sends immediate ACK with Connection: close to terminate the current session
 * and avoid firmware retry loops on AccessControllerEvent pushes.
 */
function sendHikvisionResponse(req, res, statusCode = 1, statusString = 'OK', subStatusCode = 'ok', message = 'OK', extra = {}) {
  res.set('Connection', 'close');

  const reqUrl = req.originalUrl || req.url || '/api/biometric/hikvision';
  const ct = (req.headers['content-type'] || '').toLowerCase();
  const rawBodyText = typeof req.body === 'string' ? req.body : '';
  const isXml = ct.includes('xml') || rawBodyText.trim().startsWith('<');

  if (isXml) {
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<ResponseStatus version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<requestURL>${reqUrl}</requestURL>
<statusCode>${statusCode}</statusCode>
<statusString>${statusString}</statusString>
<subStatusCode>${subStatusCode}</subStatusCode>
</ResponseStatus>`;
    res.set('Content-Type', 'application/xml; charset=UTF-8');
    return res.status(200).send(xmlBody);
  }

  // Standard JSON response for AccessControllerEvent HTTP Listening
  res.set('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    statusString,
    statusCode,
    statusCustom: statusString,
    subStatusCode,
    ResponseStatus: {
      requestURL: reqUrl,
      statusCode,
      statusString,
      subStatusCode
    },
    message,
    ...extra
  });
}

/**
 * POST /api/biometric/hikvision
 * Main webhook handler receiving HTTP Push from Hikvision DS-K1T342MFWX.
 */
const receiveHikvisionEvent = async (req, res) => {
  try {
    const extracted = extractHikvisionData(req);
    const { rawEmployeeId, rawName, rawTime, transactionId, verifyMode, deviceName, payload } = extracted;

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // If device sends a keep-alive / test without an employee id
    if (!rawEmployeeId && !rawName) {
      recordLog({
        type: 'HEARTBEAT',
        deviceName,
        clientIp,
        userAgent,
        contentType: req.headers['content-type'] || 'unknown',
        bodyKeys: Object.keys(payload || {}),
        message: 'Device probe / heartbeat received'
      });
      return sendHikvisionResponse(req, res, 1, 'OK', 'ok', 'Hikvision probe received');
    }

    const { date, timeStr, rawTimestamp } = parseMachineDateTime(rawTime);

    const result = await processEmployeePunch({
      employeeId: rawEmployeeId,
      employeeName: rawName,
      date,
      timeStr,
      rawTimestamp,
      transactionId,
      verifyMode,
      deviceName,
      rawPayload: payload,
      source: 'MACHINE',
      req
    });

    return sendHikvisionResponse(req, res, 1, 'OK', 'ok', result.message || 'Event processed successfully', {
      employeeId: rawEmployeeId,
      punchType: result.punchType || 'UNKNOWN'
    });
  } catch (err) {
    console.error('Error handling Hikvision event:', err);
    recordLog({
      type: 'ERROR',
      error: err.message
    });
    return sendHikvisionResponse(req, res, 1, 'OK', 'ok', 'Processed with notice: ' + err.message);
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
    operatingTimezone: 'Asia/Karachi (UTC+05:00)',
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
    const { employeeId, employeeName, time, date, verifyMode, deviceName, transactionId } = req.body;

    if (!employeeId && !employeeName) {
      return res.status(400).json({ success: false, message: 'employeeId or employeeName is required' });
    }

    const parsed = parseMachineDateTime(time || new Date().toISOString());
    const finalDate = date || parsed.date;
    const finalTimeStr = parsed.timeStr;

    const result = await processEmployeePunch({
      employeeId,
      employeeName,
      date: finalDate,
      timeStr: finalTimeStr,
      rawTimestamp: parsed.rawTimestamp,
      transactionId,
      verifyMode: verifyMode || 'MANUAL_TEST',
      deviceName: deviceName || 'Direct Punch API',
      source: 'MANUAL',
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
 * POST /api/biometric/sync-batch
 * Batch ingestion of historical machine punches (Section 9, 10, 13, 14).
 * Idempotent: Skips duplicates, calculates first/last punch per employee/day.
 */
const syncBatchPunches = async (req, res) => {
  try {
    const { punches, machineId = 'DS-K1T342MFWX', source = 'MACHINE' } = req.body;
    if (!Array.isArray(punches) || punches.length === 0) {
      return res.status(400).json({ success: false, message: 'punches array is required' });
    }

    let inserted = 0;
    let skipped = 0;
    const touchedPairs = new Map(); // key: "empId_date", value: { employeeId, date }

    for (const p of punches) {
      const rawId = p.machineUserId || p.employeeId || p.EnrollNumber || p.UserCode || p.pin;
      const rawName = p.name || p.employeeName || p.userName;
      const rawTime = p.timestamp || p.dateTime || p.time || p.PunchDate;

      if (!rawId && !rawName) {
        skipped++;
        continue;
      }

      const emp = await findEmployeeByIdentifier(rawId, rawName);
      if (!emp) {
        skipped++;
        continue;
      }

      const { date, timeStr, rawTimestamp } = parseMachineDateTime(rawTime);
      const devName = p.machineId || machineId;
      const txId = p.transactionId ? String(p.transactionId) : null;
      const verifyMode = p.verifyMode || 'BIOMETRIC';

      try {
        await prisma.machineAttendance.upsert({
          where: {
            machineId_machineUserId_punchDate_punchTime: {
              machineId: devName,
              machineUserId: String(rawId || emp.employeeId),
              punchDate: date,
              punchTime: timeStr
            }
          },
          update: {
            employeeId: emp.employeeId,
            employeeName: emp.name,
            rawTimestamp: rawTimestamp || timeStr,
            transactionId: txId,
            verifyMode,
            source,
            status: 'PROCESSED'
          },
          create: {
            machineId: devName,
            machineUserId: String(rawId || emp.employeeId),
            employeeId: emp.employeeId,
            employeeName: emp.name,
            punchDate: date,
            punchTime: timeStr,
            rawTimestamp: rawTimestamp || timeStr,
            transactionId: txId,
            verifyMode,
            source,
            location: emp.branch || 'Johar Town',
            status: 'PROCESSED'
          }
        });
        inserted++;
      } catch (_) {
        skipped++;
      }

      touchedPairs.set(`${emp.employeeId}_${date}`, { employeeId: emp.employeeId, date, emp });
    }

    // Recalculate daily attendance for all affected employee-date pairs (Section 15 & 16)
    let recalculatedCount = 0;
    for (const { employeeId, date, emp } of touchedPairs.values()) {
      const allPunches = await prisma.machineAttendance.findMany({
        where: { employeeId, punchDate: date, status: { not: 'UNMATCHED' } },
        orderBy: { punchTime: 'asc' }
      });

      if (allPunches.length === 0) continue;

      const checkIn = allPunches[0].punchTime;
      const rawPunchIn = allPunches[0].rawTimestamp || allPunches[0].punchTime;
      const checkOut = allPunches.length > 1 ? allPunches[allPunches.length - 1].punchTime : null;
      const rawPunchOut = allPunches.length > 1 ? (allPunches[allPunches.length - 1].rawTimestamp || allPunches[allPunches.length - 1].punchTime) : null;

      const sIn = emp.checkInTime || '10:00';
      const sOut = emp.checkOutTime || '18:00';

      const {
        earlyArrivalMinutes,
        earlyCheckInOt,
        lateMinutes,
        earlyMinutes,
        checkoutOtMinutes,
        overtimeMinutes,
        workingHours
      } = calculateAttendanceMetrics(
        sIn,
        sOut,
        checkIn,
        checkOut,
        'PRESENT'
      );

      let finalStatus = 'PRESENT';
      if (lateMinutes > 0) finalStatus = 'LATE';

      await prisma.employeeAttendance.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: {
          employeeName: emp.name,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          rawPunchIn,
          rawPunchOut,
          scheduledCheckIn: sIn,
          scheduledCheckOut: sOut,
          earlyArrivalMinutes,
          earlyCheckInOt,
          lateMinutes,
          earlyMinutes,
          checkoutOtMinutes,
          overtimeMinutes,
          status: finalStatus,
          workingHours,
          source: 'MACHINE',
          notes: `Batch synced from ${machineId} [Punches count: ${allPunches.length}]`
        },
        create: {
          employeeId,
          employeeName: emp.name,
          date,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          rawPunchIn,
          rawPunchOut,
          scheduledCheckIn: sIn,
          scheduledCheckOut: sOut,
          earlyArrivalMinutes,
          earlyCheckInOt,
          lateMinutes,
          earlyMinutes,
          checkoutOtMinutes,
          overtimeMinutes,
          status: finalStatus,
          workingHours,
          source: 'MACHINE',
          notes: `Batch synced from ${machineId} [Punches count: ${allPunches.length}]`
        }
      });
      recalculatedCount++;
    }

    res.json({
      success: true,
      message: `Batch sync complete: ${inserted} raw punches processed, ${recalculatedCount} daily attendance records calculated.`,
      insertedPunches: inserted,
      skippedPunches: skipped,
      recalculatedDates: recalculatedCount
    });
  } catch (err) {
    console.error('Error in syncBatchPunches:', err);
    res.status(500).json({ success: false, message: 'Failed to sync punches', error: err.message });
  }
};

/**
 * POST /api/biometric/recalculate
 * Re-runs the first/last punch calculation engine over a date range (Section 15, 16, 26).
 * From raw MachineAttendance records. Never invents fake check-in/out times.
 */
const recalculateAttendanceRange = async (req, res) => {
  try {
    const { startDate = '2026-09-01', endDate = new Date().toISOString().slice(0, 10), employeeId } = req.body;

    const empWhere = { status: 'ACTIVE' };
    if (employeeId && employeeId !== 'ALL') {
      empWhere.employeeId = employeeId;
    }

    const employees = await prisma.employeeRecord.findMany({
      where: empWhere,
      orderBy: { employeeId: 'asc' }
    });

    // Query raw punches for the range
    const rawPunches = await prisma.machineAttendance.findMany({
      where: {
        punchDate: { gte: startDate, lte: endDate },
        status: { not: 'UNMATCHED' },
        ...(employeeId && employeeId !== 'ALL' ? { employeeId } : {})
      },
      orderBy: { punchTime: 'asc' }
    });

    // Group punches by employeeId and date
    const punchMap = new Map(); // key: "empId_date", value: array of punches
    rawPunches.forEach(p => {
      if (!p.employeeId) return;
      const key = `${p.employeeId}_${p.punchDate}`;
      if (!punchMap.has(key)) punchMap.set(key, []);
      punchMap.get(key).push(p);
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

    // Query approved leaves
    const leaves = await prisma.employeeLeave.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });

    let updatedWithPunches = 0;
    let reconciledAbsents = 0;

    const upsertTasks = [];

    for (const emp of employees) {
      const sIn = emp.checkInTime || '10:00';
      const sOut = emp.checkOutTime || '18:00';

      for (const d of dateList) {
        const key = `${emp.employeeId}_${d}`;
        const punches = punchMap.get(key) || [];

        if (punches.length > 0) {
          // Real machine punches available -> First = Check-in, Last = Check-out (Section 16)
          const checkIn = punches[0].punchTime;
          const rawPunchIn = punches[0].rawTimestamp || punches[0].punchTime;
          const checkOut = punches.length > 1 ? punches[punches.length - 1].punchTime : null;
          const rawPunchOut = punches.length > 1 ? (punches[punches.length - 1].rawTimestamp || punches[punches.length - 1].punchTime) : null;

          const {
            earlyArrivalMinutes,
            earlyCheckInOt,
            lateMinutes,
            earlyMinutes,
            checkoutOtMinutes,
            overtimeMinutes,
            workingHours
          } = calculateAttendanceMetrics(
            sIn,
            sOut,
            checkIn,
            checkOut,
            'PRESENT'
          );

          let finalStatus = 'PRESENT';
          if (lateMinutes > 0) finalStatus = 'LATE';

          upsertTasks.push(() => prisma.employeeAttendance.upsert({
            where: { employeeId_date: { employeeId: emp.employeeId, date: d } },
            update: {
              employeeName: emp.name,
              checkInTime: checkIn,
              checkOutTime: checkOut,
              rawPunchIn,
              rawPunchOut,
              scheduledCheckIn: sIn,
              scheduledCheckOut: sOut,
              earlyArrivalMinutes,
              earlyCheckInOt,
              lateMinutes,
              earlyMinutes,
              checkoutOtMinutes,
              overtimeMinutes,
              status: finalStatus,
              workingHours,
              source: 'MACHINE',
              notes: `Real machine attendance [Punches: ${punches.length}]`
            },
            create: {
              employeeId: emp.employeeId,
              employeeName: emp.name,
              date: d,
              checkInTime: checkIn,
              checkOutTime: checkOut,
              rawPunchIn,
              rawPunchOut,
              scheduledCheckIn: sIn,
              scheduledCheckOut: sOut,
              earlyArrivalMinutes,
              earlyCheckInOt,
              lateMinutes,
              earlyMinutes,
              checkoutOtMinutes,
              overtimeMinutes,
              status: finalStatus,
              workingHours,
              source: 'MACHINE',
              notes: `Real machine attendance [Punches: ${punches.length}]`
            }
          }));
          updatedWithPunches++;
        } else {
          // No machine record available (Section 3, 11, 31) -> NEVER INVENT TIMES!
          const onLeave = leaves.find(l => l.employeeId === emp.employeeId && l.startDate <= d && l.endDate >= d);
          const autoStatus = onLeave ? 'LEAVE' : 'ABSENT';

          upsertTasks.push(() => prisma.employeeAttendance.upsert({
            where: { employeeId_date: { employeeId: emp.employeeId, date: d } },
            update: {
              employeeName: emp.name,
              checkInTime: null,
              checkOutTime: null,
              rawPunchIn: null,
              rawPunchOut: null,
              scheduledCheckIn: sIn,
              scheduledCheckOut: sOut,
              earlyArrivalMinutes: 0,
              earlyCheckInOt: 0,
              lateMinutes: 0,
              earlyMinutes: 0,
              checkoutOtMinutes: 0,
              overtimeMinutes: 0,
              status: autoStatus,
              workingHours: 0,
              source: 'MACHINE',
              notes: onLeave ? `Approved ${onLeave.leaveType} Leave` : 'No machine record'
            },
            create: {
              employeeId: emp.employeeId,
              employeeName: emp.name,
              date: d,
              checkInTime: null,
              checkOutTime: null,
              rawPunchIn: null,
              rawPunchOut: null,
              scheduledCheckIn: sIn,
              scheduledCheckOut: sOut,
              earlyArrivalMinutes: 0,
              earlyCheckInOt: 0,
              lateMinutes: 0,
              earlyMinutes: 0,
              checkoutOtMinutes: 0,
              overtimeMinutes: 0,
              status: autoStatus,
              workingHours: 0,
              source: 'MACHINE',
              notes: onLeave ? `Approved ${onLeave.leaveType} Leave` : 'No machine record'
            }
          }));
          reconciledAbsents++;
        }
      }
    }

    // Execute in parallel batches of 15
    const CHUNK_SIZE = 15;
    for (let i = 0; i < upsertTasks.length; i += CHUNK_SIZE) {
      await Promise.all(upsertTasks.slice(i, i + CHUNK_SIZE).map(task => task()));
    }

    res.json({
      success: true,
      message: `Recalculation complete from ${startDate} to ${endDate}. Updated ${updatedWithPunches} present records with real punches and ${reconciledAbsents} records with no machine punches.`,
      startDate,
      endDate,
      employeesCount: employees.length,
      daysCount: dateList.length,
      updatedWithPunches,
      reconciledAbsents
    });
  } catch (err) {
    console.error('Error in recalculateAttendanceRange:', err);
    res.status(500).json({ success: false, message: 'Failed to recalculate attendance range', error: err.message });
  }
};

/**
 * GET /api/biometric/raw-logs
 * Compares Raw Machine Data vs Calculated Attendance (Section 24).
 */
const getRawMachinePunches = async (req, res) => {
  try {
    const { date = new Date().toISOString().slice(0, 10), employeeId } = req.query;

    const rawWhere = (date && date !== 'ALL') ? { punchDate: date } : {};
    if (employeeId && employeeId !== 'ALL') {
      rawWhere.OR = [
        { employeeId },
        { machineUserId: employeeId }
      ];
    }

    const rawPunches = await prisma.machineAttendance.findMany({
      where: rawWhere,
      orderBy: [{ punchDate: 'desc' }, { punchTime: 'asc' }],
      take: 200
    });

    const attWhere = (date && date !== 'ALL') ? { date } : {};
    if (employeeId && employeeId !== 'ALL') {
      attWhere.employeeId = employeeId;
    }

    const calculatedRecords = await prisma.employeeAttendance.findMany({
      where: attWhere,
      orderBy: { employeeId: 'asc' }
    });

    res.json({
      success: true,
      date,
      employeeId: employeeId || 'ALL',
      rawPunchesCount: rawPunches.length,
      rawPunches,
      calculatedCount: calculatedRecords.length,
      calculatedRecords
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch raw machine punches', error: err.message });
  }
};

/**
 * GET /api/biometric/status
 * Returns gateway status, sync counters, and mapped employees.
 */
const getBiometricStatus = async (req, res) => {
  try {
    const employees = await prisma.employeeRecord.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        employeeId: true,
        machineUserId: true,
        name: true,
        branch: true,
        designation: true,
        checkInTime: true,
        checkOutTime: true
      },
      orderBy: { employeeId: 'asc' }
    });

    const totalRawCount = await prisma.machineAttendance.count();
    const unmatchedCount = await prisma.machineAttendance.count({
      where: { status: 'UNMATCHED' }
    });

    const rawPunches = await prisma.machineAttendance.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    });

    const lastPunch = await prisma.machineAttendance.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      gateway: {
        status: 'CONNECTED',
        model: 'Hikvision DS-K1T342MFWX',
        webhookUrl: 'https://smart-production-v2.vercel.app/api/biometric/hikvision',
        port: 443,
        protocol: 'HTTPS',
        operatingTimezone: 'Asia/Karachi (UTC+05:00)',
        lastSync: lastPunch ? lastPunch.createdAt : null,
        totalRawPunches: totalRawCount,
        unmatchedPunches: unmatchedCount
      },
      registeredEmployeesCount: employees.length,
      registeredEmployees: employees,
      rawMachinePunches: rawPunches,
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
  syncBatchPunches,
  recalculateAttendanceRange,
  getRawMachinePunches,
  getBiometricStatus,
  parseMachineDateTime,
  findEmployeeByIdentifier,
  processEmployeePunch
};
