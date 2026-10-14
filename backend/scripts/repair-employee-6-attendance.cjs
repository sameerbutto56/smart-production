const prisma = require('../src/prisma');
const { calculateAttendanceMetrics, hasShiftEnded } = require('../src/utils/attendanceUtils');

async function repair() {
  console.log('=== Step 1: Updating EmployeeRecord machineUserId mappings ===');
  await prisma.employeeRecord.update({
    where: { employeeId: '5' },
    data: { machineUserId: '5' }
  });
  console.log('Employee 5 (ALI) updated: machineUserId = 5');

  await prisma.employeeRecord.update({
    where: { employeeId: '6' },
    data: { machineUserId: '6' }
  });
  console.log('Employee 6 (ALI Raza E) updated: machineUserId = 6');

  // Also fix 38 and 39 if present
  const emp38 = await prisma.employeeRecord.findUnique({ where: { employeeId: '38' } });
  if (emp38 && !emp38.machineUserId) {
    await prisma.employeeRecord.update({ where: { employeeId: '38' }, data: { machineUserId: '38' } });
    console.log('Employee 38 (Ali Raza P) updated: machineUserId = 38');
  }

  const emp39 = await prisma.employeeRecord.findUnique({ where: { employeeId: '39' } });
  if (emp39 && !emp39.machineUserId) {
    await prisma.employeeRecord.update({ where: { employeeId: '39' }, data: { machineUserId: '39' } });
    console.log('Employee 39 (Naveed) updated: machineUserId = 39');
  }

  console.log('\n=== Step 2: Updating MachineAttendance records ===');
  const updated6 = await prisma.machineAttendance.updateMany({
    where: { machineUserId: '6' },
    data: {
      employeeId: '6',
      employeeName: 'ALI Raza E',
      status: 'PROCESSED'
    }
  });
  console.log(`Updated ${updated6.count} MachineAttendance rows for machineUserId 6 -> employeeId 6`);

  const updated5 = await prisma.machineAttendance.updateMany({
    where: { machineUserId: '5' },
    data: {
      employeeId: '5',
      employeeName: 'ALI',
      status: 'PROCESSED'
    }
  });
  console.log(`Updated ${updated5.count} MachineAttendance rows for machineUserId 5 -> employeeId 5`);

  console.log('\n=== Step 3: Recomputing EmployeeAttendance for Employee 6 and Employee 5 ===');

  async function recomputeEmployeeAttendance(empId) {
    const emp = await prisma.employeeRecord.findUnique({ where: { employeeId: empId } });
    if (!emp) return;

    const sIn = emp.checkInTime || '10:00';
    const sOut = emp.checkOutTime || '18:00';

    // Fetch all authentic punches for this employee
    const punches = await prisma.machineAttendance.findMany({
      where: {
        employeeId: empId,
        status: { not: 'UNMATCHED' }
      },
      orderBy: { punchTime: 'asc' }
    });

    // Group by date
    const byDate = {};
    for (const p of punches) {
      if (!byDate[p.punchDate]) byDate[p.punchDate] = [];
      byDate[p.punchDate].push(p);
    }

    console.log(`Employee ${empId} (${emp.name}) has ${punches.length} punches across ${Object.keys(byDate).length} dates.`);

    // If empId is 5, check existing attendance dates that now have NO punches
    if (empId === '5') {
      const existingAtt = await prisma.employeeAttendance.findMany({
        where: { employeeId: '5' },
        select: { date: true, id: true }
      });
      for (const att of existingAtt) {
        if (!byDate[att.date]) {
          console.log(`Cleaning up false attendance for Employee 5 on date ${att.date} (was actually Employee 6)`);
          await prisma.employeeAttendance.delete({
            where: { employeeId_date: { employeeId: '5', date: att.date } }
          });
        }
      }
    }

    // Recompute and upsert each date
    let upsertCount = 0;
    for (const [date, datePunches] of Object.entries(byDate)) {
      datePunches.sort((a, b) => a.punchTime.localeCompare(b.punchTime));

      let checkIn = null;
      let checkOut = null;
      let rawPunchIn = null;
      let rawPunchOut = null;
      let checkoutSource = null;
      let isAutoCheckout = false;

      if (datePunches.length === 1) {
        checkIn = datePunches[0].punchTime;
        rawPunchIn = datePunches[0].rawTimestamp || datePunches[0].punchTime;
        if (emp.autoCheckoutEnabled && hasShiftEnded(date, sOut)) {
          checkOut = sOut;
          checkoutSource = 'AUTO_CALCULATED';
          isAutoCheckout = true;
        }
      } else if (datePunches.length > 1) {
        checkIn = datePunches[0].punchTime;
        rawPunchIn = datePunches[0].rawTimestamp || datePunches[0].punchTime;
        checkOut = datePunches[datePunches.length - 1].punchTime;
        rawPunchOut = datePunches[datePunches.length - 1].rawTimestamp || datePunches[datePunches.length - 1].punchTime;
        checkoutSource = 'MACHINE';
      }

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
        'PRESENT',
        { isAutoCheckout }
      );

      let finalStatus = 'PRESENT';
      if (lateMinutes > 0) {
        finalStatus = 'LATE';
      }

      await prisma.employeeAttendance.upsert({
        where: {
          employeeId_date: { employeeId: empId, date }
        },
        update: {
          employeeName: emp.name,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          checkoutSource: checkoutSource || (checkOut ? 'MACHINE' : null),
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
          machineId: 'DS-K1T342MFWX',
          source: 'MACHINE',
          notes: isAutoCheckout
            ? `Biometric punch | Auto-calculated checkout at shift end (${sOut})`
            : `Biometric punch [Punches count: ${datePunches.length}]`
        },
        create: {
          employeeId: empId,
          employeeName: emp.name,
          date,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          checkoutSource: checkoutSource || (checkOut ? 'MACHINE' : null),
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
          machineId: 'DS-K1T342MFWX',
          source: 'MACHINE',
          notes: isAutoCheckout
            ? `Biometric punch | Auto-calculated checkout at shift end (${sOut})`
            : `Biometric punch [Punches count: ${datePunches.length}]`
        }
      });
      upsertCount++;
    }

    console.log(`Successfully recomputed ${upsertCount} attendance days for Employee ${empId} (${emp.name})`);
  }

  await recomputeEmployeeAttendance('6');
  await recomputeEmployeeAttendance('5');

  console.log('\n=== Step 4: Verification of Employee 6 Attendance ===');
  const emp6Attendance = await prisma.employeeAttendance.findMany({
    where: { employeeId: '6' },
    orderBy: { date: 'desc' },
    take: 5
  });
  console.log('Latest 5 attendance records for Employee 6:');
  console.table(emp6Attendance.map(a => ({
    date: a.date,
    checkIn: a.checkInTime,
    checkOut: a.checkOutTime,
    source: a.checkoutSource || a.source,
    status: a.status,
    workingHours: a.workingHours,
    lateMins: a.lateMinutes
  })));

  console.log('\n=== Step 5: Verification of Employee 5 Attendance ===');
  const emp5Attendance = await prisma.employeeAttendance.findMany({
    where: { employeeId: '5' },
    orderBy: { date: 'desc' },
    take: 5
  });
  console.log('Latest 5 attendance records for Employee 5:');
  console.table(emp5Attendance.map(a => ({
    date: a.date,
    checkIn: a.checkInTime,
    checkOut: a.checkOutTime,
    source: a.checkoutSource || a.source,
    status: a.status,
    workingHours: a.workingHours,
    lateMins: a.lateMinutes
  })));

  process.exit(0);
}

repair().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
