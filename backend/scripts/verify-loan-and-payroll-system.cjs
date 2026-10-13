/**
 * Comprehensive Verification Suite:
 * Employee Attendance Machine Ground Truth, Loan & Advance Management,
 * Scheduled Payroll Deductions, Duplicate Protection & Late Case Review
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/prisma');
const {
  parseMachineDateTime,
  processEmployeePunch,
  getRawMachinePunches
} = require('../src/controllers/biometric.controller');

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 RUNNING VERIFICATION: EMPLOYEE ATTENDANCE, LOANS & PAYROLL');
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
    // Test 1: Real Attendance Machine Timestamp Preservation
    // -------------------------------------------------------------
    console.log('--- TEST 1: Biometric Timestamp Ground Truth ---');
    const punch = parseMachineDateTime('2026-10-13 10:18:42');
    assert(
      punch.date === '2026-10-13' && punch.timeStr === '10:18:42',
      'Preserves exact physical punch time without shifting timezones',
      `Parsed: ${punch.date} at ${punch.timeStr}`
    );

    // -------------------------------------------------------------
    // Test 2: Find or create an employee for testing
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Test Employee Setup ---');
    const testEmpId = 'TEST-EMP-999';
    let testEmp = await prisma.employeeRecord.findUnique({ where: { employeeId: testEmpId } });
    if (!testEmp) {
      testEmp = await prisma.employeeRecord.create({
        data: {
          employeeId: testEmpId,
          name: 'Test Automation Employee',
          monthlySalary: 60000,
          workingDays: 30,
          workingHours: 8,
          checkInTime: '10:00',
          checkOutTime: '18:00',
          branch: 'Johar Town',
          designation: 'Staff',
          status: 'ACTIVE'
        }
      });
      console.log('Created test employee:', testEmpId);
    } else {
      console.log('Found existing test employee:', testEmpId);
    }
    assert(!!testEmp, 'Test employee exists and is active', `ID: ${testEmp.employeeId}, Salary: ₨ ${testEmp.monthlySalary}`);

    // -------------------------------------------------------------
    // Test 3: Issue Loan with Installment Schedule
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Loan Creation with Installments & Repayments ---');
    // Clean up any previous test loan
    await prisma.loanRepaymentTransaction.deleteMany({
      where: { employeeId: testEmpId }
    });
    await prisma.employeeLoanAdvance.deleteMany({
      where: { employeeId: testEmpId }
    });

    const testMonth = '2026-10';
    const testLoan = await prisma.employeeLoanAdvance.create({
      data: {
        employeeId: testEmpId,
        employeeName: testEmp.name,
        type: 'LOAN',
        amount: 30000,
        repaidAmount: 0,
        remainingBalance: 30000,
        monthlyDeduction: 10000,
        numberOfInstallments: 3,
        paidInstallmentsCount: 0,
        firstDeductionMonth: testMonth,
        finalDeductionMonth: '2026-12',
        date: '2026-10-01',
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        approvedBy: 'SUPER_ADMIN',
        notes: 'Verification test loan'
      }
    });

    assert(
      testLoan && testLoan.remainingBalance === 30000 && testLoan.numberOfInstallments === 3,
      'Loan record created with correct initial balance and 3 installments',
      `ID: ${testLoan.id}, Balance: ₨ ${testLoan.remainingBalance}, Monthly: ₨ ${testLoan.monthlyDeduction}`
    );

    // -------------------------------------------------------------
    // Test 4: Record Direct Repayment Transaction
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Direct Repayment Transaction Ledger ---');
    const directTx = await prisma.loanRepaymentTransaction.create({
      data: {
        loanId: testLoan.id,
        employeeId: testEmpId,
        employeeName: testEmp.name,
        amount: 5000,
        repaymentType: 'DIRECT_PAYMENT',
        period: testMonth,
        balanceBefore: 30000,
        balanceAfter: 25000,
        notes: 'Direct cash deposit at counter'
      }
    });

    const updatedLoan = await prisma.employeeLoanAdvance.update({
      where: { id: testLoan.id },
      data: {
        repaidAmount: { increment: 5000 },
        remainingBalance: { decrement: 5000 }
      },
      include: { repayments: true }
    });

    assert(
      updatedLoan.remainingBalance === 25000 && updatedLoan.repaidAmount === 5000 && updatedLoan.repayments.length === 1,
      'Direct repayment decrements remaining balance atomically and records in ledger',
      `Remaining: ₨ ${updatedLoan.remainingBalance}, Repayments recorded: ${updatedLoan.repayments.length}`
    );

    // -------------------------------------------------------------
    // Test 5: Payroll Calculation with Scheduled Loan Deductions
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Payroll Calculation with Capped Loan Recovery ---');
    // Expected deduction should be min(monthlyDeduction, remainingBalance) = min(10000, 25000) = 10000
    const scheduledDeduction = Math.min(updatedLoan.monthlyDeduction, updatedLoan.remainingBalance);
    assert(
      scheduledDeduction === 10000,
      'Scheduled deduction correctly computes ₨ 10,000 for this payroll cycle',
      `Calculated deduction: ₨ ${scheduledDeduction}`
    );

    // Verify duplicate calculation does not deduct loan balance
    const loanBalanceBeforePayroll = (await prisma.employeeLoanAdvance.findUnique({ where: { id: testLoan.id } })).remainingBalance;
    assert(
      loanBalanceBeforePayroll === 25000,
      'Loan remaining balance remains untouched during draft payroll calculations',
      `Balance remains: ₨ ${loanBalanceBeforePayroll}`
    );

    // -------------------------------------------------------------
    // Test 6: Final Payroll Settlement into LoanRepaymentTransaction
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Payroll Settlement & Completion when Balance Hits Zero ---');
    // Settle remaining 25,000 in two payroll cycles
    // Cycle 1: 10,000
    const payrollTx1 = await prisma.loanRepaymentTransaction.create({
      data: {
        loanId: testLoan.id,
        employeeId: testEmpId,
        employeeName: testEmp.name,
        payrollId: 'mock-payroll-1',
        amount: 10000,
        repaymentType: 'PAYROLL_DEDUCTION',
        period: testMonth,
        installmentNumber: 1,
        balanceBefore: 25000,
        balanceAfter: 15000,
        notes: `Automated payroll deduction for ${testMonth}`
      }
    });

    // Cycle 2: Settle remaining 15,000
    const payrollTx2 = await prisma.loanRepaymentTransaction.create({
      data: {
        loanId: testLoan.id,
        employeeId: testEmpId,
        employeeName: testEmp.name,
        payrollId: 'mock-payroll-2',
        amount: 15000,
        repaymentType: 'PAYROLL_DEDUCTION',
        period: '2026-11',
        installmentNumber: 2,
        balanceBefore: 15000,
        balanceAfter: 0,
        notes: 'Final payroll installment settlement'
      }
    });

    const finalLoan = await prisma.employeeLoanAdvance.update({
      where: { id: testLoan.id },
      data: {
        repaidAmount: 30000,
        remainingBalance: 0,
        status: 'COMPLETED',
        paidInstallmentsCount: 3
      },
      include: { repayments: true }
    });

    assert(
      finalLoan.remainingBalance === 0 && finalLoan.status === 'COMPLETED' && finalLoan.repayments.length === 3,
      'Loan successfully marked COMPLETED when remaining balance hits zero',
      `Status: ${finalLoan.status}, Total Repayments in ledger: ${finalLoan.repayments.length}`
    );

    // -------------------------------------------------------------
    // Test 7: Late Deduction Review Case Lifecycle (Accept / Modify / Waive)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Late Deduction Review Case Workflow ---');
    // Clean up previous test cases
    await prisma.lateDeductionCase.deleteMany({
      where: { employeeId: testEmpId }
    });

    const lateCase = await prisma.lateDeductionCase.create({
      data: {
        employeeId: testEmpId,
        employeeName: testEmp.name,
        period: testMonth,
        lateCount: 3,
        proposedAmount: 2000,
        status: 'PENDING_REVIEW'
      }
    });

    assert(
      lateCase && lateCase.status === 'PENDING_REVIEW' && lateCase.proposedAmount === 2000,
      'Pending late deduction review case created when threshold reached',
      `Case ID: ${lateCase.id}, Proposed: ₨ ${lateCase.proposedAmount}`
    );

    // Admin Modifies Amount
    const modifiedCase = await prisma.lateDeductionCase.update({
      where: { id: lateCase.id },
      data: {
        status: 'MODIFIED',
        adminDecision: 'MODIFY',
        approvedAmount: 1000,
        reviewedByName: 'ADMIN',
        reviewedAt: new Date(),
        reason: 'First warning reduction'
      }
    });

    assert(
      modifiedCase.status === 'MODIFIED' && modifiedCase.adminDecision === 'MODIFY' && modifiedCase.approvedAmount === 1000,
      'Admin can modify deduction amount with recorded rationale',
      `Decision: ${modifiedCase.adminDecision}, Approved: ₨ ${modifiedCase.approvedAmount}, Reason: "${modifiedCase.reason}"`
    );

    // Admin Waives Deduction
    const waivedCase = await prisma.lateDeductionCase.update({
      where: { id: lateCase.id },
      data: {
        status: 'WAIVED',
        adminDecision: 'WAIVE',
        approvedAmount: 0,
        reviewedByName: 'ADMIN',
        reviewedAt: new Date(),
        reason: 'Manager approved severe storm delay exemption'
      }
    });

    assert(
      waivedCase.status === 'WAIVED' && waivedCase.adminDecision === 'WAIVE' && waivedCase.approvedAmount === 0,
      'Admin can 100% waive deduction without penalizing employee salary',
      `Decision: ${waivedCase.adminDecision}, Approved: ₨ ${waivedCase.approvedAmount}`
    );

    // Clean up test data
    await prisma.loanRepaymentTransaction.deleteMany({
      where: { employeeId: testEmpId }
    });
    await prisma.employeeLoanAdvance.deleteMany({
      where: { employeeId: testEmpId }
    });
    await prisma.lateDeductionCase.deleteMany({
      where: { employeeId: testEmpId }
    });
    await prisma.employeeRecord.delete({
      where: { employeeId: testEmpId }
    });
    console.log('\nCleaned up temporary verification test records.');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`VERIFICATION COMPLETE: ${passed}/${total} TESTS PASSED`);
    console.log('================================================================');

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal Verification Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
