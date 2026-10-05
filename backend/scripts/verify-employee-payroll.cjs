const prisma = require('../src/prisma');

async function runTests() {
  console.log('--- Starting Employee Data & Payroll Verification ---');
  let testEmp = null;

  try {
    // 1. Create a Test Employee
    const testEmpId = `TEST-EMP-${Date.now().toString().slice(-4)}`;
    console.log(`\nStep 1: Creating test employee: ${testEmpId}...`);
    testEmp = await prisma.employeeRecord.create({
      data: {
        employeeId: testEmpId,
        name: 'Test Engraving Specialist',
        fatherName: 'Test Father',
        designation: 'Engraving Master',
        department: 'Production',
        branch: 'Railway Road',
        monthlySalary: 60000,
        workingHours: 8,
        checkInTime: '10:00',
        checkOutTime: '18:00',
        fuelAllowance: 3000,
        travelAllowance: 1000,
        otherAllowances: 500,
        loan: 5000,
        advance: 2000,
        otherDeductions: 500,
        productionPercentage: 10,
        workType: 'ENGRAVING',
        status: 'ACTIVE'
      }
    });
    console.log('✓ Employee created:', testEmp.employeeId, testEmp.name, `Salary: ₨ ${testEmp.monthlySalary}`);

    // 2. Test Attendance Calculations & Grace Periods
    console.log('\nStep 2: Testing Attendance Grace Periods & Calculations...');
    const employeeController = require('../src/controllers/employee.controller');

    // Create 3 Late Attendance records (> 15 min grace, e.g. 10:20 AM) to test 3-Late rule
    const currentMonth = new Date().toISOString().slice(0, 7);
    const date1 = `${currentMonth}-01`;
    const date2 = `${currentMonth}-02`;
    const date3 = `${currentMonth}-03`;
    const date4 = `${currentMonth}-04`;

    // Record 1: Late (10:25 AM check-in, scheduled 10:00 AM -> 25 mins late)
    await prisma.employeeAttendance.upsert({
      where: { employeeId_date: { employeeId: testEmpId, date: date1 } },
      create: {
        employeeId: testEmpId,
        employeeName: testEmp.name,
        date: date1,
        checkInTime: '10:25',
        checkOutTime: '18:00',
        scheduledCheckIn: '10:00',
        scheduledCheckOut: '18:00',
        lateMinutes: 25,
        earlyMinutes: 0,
        overtimeMinutes: 0,
        status: 'LATE',
        workingHours: 7.58
      },
      update: {}
    });

    // Record 2: Late (10:30 AM check-in -> 30 mins late)
    await prisma.employeeAttendance.upsert({
      where: { employeeId_date: { employeeId: testEmpId, date: date2 } },
      create: {
        employeeId: testEmpId,
        employeeName: testEmp.name,
        date: date2,
        checkInTime: '10:30',
        checkOutTime: '18:00',
        scheduledCheckIn: '10:00',
        scheduledCheckOut: '18:00',
        lateMinutes: 30,
        earlyMinutes: 0,
        overtimeMinutes: 0,
        status: 'LATE',
        workingHours: 7.5
      },
      update: {}
    });

    // Record 3: Late (10:20 AM check-in -> 20 mins late)
    await prisma.employeeAttendance.upsert({
      where: { employeeId_date: { employeeId: testEmpId, date: date3 } },
      create: {
        employeeId: testEmpId,
        employeeName: testEmp.name,
        date: date3,
        checkInTime: '10:20',
        checkOutTime: '18:00',
        scheduledCheckIn: '10:00',
        scheduledCheckOut: '18:00',
        lateMinutes: 20,
        earlyMinutes: 0,
        overtimeMinutes: 0,
        status: 'LATE',
        workingHours: 7.67
      },
      update: {}
    });

    // Record 4: On Time with Overtime (10:10 AM check-in [within 15m grace!], 19:00 check-out [60 mins overtime!])
    await prisma.employeeAttendance.upsert({
      where: { employeeId_date: { employeeId: testEmpId, date: date4 } },
      create: {
        employeeId: testEmpId,
        employeeName: testEmp.name,
        date: date4,
        checkInTime: '10:10',
        checkOutTime: '19:00',
        scheduledCheckIn: '10:00',
        scheduledCheckOut: '18:00',
        lateMinutes: 0, // Grace period applied!
        earlyMinutes: 0,
        overtimeMinutes: 60,
        status: 'PRESENT',
        workingHours: 8.83
      },
      update: {}
    });

    console.log('✓ 4 Attendance records created with 3 lates and 1 overtime record.');

    // 3. Test Monthly Payroll Calculation
    console.log('\nStep 3: Calculating Monthly Payroll...');
    // Mock req, res
    const mockReq = {
      body: { monthYear: currentMonth, employeeId: testEmpId },
      user: { name: 'AdminTester' }
    };
    let payrollResponse = null;
    const mockRes = {
      json: (data) => { payrollResponse = data; return mockRes; },
      status: (code) => { console.log('Response Status:', code); return mockRes; }
    };

    await employeeController.calculateMonthlyPayroll(mockReq, mockRes);

    if (!payrollResponse || !payrollResponse.success) {
      throw new Error(`Payroll calculation failed: ${JSON.stringify(payrollResponse)}`);
    }

    const payroll = await prisma.monthlyPayroll.findUnique({
      where: { employeeId_monthYear: { employeeId: testEmpId, monthYear: currentMonth } }
    });

    console.log('✓ Monthly Payroll calculated:');
    console.log('  Basic Salary:', payroll.basicSalary);
    console.log('  Fuel Allowance:', payroll.fuelAllowance);
    console.log('  Three-Late Deductions:', payroll.lateDeductions);
    console.log('  Loan Recovery:', payroll.loanDeduction);
    console.log('  Advance Recovery:', payroll.advanceDeduction);
    console.log('  Gross Salary:', payroll.grossSalary);
    console.log('  Total Deductions:', payroll.totalDeductions);
    console.log('  Net Payable:', payroll.netPayable);

    // Verify Three-Late Rule: 3 lates / 3 = 1 Day Penalty
    // 1 Day Salary = 60,000 / 30 = 2,000
    if (payroll.lateDeductions !== 2000) {
      throw new Error(`Expected lateDeductions to be 2000 (1 day salary), but got ${payroll.lateDeductions}`);
    }
    console.log('✓ Three-Late Rule Verification Passed: 3 lates correctly resulted in 1 Day (₨ 2,000) deduction!');

    // 4. Test Finalizing & Freezing Payroll
    console.log('\nStep 4: Finalizing & Freezing Monthly Payroll...');
    const finalizeReq = {
      body: { monthYear: currentMonth },
      user: { name: 'Admin' }
    };
    let finalizeResponse = null;
    const finalizeRes = {
      json: (data) => { finalizeResponse = data; return finalizeRes; },
      status: (code) => finalizeRes
    };

    await employeeController.finalizeMonthlyPayroll(finalizeReq, finalizeRes);
    const finalizedRecord = await prisma.monthlyPayroll.findUnique({
      where: { employeeId_monthYear: { employeeId: testEmpId, monthYear: currentMonth } }
    });

    if (!finalizedRecord.isFinalized || finalizedRecord.status !== 'FINALIZED') {
      throw new Error('Payroll record should be marked as finalized');
    }
    console.log('✓ Payroll record is permanently frozen (isFinalized: true).');

    console.log('\n🎉 ALL EMPLOYEE & PAYROLL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification Error:', err);
    process.exit(1);
  } finally {
    // Cleanup test data
    if (testEmp) {
      console.log('\nCleaning up test records...');
      await prisma.employeeAttendance.deleteMany({ where: { employeeId: testEmp.employeeId } }).catch(() => {});
      await prisma.monthlyPayroll.deleteMany({ where: { employeeId: testEmp.employeeId } }).catch(() => {});
      await prisma.employeeRecord.deleteMany({ where: { employeeId: testEmp.employeeId } }).catch(() => {});
      console.log('Cleaned up test data.');
    }
    await prisma.$disconnect();
  }
}

runTests();
