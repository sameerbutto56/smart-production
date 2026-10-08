/**
 * Comprehensive Verification Script:
 * Real Attendance Machine Single Source of Truth,
 * Zero Fake Data Guarantee, Raw Logs Audit & Recalculation Engine
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/prisma');
const {
  parseMachineDateTime,
  processEmployeePunch,
  recalculateAttendanceRange,
  getRawMachinePunches
} = require('../src/controllers/biometric.controller');

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 RUNNING VERIFICATION: REAL ATTENDANCE MACHINE ENGINE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, title, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      if (details) console.log(`   ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error(`   ${details}`);
      process.exitCode = 1;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Operating Timezone and Exact Timestamp Preservation
    // -------------------------------------------------------------
    console.log('--- TEST 1: Exact Machine Timestamp Parsing (Zero Shifts/Rounding) ---');
    const punchA = parseMachineDateTime('2026-10-08 10:00:25');
    assert(
      punchA.date === '2026-10-08' && punchA.timeStr === '10:00:25' && punchA.rawTimestamp === '2026-10-08 10:00:25',
      'Preserves exact local machine timestamp with seconds in Asia/Karachi',
      `Parsed: date=${punchA.date}, timeStr=${punchA.timeStr}, raw=${punchA.rawTimestamp}`
    );

    const punchB = parseMachineDateTime('10:00:25');
    assert(
      punchB.timeStr === '10:00:25' && punchB.rawTimestamp === '10:00:25',
      'Time-only string "10:00:25" parses exact time without arbitrary offset',
      `Parsed: timeStr=${punchB.timeStr}`
    );

    // -------------------------------------------------------------
    // Test 2: Active Employee Roster & Machine User ID Mappings
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Active Employees Machine User ID Mappings ---');
    const activeEmployees = await prisma.employeeRecord.findMany({
      where: { status: 'ACTIVE' },
      select: { employeeId: true, machineUserId: true, name: true, branch: true }
    });
    assert(
      activeEmployees.length >= 9,
      `Active employee roster verified in database (${activeEmployees.length} employees)`,
      activeEmployees.map(e => `#${e.employeeId} (${e.machineUserId || e.employeeId}) ${e.name}`).join(', ')
    );

    // -------------------------------------------------------------
    // Test 3: Raw Machine Punches vs Single Source of Truth
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Punch Ingestion & Real First/Last Punch Derivation ---');
    const testEmp = activeEmployees[0];
    const testDate = '2026-09-15';

    // Cleanup any prior test data for this specific test date
    await prisma.machineAttendance.deleteMany({
      where: { employeeId: testEmp.employeeId, punchDate: testDate }
    });
    await prisma.employeeAttendance.deleteMany({
      where: { employeeId: testEmp.employeeId, date: testDate }
    });

    // Ingest Punch 1 (Morning Check-In at 09:45:10 - 15m early arrival -> 5m early OT)
    const result1 = await processEmployeePunch({
      employeeId: testEmp.employeeId,
      machineUserId: testEmp.machineUserId || testEmp.employeeId,
      employeeName: testEmp.name,
      date: testDate,
      timeStr: '09:45:10',
      rawTimestamp: `${testDate} 09:45:10`,
      source: 'MACHINE',
      verifyMode: 'FINGERPRINT',
      deviceId: 'TEST_TERMINAL'
    });

    assert(
      result1.record.checkInTime === '09:45:10' &&
      result1.record.checkOutTime === null &&
      result1.record.source === 'MACHINE' &&
      result1.record.status === 'PRESENT',
      'Single punch correctly sets Check-In and leaves Check-Out as null',
      `Check-In: ${result1.record.checkInTime}, Check-Out: ${result1.record.checkOutTime}`
    );

    // Query testEmp scheduled shift to calculate checkout punch that triggers checkout OT
    const empRecord = await prisma.employeeRecord.findUnique({ where: { employeeId: testEmp.employeeId } });
    const sOutMins = empRecord.checkOutTime ? (parseInt(empRecord.checkOutTime.split(':')[0], 10) * 60 + parseInt(empRecord.checkOutTime.split(':')[1], 10)) : 18 * 60;
    const checkoutMins = sOutMins + 35; // 35m past shift (exceeds 15m tolerance -> 20m OT)
    const outH = String(Math.floor(checkoutMins / 60)).padStart(2, '0');
    const outM = String(checkoutMins % 60).padStart(2, '0');
    const punchOutTimeStr = `${outH}:${outM}:00`;

    // Ingest Punch 2 (Afternoon Checkout triggering checkout OT)
    const result2 = await processEmployeePunch({
      employeeId: testEmp.employeeId,
      machineUserId: testEmp.machineUserId || testEmp.employeeId,
      employeeName: testEmp.name,
      date: testDate,
      timeStr: punchOutTimeStr,
      rawTimestamp: `${testDate} ${punchOutTimeStr}`,
      source: 'MACHINE',
      verifyMode: 'FINGERPRINT',
      deviceId: 'TEST_TERMINAL'
    });

    assert(
      result2.record.checkInTime === '09:45:10' &&
      result2.record.checkOutTime === punchOutTimeStr &&
      result2.record.earlyCheckInOt > 0 &&
      result2.record.checkoutOtMinutes > 0,
      'Multiple punches derive first punch as Check-In and last punch as Check-Out with overtime',
      `Check-In: ${result2.record.checkInTime}, Check-Out: ${result2.record.checkOutTime}, Early OT: ${result2.record.earlyCheckInOt}m, Checkout OT: ${result2.record.checkoutOtMinutes}m`
    );

    // -------------------------------------------------------------
    // Test 4: Verification Endpoint: Raw Logs vs Calculated Attendance
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Raw Machine Punches vs Calculated Verification Endpoint ---');
    const mockReq = {
      query: { date: testDate, employeeId: testEmp.employeeId }
    };
    let jsonResponse = null;
    const mockRes = {
      json: (data) => { jsonResponse = data; },
      status: () => mockRes
    };

    await getRawMachinePunches(mockReq, mockRes);
    assert(
      jsonResponse &&
      jsonResponse.success === true &&
      jsonResponse.rawPunchesCount >= 2 &&
      jsonResponse.calculatedCount === 1,
      'Verification endpoint returns side-by-side raw machine punches and calculated record',
      `Raw punches: ${jsonResponse.rawPunchesCount}, Calculated records: ${jsonResponse.calculatedCount}`
    );

    // -------------------------------------------------------------
    // Test 5: Zero Fake Data Guarantee on Recalculation
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Zero Fake Data / Absent Guarantee on Recalculation ---');
    const emptyDate = '2026-09-16'; // Date with 0 punches
    await prisma.machineAttendance.deleteMany({ where: { punchDate: emptyDate } });
    await prisma.employeeAttendance.deleteMany({ where: { date: emptyDate } });

    const recalcReq = {
      body: { startDate: emptyDate, endDate: emptyDate }
    };
    let recalcResponse = null;
    const recalcRes = {
      json: (data) => { recalcResponse = data; },
      status: () => recalcRes
    };

    await recalculateAttendanceRange(recalcReq, recalcRes);

    const emptyAttRecords = await prisma.employeeAttendance.findMany({
      where: { date: emptyDate }
    });

    const hasAnyFakeTime = emptyAttRecords.some(r => r.checkInTime !== null || r.checkOutTime !== null);
    const allMarkedNoMachine = emptyAttRecords.every(r => r.notes === 'No machine record' || r.notes.includes('Leave'));

    assert(
      !hasAnyFakeTime && allMarkedNoMachine,
      'Recalculation with no machine punches produces ZERO fake times and sets "No machine record"',
      `Checked ${emptyAttRecords.length} records. Fake check-in times found: ${hasAnyFakeTime ? 'YES' : 'NONE'}`
    );

    // Clean up test dates
    await prisma.machineAttendance.deleteMany({
      where: { employeeId: testEmp.employeeId, punchDate: testDate }
    });
    await prisma.employeeAttendance.deleteMany({
      where: { employeeId: testEmp.employeeId, date: testDate }
    });
    await prisma.employeeAttendance.deleteMany({
      where: { date: emptyDate }
    });

    console.log('\n================================================================');
    console.log(`🎯 VERIFICATION SUMMARY: ${passed}/${total} TESTS PASSED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal error during verification:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
