const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/prisma');
const { calculateAttendanceMetrics, parseTimeToMinutes } = require('../src/utils/attendanceUtils');
const { parseMachineDateTime, findEmployeeByIdentifier } = require('../src/controllers/biometric.controller');

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING EMPLOYEE ATTENDANCE & MACHINE INTEGRATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Check-In Grace Period (Section 4: 15-min grace)
  console.log('--- TEST 1: Check-In Grace Period & Late Calculation ---');
  {
    // 10:15 -> On Time (0 late mins)
    const m1 = calculateAttendanceMetrics('10:00', '18:00', '10:15', '18:00', 'PRESENT');
    assert(m1.lateMinutes === 0, 'Check-in at 10:15 has 0 late minutes (On Time)');

    // 10:16 -> 1 late min
    const m2 = calculateAttendanceMetrics('10:00', '18:00', '10:16', '18:00', 'PRESENT');
    assert(m2.lateMinutes === 1, 'Check-in at 10:16 has 1 late minute');

    // 10:20 -> 5 late mins
    const m3 = calculateAttendanceMetrics('10:00', '18:00', '10:20', '18:00', 'PRESENT');
    assert(m3.lateMinutes === 5, 'Check-in at 10:20 has 5 late minutes');

    // 10:35 -> 20 late mins
    const m4 = calculateAttendanceMetrics('10:00', '18:00', '10:35', '18:00', 'PRESENT');
    assert(m4.lateMinutes === 20, 'Check-in at 10:35 has 20 late minutes');
  }

  // TEST 2: Early Check-In Overtime (Section 4: 10-min tolerance)
  console.log('\n--- TEST 2: Early Check-In Overtime (10-min tolerance) ---');
  {
    // 09:50 -> 10m early, 0m early OT (within 10m tolerance)
    const m1 = calculateAttendanceMetrics('10:00', '18:00', '09:50', '18:00', 'PRESENT');
    assert(m1.earlyArrivalMinutes === 10, 'Check-in at 09:50 has 10m early arrival');
    assert(m1.earlyCheckInOt === 0, 'Check-in at 09:50 has 0m early OT (within tolerance)');

    // 09:40 -> 20m early, 10m early OT
    const m2 = calculateAttendanceMetrics('10:00', '18:00', '09:40', '18:00', 'PRESENT');
    assert(m2.earlyArrivalMinutes === 20, 'Check-in at 09:40 has 20m early arrival');
    assert(m2.earlyCheckInOt === 10, 'Check-in at 09:40 has 10m early OT');

    // 09:00 -> 60m early, 50m early OT
    const m3 = calculateAttendanceMetrics('10:00', '18:00', '09:00', '18:00', 'PRESENT');
    assert(m3.earlyArrivalMinutes === 60, 'Check-in at 09:00 has 60m early arrival');
    assert(m3.earlyCheckInOt === 50, 'Check-in at 09:00 has 50m early OT');
  }

  // TEST 3: Checkout Overtime (Section 4: 15-min tolerance)
  console.log('\n--- TEST 3: Checkout Overtime (15-min tolerance) ---');
  {
    // 18:15 -> 0m checkout OT
    const m1 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '18:15', 'PRESENT');
    assert(m1.checkoutOtMinutes === 0, 'Checkout at 18:15 has 0m checkout OT (within 15m tolerance)');

    // 18:16 -> 1m checkout OT
    const m2 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '18:16', 'PRESENT');
    assert(m2.checkoutOtMinutes === 1, 'Checkout at 18:16 has 1m checkout OT');

    // 18:30 -> 15m checkout OT
    const m3 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '18:30', 'PRESENT');
    assert(m3.checkoutOtMinutes === 15, 'Checkout at 18:30 has 15m checkout OT');
  }

  // TEST 4: Early Checkout (Section 4: 10-min tolerance)
  console.log('\n--- TEST 4: Early Checkout (10-min tolerance) ---');
  {
    // 17:55 -> 0m early checkout
    const m1 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '17:55', 'PRESENT');
    assert(m1.earlyMinutes === 0, 'Checkout at 17:55 has 0m early checkout');

    // 17:50 -> 0m early checkout
    const m2 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '17:50', 'PRESENT');
    assert(m2.earlyMinutes === 0, 'Checkout at 17:50 has 0m early checkout (at 10m boundary)');

    // 17:49 -> 11m early checkout (18:00 - 17:49)
    const m3 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '17:49', 'PRESENT');
    assert(m3.earlyMinutes === 11, 'Checkout at 17:49 has 11m early checkout');
  }

  // TEST 5: Total Daily Overtime Summation
  console.log('\n--- TEST 5: Total Daily Overtime ---');
  {
    // In at 09:40 (10m OT), Out at 18:30 (15m OT) -> 25m total OT
    const m = calculateAttendanceMetrics('10:00', '18:00', '09:40', '18:30', 'PRESENT');
    assert(m.overtimeMinutes === 25, 'Total overtime = 10m early OT + 15m checkout OT = 25m');
  }

  // TEST 6: Worked Hours & Missing Checkout Handling
  console.log('\n--- TEST 6: Worked Hours & Missing Checkout Handling ---');
  {
    // In at 10:00, Out at 18:30 -> 8.5h
    const m1 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '18:30', 'PRESENT');
    assert(m1.workingHours === 8.5, 'Worked hours from 10:00 to 18:30 is 8.5h');

    // Missing checkout (null) -> 0h (never default to 8h)
    const m2 = calculateAttendanceMetrics('10:00', '18:00', '10:00', null, 'PRESENT');
    assert(m2.workingHours === 0, 'Worked hours with missing checkout is 0h (no fake default)');
  }

  // TEST 7: Timestamp Parsing & Timezone Contract (Asia/Karachi)
  console.log('\n--- TEST 7: Timestamp Parsing & Timezone Contract ---');
  {
    const dt1 = parseMachineDateTime('2026-10-08 10:14:24');
    assert(dt1.date === '2026-10-08', 'Date preserved exactly: 2026-10-08');
    assert(dt1.timeStr === '10:14:24', 'Time preserved exactly: 10:14:24');

    const dt2 = parseMachineDateTime('2026-10-08T18:39:36+05:00');
    assert(dt2.date === '2026-10-08', 'Date with +05:00 preserved: 2026-10-08');
    assert(dt2.timeStr === '18:39:36', 'Time with +05:00 preserved: 18:39:36');
  }

  // TEST 8: Real Database Verification — Mapped Employees & Punches
  console.log('\n--- TEST 8: Database Integrity & Machine Users Mapping ---');
  {
    const activeEmps = await prisma.employeeRecord.findMany({ where: { status: 'ACTIVE' } });
    assert(activeEmps.length >= 33, `Active employees in DB: ${activeEmps.length} (all staff registered)`);

    const totalRaw = await prisma.machineAttendance.count();
    const unmatchedCount = await prisma.machineAttendance.count({ where: { status: 'UNMATCHED' } });
    assert(totalRaw > 2000, `Total raw machine punches: ${totalRaw}`);
    assert(unmatchedCount === 0, `Unmatched punches count is 0 (100% punches mapped)`);

    // Sajawal mapping check (02 vs 2)
    const sajawal = activeEmps.find(e => e.employeeId === '02' || e.name.includes('SAJAWAL'));
    assert(Boolean(sajawal), 'MUHAMMAD SAJAWAL found in EmployeeRecord');
    if (sajawal) {
      assert(sajawal.employeeId === '02', 'Sajawal employeeId is "02"');
      assert(sajawal.checkInTime === '10:00', 'Sajawal shift start is 10:00');
      assert(sajawal.checkOutTime === '18:30', 'Sajawal shift end is 18:30');
    }
  }

  // TEST 9: Historical Backfill Verification (1 Sep to 8 Oct)
  console.log('\n--- TEST 9: Historical Backfill Verification (2026-10-01 to 2026-10-08) ---');
  {
    const octRecords = await prisma.employeeAttendance.findMany({
      where: {
        date: { gte: '2026-10-01', lte: '2026-10-08' }
      }
    });
    assert(octRecords.length > 0, `EmployeeAttendance has ${octRecords.length} records for Oct 1-8`);

    const sajawalOct = octRecords.filter(r => r.employeeId === '02');
    assert(sajawalOct.length === 8, `Sajawal has all 8 daily records for Oct 1-8`);

    // Sajawal on Oct 2: In: 10:13:25, Out: 18:39:36
    const oct2 = sajawalOct.find(r => r.date === '2026-10-02');
    assert(Boolean(oct2 && oct2.checkInTime === '10:13:25'), 'Sajawal Oct 2 checkInTime is exact: 10:13:25');
    assert(Boolean(oct2 && oct2.checkOutTime === '18:39:36'), 'Sajawal Oct 2 checkOutTime is exact: 18:39:36');
    assert(Boolean(oct2 && oct2.status === 'PRESENT'), 'Sajawal Oct 2 status is PRESENT');

    // Sajawal on Oct 4: Sunday -> Weekly Off
    const oct4 = sajawalOct.find(r => r.date === '2026-10-04');
    assert(Boolean(oct4 && oct4.status === 'WEEKLY_OFF'), 'Sajawal Oct 4 (Sunday) is WEEKLY_OFF');
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
