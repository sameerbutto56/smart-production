const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/prisma');
const { calculateAttendanceMetrics } = require('../src/utils/attendanceUtils');

// Helper to determine day of week in Pakistan timezone
function isSunday(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.getUTCDay() === 0;
}

// Check if punch is in progress today
function isToday(dateStr) {
  const now = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  return dateStr === now;
}

async function runBackfill(startDate = '2026-09-01', endDate = '2026-10-13') {
  console.log(`Starting Attendance Backfill from ${startDate} to ${endDate}...`);

  const employees = await prisma.employeeRecord.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { employeeId: 'asc' }
  });
  console.log(`Found ${employees.length} active employees.`);

  // Build mapping from various machine IDs to EmployeeRecord
  const empMap = new Map();
  const idToEmp = new Map();

  employees.forEach(emp => {
    empMap.set(emp.employeeId, emp);
    idToEmp.set(String(emp.employeeId).trim(), emp);
    if (emp.machineUserId) {
      idToEmp.set(String(emp.machineUserId).trim(), emp);
    }
    const numPart = String(emp.employeeId).replace(/^0+/, '');
    if (numPart) idToEmp.set(numPart, emp);
    if (emp.machineUserId) {
      const mNum = String(emp.machineUserId).replace(/^0+/, '');
      if (mNum) idToEmp.set(mNum, emp);
    }
    // Also match normalized name
    idToEmp.set(emp.name.toLowerCase().trim(), emp);
  });

  // Query all raw punches in range
  const punches = await prisma.machineAttendance.findMany({
    where: {
      punchDate: { gte: startDate, lte: endDate }
    },
    orderBy: { punchTime: 'asc' }
  });
  console.log(`Loaded ${punches.length} raw punches from MachineAttendance.`);

  // Group punches by employeeId and date
  const punchGroup = new Map(); // key: "empId_date", value: array of punches
  for (const p of punches) {
    let emp = null;
    if (p.employeeId && empMap.has(p.employeeId)) {
      emp = empMap.get(p.employeeId);
    } else if (p.machineUserId && idToEmp.has(String(p.machineUserId).trim())) {
      emp = idToEmp.get(String(p.machineUserId).trim());
    } else if (p.employeeName && idToEmp.has(p.employeeName.toLowerCase().trim())) {
      emp = idToEmp.get(p.employeeName.toLowerCase().trim());
    }

    if (!emp) continue;

    // Ensure MachineAttendance row has employeeId attached
    if (!p.employeeId || p.status === 'UNMATCHED') {
      await prisma.machineAttendance.update({
        where: { id: p.id },
        data: {
          employeeId: emp.employeeId,
          employeeName: emp.name,
          status: 'PROCESSED'
        }
      }).catch(() => {});
    }

    const key = `${emp.employeeId}_${p.punchDate}`;
    if (!punchGroup.has(key)) punchGroup.set(key, []);
    punchGroup.get(key).push(p);
  }

  // Query leaves
  const leaves = await prisma.employeeLeave.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    }
  });

  // Generate date list
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dateList = [];
  let cur = new Date(start);
  while (cur <= end) {
    dateList.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  console.log(`Processing ${dateList.length} dates across ${employees.length} employees (${dateList.length * employees.length} slots)...`);

  let presentCount = 0;
  let incompleteCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let weeklyOffCount = 0;

  for (const emp of employees) {
    const sIn = emp.checkInTime || '10:00';
    const sOut = emp.checkOutTime || '18:00';

    for (const d of dateList) {
      const key = `${emp.employeeId}_${d}`;
      const dayPunches = punchGroup.get(key) || [];

      if (dayPunches.length > 0) {
        const checkIn = dayPunches[0].punchTime;
        const rawPunchIn = dayPunches[0].rawTimestamp || dayPunches[0].punchTime;
        const checkOut = dayPunches.length > 1 ? dayPunches[dayPunches.length - 1].punchTime : null;
        const rawPunchOut = dayPunches.length > 1 ? (dayPunches[dayPunches.length - 1].rawTimestamp || dayPunches[dayPunches.length - 1].punchTime) : null;

        const metrics = calculateAttendanceMetrics(sIn, sOut, checkIn, checkOut, 'PRESENT');

        let status = 'PRESENT';
        if (dayPunches.length === 1) {
          if (isToday(d)) {
            status = metrics.lateMinutes > 0 ? 'LATE' : 'PRESENT';
          } else {
            status = 'INCOMPLETE';
            incompleteCount++;
          }
        } else {
          if (metrics.lateMinutes > 0) status = 'LATE';
          presentCount++;
        }

        await prisma.employeeAttendance.upsert({
          where: { employeeId_date: { employeeId: emp.employeeId, date: d } },
          update: {
            employeeName: emp.name,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            rawPunchIn,
            rawPunchOut,
            scheduledCheckIn: sIn,
            scheduledCheckOut: sOut,
            earlyArrivalMinutes: metrics.earlyArrivalMinutes,
            earlyCheckInOt: metrics.earlyCheckInOt,
            lateMinutes: metrics.lateMinutes,
            earlyMinutes: metrics.earlyMinutes,
            checkoutOtMinutes: metrics.checkoutOtMinutes,
            overtimeMinutes: metrics.overtimeMinutes,
            status,
            workingHours: metrics.workingHours,
            machineId: dayPunches[0].machineId || 'DS-K1T342MFWX',
            source: 'MACHINE',
            notes: `Punch via ${dayPunches[0].machineId || 'DS-K1T342MFWX'} [${dayPunches.length} punches]`
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
            earlyArrivalMinutes: metrics.earlyArrivalMinutes,
            earlyCheckInOt: metrics.earlyCheckInOt,
            lateMinutes: metrics.lateMinutes,
            earlyMinutes: metrics.earlyMinutes,
            checkoutOtMinutes: metrics.checkoutOtMinutes,
            overtimeMinutes: metrics.overtimeMinutes,
            status,
            workingHours: metrics.workingHours,
            machineId: dayPunches[0].machineId || 'DS-K1T342MFWX',
            source: 'MACHINE',
            notes: `Punch via ${dayPunches[0].machineId || 'DS-K1T342MFWX'} [${dayPunches.length} punches]`
          }
        });
      } else {
        // No machine punches found for this date
        const onLeave = leaves.find(l => l.employeeId === emp.employeeId && l.startDate <= d && l.endDate >= d);
        if (onLeave) {
          leaveCount++;
          await prisma.employeeAttendance.upsert({
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
              status: 'LEAVE',
              workingHours: 0,
              source: 'SYSTEM',
              notes: `Approved ${onLeave.leaveType} Leave`
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
              status: 'LEAVE',
              workingHours: 0,
              source: 'SYSTEM',
              notes: `Approved ${onLeave.leaveType} Leave`
            }
          });
        } else if (isSunday(d)) {
          weeklyOffCount++;
          await prisma.employeeAttendance.upsert({
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
              status: 'WEEKLY_OFF',
              workingHours: 0,
              source: 'SYSTEM',
              notes: 'Weekly Off / Non-Working Day'
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
              status: 'WEEKLY_OFF',
              workingHours: 0,
              source: 'SYSTEM',
              notes: 'Weekly Off / Non-Working Day'
            }
          });
        } else {
          absentCount++;
          await prisma.employeeAttendance.upsert({
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
              status: 'ABSENT',
              workingHours: 0,
              source: 'SYSTEM',
              notes: 'No machine punch found for this date'
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
              status: 'ABSENT',
              workingHours: 0,
              source: 'SYSTEM',
              notes: 'No machine punch found for this date'
            }
          });
        }
      }
    }
  }

  console.log('--- Backfill Complete Summary ---');
  console.log(`Present / Late Days: ${presentCount}`);
  console.log(`Incomplete Days (Single punch in past): ${incompleteCount}`);
  console.log(`Approved Leave Days: ${leaveCount}`);
  console.log(`Weekly Off (Sunday) Days: ${weeklyOffCount}`);
  console.log(`Absent Days: ${absentCount}`);
}

if (require.main === module) {
  runBackfill()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { runBackfill };
