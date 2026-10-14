const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { hasShiftEnded, calculateAttendanceMetrics } = require('../src/utils/attendanceUtils');
const { processEmployeePunch } = require('../src/controllers/biometric.controller');

async function runVerification() {
  console.log('====================================================');
  console.log('VERIFYING AUTOMATIC CHECKOUT FOR SELECTED EMPLOYEES');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const testEmpDisabledId = 'TEST_EMP_DIS_99';
  const testEmpEnabledId = 'TEST_EMP_ENA_99';
  const testDatePast = '2026-10-01'; // Past date where shift is guaranteed ended

  try {
    // Clean up any existing test records
    await prisma.machineAttendance.deleteMany({
      where: { employeeId: { in: [testEmpDisabledId, testEmpEnabledId] } }
    }).catch(() => {});
    await prisma.employeeAttendance.deleteMany({
      where: { employeeId: { in: [testEmpDisabledId, testEmpEnabledId] } }
    }).catch(() => {});
    await prisma.employeeRecord.deleteMany({
      where: { employeeId: { in: [testEmpDisabledId, testEmpEnabledId] } }
    }).catch(() => {});

    // ----------------------------------------------------
    // TEST 1: Employee Persistence with autoCheckoutEnabled
    // ----------------------------------------------------
    console.log('--- Test 1: Employee Settings Persistence ---');
    const empDisabled = await prisma.employeeRecord.create({
      data: {
        employeeId: testEmpDisabledId,
        name: 'Auto Checkout Disabled Test',
        checkInTime: '10:00',
        checkOutTime: '18:00',
        status: 'ACTIVE',
        autoCheckoutEnabled: false
      }
    });
    assert(empDisabled.autoCheckoutEnabled === false, 'Default / Disabled employee record has autoCheckoutEnabled: false');

    const empEnabled = await prisma.employeeRecord.create({
      data: {
        employeeId: testEmpEnabledId,
        name: 'Auto Checkout Enabled Test',
        checkInTime: '10:00',
        checkOutTime: '18:00',
        status: 'ACTIVE',
        autoCheckoutEnabled: true
      }
    });
    assert(empEnabled.autoCheckoutEnabled === true, 'Enabled employee record has autoCheckoutEnabled: true');

    // ----------------------------------------------------
    // TEST 2: Shift End Calculation & Timezone Validation
    // ----------------------------------------------------
    console.log('\n--- Test 2: Shift End Calculation (Asia/Karachi) ---');
    const pastShiftEnded = hasShiftEnded('2026-10-01', '18:00');
    assert(pastShiftEnded === true, 'hasShiftEnded returns true for past dates');

    const futureShiftEnded = hasShiftEnded('2099-12-31', '18:00');
    assert(futureShiftEnded === false, 'hasShiftEnded returns false for future dates');

    // ----------------------------------------------------
    // TEST 3: Case A - Auto Checkout Disabled
    // ----------------------------------------------------
    console.log('\n--- Test 3: Case A - Single Punch with Auto Checkout Disabled ---');
    // Simulate real machine morning punch
    await processEmployeePunch({
      employeeId: testEmpDisabledId,
      employeeName: empDisabled.name,
      date: testDatePast,
      timeStr: '10:05:00',
      verifyMode: 'FACE'
    });

    const attDisabled = await prisma.employeeAttendance.findUnique({
      where: { employeeId_date: { employeeId: testEmpDisabledId, date: testDatePast } }
    });
    assert(attDisabled !== null, 'Attendance record created for disabled employee');
    assert(attDisabled.checkInTime === '10:05:00', 'Check-in time recorded accurately');
    assert(attDisabled.checkOutTime === null, 'Check-out time remains NULL (no invented times)');
    assert(attDisabled.checkoutSource !== 'AUTO_CALCULATED', 'Checkout source is NOT AUTO_CALCULATED');

    // ----------------------------------------------------
    // TEST 4: Case B - Single Punch with Auto Checkout Enabled
    // ----------------------------------------------------
    console.log('\n--- Test 4: Case B - Single Punch with Auto Checkout Enabled ---');
    await processEmployeePunch({
      employeeId: testEmpEnabledId,
      employeeName: empEnabled.name,
      date: testDatePast,
      timeStr: '10:05:00',
      verifyMode: 'FINGERPRINT'
    });

    const attEnabled = await prisma.employeeAttendance.findUnique({
      where: { employeeId_date: { employeeId: testEmpEnabledId, date: testDatePast } }
    });
    assert(attEnabled !== null, 'Attendance record created for enabled employee');
    assert(attEnabled.checkInTime === '10:05:00', 'Check-in time recorded accurately');
    assert(attEnabled.checkOutTime === '18:00', 'Check-out automatically assigned to scheduled checkout (18:00)');
    assert(attEnabled.checkoutSource === 'AUTO_CALCULATED', 'Checkout source marked as AUTO_CALCULATED');
    assert(attEnabled.earlyMinutes === 0, 'No early checkout penalty applied (earlyMinutes === 0)');
    assert(attEnabled.checkoutOtMinutes === 0, 'No checkout overtime awarded (checkoutOtMinutes === 0)');
    assert(attEnabled.workingHours > 7.5 && attEnabled.workingHours < 8.5, `Working hours calculated accurately (${attEnabled.workingHours} hrs)`);

    // Verify raw machine punches purity
    const rawPunchesEnabled = await prisma.machineAttendance.findMany({
      where: { employeeId: testEmpEnabledId, punchDate: testDatePast }
    });
    assert(rawPunchesEnabled.length === 1, 'Only 1 raw machine punch exists (NEVER inserts fake punch into MachineAttendance)');
    assert(rawPunchesEnabled[0].punchTime === '10:05:00', 'Raw punch is strictly the genuine physical check-in punch');

    // ----------------------------------------------------
    // TEST 5: Subsequent Real Machine Checkout Punch Takes Precedence
    // ----------------------------------------------------
    console.log('\n--- Test 5: Real Machine Checkout Override Precedence ---');
    // Employee actually punched out at 18:25:00 on the machine
    await processEmployeePunch({
      employeeId: testEmpEnabledId,
      employeeName: empEnabled.name,
      date: testDatePast,
      timeStr: '18:25:00',
      verifyMode: 'FINGERPRINT'
    });

    const attOverridden = await prisma.employeeAttendance.findUnique({
      where: { employeeId_date: { employeeId: testEmpEnabledId, date: testDatePast } }
    });
    assert(attOverridden.checkOutTime === '18:25:00', 'Real machine punch (18:25:00) overrides auto-calculated checkout');
    assert(attOverridden.checkoutSource === 'MACHINE', 'checkoutSource updated from AUTO_CALCULATED to MACHINE');
    const rawPunchesUpdated = await prisma.machineAttendance.findMany({
      where: { employeeId: testEmpEnabledId, punchDate: testDatePast }
    });
    assert(rawPunchesUpdated.length === 2, 'MachineAttendance now contains both genuine machine punches');

    // ----------------------------------------------------
    // TEST 6: Zero Check-in -> Never Generate Auto Checkout
    // ----------------------------------------------------
    console.log('\n--- Test 6: Absent Employee (No Check-in) Rule ---');
    const absentDate = '2026-10-02';
    // Run recalculation or check for absent employee with autoCheckoutEnabled: true
    const { recalculateAttendanceRange } = require('../src/controllers/biometric.controller');
    const mockReq = {
      body: {
        startDate: absentDate,
        endDate: absentDate,
        employeeId: testEmpEnabledId
      }
    };
    let jsonResult = null;
    const mockRes = {
      json: (data) => { jsonResult = data; },
      status: () => mockRes
    };
    await recalculateAttendanceRange(mockReq, mockRes);

    const attAbsent = await prisma.employeeAttendance.findUnique({
      where: { employeeId_date: { employeeId: testEmpEnabledId, date: absentDate } }
    });
    assert(attAbsent !== null, 'Attendance record generated for date');
    assert(attAbsent.checkInTime === null, 'Check-in is null');
    assert(attAbsent.checkOutTime === null, 'Check-out is null (Never generates auto-checkout without check-in)');
    assert(attAbsent.status === 'ABSENT', 'Status is ABSENT');

    console.log('\n====================================================');
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log('====================================================\n');
  } finally {
    // Clean up test data
    await prisma.machineAttendance.deleteMany({
      where: { employeeId: { in: [testEmpDisabledId, testEmpEnabledId] } }
    }).catch(() => {});
    await prisma.employeeAttendance.deleteMany({
      where: { employeeId: { in: [testEmpDisabledId, testEmpEnabledId] } }
    }).catch(() => {});
    await prisma.employeeRecord.deleteMany({
      where: { employeeId: { in: [testEmpDisabledId, testEmpEnabledId] } }
    }).catch(() => {});
    await prisma.$disconnect();
  }
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
