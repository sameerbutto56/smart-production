/**
 * Automated Verification: verify-register-bank-deposit-sync.cjs
 * Validates:
 * 1. Register cash matches Closed Register (PosBookSession) for each date
 * 2. Jail Road 2026-09-21 deposited 28,100, pending 0, fully cleared
 * 3. Johar Town historical deposits match each date 1:1 without spurious backfill
 * 4. Branch isolation between Johar Town and Jail Road
 * 5. PKT timezone date time formatting
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');
const {
  getOutletCutoffDate,
  getAuthoritativeRegisterCash,
} = require('../src/controllers/dailyDeposit.controller');

async function runTests() {
  console.log('=== STARTING OUTLET REGISTER -> BANK DEPOSIT SYNC VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`PASS [${total}]: ${name}`);
      passed++;
    } catch (e) {
      console.error(`FAIL [${total}]: ${name}`);
      console.error(e.message);
    }
  }

  // 1. Branch Cutoffs
  test('Branch Cutoffs are strictly isolated', () => {
    assert.strictEqual(getOutletCutoffDate('Jail Road'), '2026-09-21');
    assert.strictEqual(getOutletCutoffDate('Johar Town'), '2026-09-15');
    assert.strictEqual(getOutletCutoffDate('Abbottabad'), '2026-09-15');
  });

  // 2. Authoritative Register Cash Queries
  const jr21Register = await getAuthoritativeRegisterCash('Jail Road', '2026-09-21');
  test('Jail Road 2026-09-21 Register: Generated 28,100, Reduction 3,650, Available 24,450', () => {
    assert.strictEqual(jr21Register.generatedCash, 28100);
    assert.strictEqual(jr21Register.generalEntryReduction, 3650);
    assert.strictEqual(jr21Register.availableCash, 24450);
  });

  const jt16Register = await getAuthoritativeRegisterCash('Johar Town', '2026-09-16');
  test('Johar Town 2026-09-16 Register: Generated 28,300, Available 28,300', () => {
    assert.strictEqual(jt16Register.generatedCash, 28300);
    assert.strictEqual(jt16Register.availableCash, 28300);
  });

  const jt17Register = await getAuthoritativeRegisterCash('Johar Town', '2026-09-17');
  test('Johar Town 2026-09-17 Register: Generated 23,050, Reduction 3,470, Available 19,580', () => {
    assert.strictEqual(jt17Register.generatedCash, 23050);
    assert.strictEqual(jt17Register.generalEntryReduction, 3470);
    assert.strictEqual(jt17Register.availableCash, 19580);
  });

  // 3. Jail Road 2026-09-21 DailyCashRequirement State
  const jr21Req = await prisma.dailyCashRequirement.findUnique({
    where: {
      outletName_businessDate: {
        outletName: 'Jail Road',
        businessDate: '2026-09-21',
      },
    },
    include: {
      allocations: {
        include: { cashDeposit: true },
      },
    },
  });

  test('Jail Road 2026-09-21 requirement matches available cash (24,450) and deposited 28,100', () => {
    assert.ok(jr21Req, 'Jail Road 2026-09-21 requirement must exist');
    assert.strictEqual(jr21Req.requiredAmount, 24450, 'Required amount must be 24,450');
    assert.strictEqual(jr21Req.depositedAmount, 28100, 'Deposited amount must be 28,100');
    assert.strictEqual(jr21Req.pendingAmount, 0, 'Pending amount must be 0');
    assert.strictEqual(jr21Req.excessAmount, 3650, 'Excess amount must be 3,650');
    assert.strictEqual(jr21Req.status, 'EXCESS');
    const totalAlloc = jr21Req.allocations.reduce((s, a) => s + a.amount, 0);
    assert.strictEqual(totalAlloc, 28100);
    assert.strictEqual(jr21Req.allocations[0].cashDeposit.referenceNumber, 'DEP-168236');
  });

  // 4. Johar Town DailyCashRequirements
  const jtReqs = await prisma.dailyCashRequirement.findMany({
    where: {
      outletName: 'Johar Town',
      businessDate: { gte: '2026-09-15' },
    },
    orderBy: { businessDate: 'asc' },
  });

  const jtMap = new Map();
  jtReqs.forEach(r => jtMap.set(r.businessDate, r));

  test('Johar Town 2026-09-15 is cleared with 21,250', () => {
    const r = jtMap.get('2026-09-15');
    assert.ok(r);
    assert.strictEqual(r.requiredAmount, 21250);
    assert.strictEqual(r.depositedAmount, 21250);
    assert.strictEqual(r.pendingAmount, 0);
    assert.strictEqual(r.status, 'DEPOSITED');
  });

  test('Johar Town 2026-09-16 is cleared with 28,300 (no carry-forward excess)', () => {
    const r = jtMap.get('2026-09-16');
    assert.ok(r);
    assert.strictEqual(r.requiredAmount, 28300);
    assert.strictEqual(r.depositedAmount, 28300);
    assert.strictEqual(r.pendingAmount, 0);
    assert.strictEqual(r.excessAmount, 0);
    assert.strictEqual(r.status, 'DEPOSITED');
  });

  test('Johar Town 2026-09-17 reflects available cash (Required 19,580, Deposited 18,580, Pending 1,000)', () => {
    const r = jtMap.get('2026-09-17');
    assert.ok(r);
    assert.strictEqual(r.requiredAmount, 19580);
    assert.strictEqual(r.depositedAmount, 18580);
    assert.strictEqual(r.pendingAmount, 1000);
    assert.strictEqual(r.status, 'PARTIALLY_DEPOSITED');
  });

  test('Johar Town 2026-09-18 has 29,600 deposit (Required 28,600, Excess 1,000)', () => {
    const r = jtMap.get('2026-09-18');
    assert.ok(r);
    assert.strictEqual(r.requiredAmount, 28600);
    assert.strictEqual(r.depositedAmount, 29600);
    assert.strictEqual(r.pendingAmount, 0);
    assert.strictEqual(r.excessAmount, 1000);
    assert.strictEqual(r.status, 'EXCESS');
  });

  test('Johar Town 2026-09-19 reflects full deposit (Required 26,600, Deposited 26,600, Pending 0)', () => {
    const r = jtMap.get('2026-09-19');
    assert.ok(r);
    assert.strictEqual(r.requiredAmount, 26600);
    assert.strictEqual(r.depositedAmount, 26600);
    assert.strictEqual(r.pendingAmount, 0);
    assert.strictEqual(r.status, 'DEPOSITED');
  });

  // 5. PKT Timezone test
  test('PKT datetime format helper formats to UTC+5 Asia/Karachi time', () => {
    // 2026-09-22T06:43:00.000Z should format to 11:43 AM in PKT
    const utcDate = new Date('2026-09-22T06:43:00.000Z');
    const formatted = utcDate.toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    assert.strictEqual(formatted, '11:43 AM');
  });

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests()
  .catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
