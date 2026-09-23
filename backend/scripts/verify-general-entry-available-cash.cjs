/**
 * Automated Verification: verify-general-entry-available-cash.cjs
 *
 * Verifies:
 * 1. Available Cash = Generated Cash - Total Valid General Entry Reductions
 * 2. Required Bank Deposit = Available Cash (NOT raw generated cash)
 * 3. 1:1 business date association: general entries on date X only reduce date X
 * 4. General entry reduction is never double deducted
 * 5. Historical data and raw generated cash are preserved
 * 6. Branch isolation between Johar Town (cycle from 15 Sep) and Jail Road (cycle from 21 Sep)
 * 7. Live getDailyDeposits API response payload contains generalEntryReduction & availableCash
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });
const assert = require('assert');
const {
  getAuthoritativeRegisterCash,
  getDailyDeposits,
} = require('../src/controllers/dailyDeposit.controller');

async function runTests() {
  console.log('=== STARTING REGISTER & BANK DEPOSIT GENERAL ENTRY REDUCTION VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [TEST ${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [TEST ${total}] ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // 1. Johar Town 2026-09-17 Register Authoritative Values
  const jt17 = await getAuthoritativeRegisterCash('Johar Town', '2026-09-17');
  test('Johar Town 2026-09-17: Generated Cash is 23,050', () => {
    assert.strictEqual(jt17.generatedCash, 23050);
  });
  test('Johar Town 2026-09-17: General Entry Reduction is 3,470 (Tea 2450 + Tissue 1020)', () => {
    assert.strictEqual(jt17.generalEntryReduction, 3470);
    assert(jt17.journalEntries.length >= 2, 'Must have at least 2 journal entries');
  });
  test('Johar Town 2026-09-17: Available Cash is exactly 19,580 (23,050 - 3,470)', () => {
    assert.strictEqual(jt17.availableCash, 19580);
  });

  // 2. Johar Town 2026-09-18 Register Authoritative Values
  const jt18 = await getAuthoritativeRegisterCash('Johar Town', '2026-09-18');
  test('Johar Town 2026-09-18: Generated Cash 28,700, Reduction 100, Available Cash 28,600', () => {
    assert.strictEqual(jt18.generatedCash, 28700);
    assert.strictEqual(jt18.generalEntryReduction, 100);
    assert.strictEqual(jt18.availableCash, 28600);
  });

  // 3. Johar Town 2026-09-19 Register Authoritative Values
  const jt19 = await getAuthoritativeRegisterCash('Johar Town', '2026-09-19');
  test('Johar Town 2026-09-19: Generated Cash 26,900, Reduction 300, Available Cash 26,600', () => {
    assert.strictEqual(jt19.generatedCash, 26900);
    assert.strictEqual(jt19.generalEntryReduction, 300);
    assert.strictEqual(jt19.availableCash, 26600);
  });

  // 4. Jail Road 2026-09-21 Register Authoritative Values
  const jr21 = await getAuthoritativeRegisterCash('Jail Road', '2026-09-21');
  test('Jail Road 2026-09-21: Generated Cash 28,100, Reduction 3,650, Available Cash 24,450', () => {
    assert.strictEqual(jr21.generatedCash, 28100);
    assert.strictEqual(jr21.generalEntryReduction, 3650);
    assert.strictEqual(jr21.availableCash, 24450);
  });

  // 5. Jail Road 2026-09-22 Register Authoritative Values
  const jr22 = await getAuthoritativeRegisterCash('Jail Road', '2026-09-22');
  test('Jail Road 2026-09-22: Generated Cash 17,850, Reduction 750, Available Cash 17,100', () => {
    assert.strictEqual(jr22.generatedCash, 17850);
    assert.strictEqual(jr22.generalEntryReduction, 750);
    assert.strictEqual(jr22.availableCash, 17100);
  });

  // 6. DB Requirement Record for Johar Town 17 Sep
  const reqJT17 = await prisma.dailyCashRequirement.findFirst({
    where: { outletName: 'Johar Town', businessDate: '2026-09-17' }
  });
  test('DB Johar Town 2026-09-17: Required Deposit equals Available Cash (19,580), Pending is 1,000 (NOT 4,470)', () => {
    assert(reqJT17, 'Requirement record must exist');
    assert.strictEqual(reqJT17.cashGenerated, 23050);
    assert.strictEqual(reqJT17.requiredAmount, 19580);
    assert.strictEqual(reqJT17.depositedAmount, 18580);
    assert.strictEqual(reqJT17.pendingAmount, 1000);
    assert.strictEqual(reqJT17.status, 'PARTIALLY_DEPOSITED');
  });

  // 7. DB Requirement Record for Johar Town 18 Sep
  const reqJT18 = await prisma.dailyCashRequirement.findFirst({
    where: { outletName: 'Johar Town', businessDate: '2026-09-18' }
  });
  test('DB Johar Town 2026-09-18: Required 28,600, Deposited 29,600, Pending 0, Excess 1,000', () => {
    assert(reqJT18, 'Requirement record must exist');
    assert.strictEqual(reqJT18.cashGenerated, 28700);
    assert.strictEqual(reqJT18.requiredAmount, 28600);
    assert.strictEqual(reqJT18.depositedAmount, 29600);
    assert.strictEqual(reqJT18.pendingAmount, 0);
    assert.strictEqual(reqJT18.excessAmount, 1000);
  });

  // 8. DB Requirement Record for Johar Town 19 Sep
  const reqJT19 = await prisma.dailyCashRequirement.findFirst({
    where: { outletName: 'Johar Town', businessDate: '2026-09-19' }
  });
  test('DB Johar Town 2026-09-19: Required 26,600, Deposited 26,600, Pending 0 (Cleared)', () => {
    assert(reqJT19, 'Requirement record must exist');
    assert.strictEqual(reqJT19.cashGenerated, 26900);
    assert.strictEqual(reqJT19.requiredAmount, 26600);
    assert.strictEqual(reqJT19.depositedAmount, 26600);
    assert.strictEqual(reqJT19.pendingAmount, 0);
    assert.strictEqual(reqJT19.status, 'DEPOSITED');
  });

  // 9. DB Requirement Record for Jail Road 21 Sep
  const reqJR21 = await prisma.dailyCashRequirement.findFirst({
    where: { outletName: 'Jail Road', businessDate: '2026-09-21' }
  });
  test('DB Jail Road 2026-09-21: Required 24,450, Deposited 28,100, Pending 0, Excess 3,650', () => {
    assert(reqJR21, 'Requirement record must exist');
    assert.strictEqual(reqJR21.cashGenerated, 28100);
    assert.strictEqual(reqJR21.requiredAmount, 24450);
    assert.strictEqual(reqJR21.depositedAmount, 28100);
    assert.strictEqual(reqJR21.pendingAmount, 0);
    assert.strictEqual(reqJR21.excessAmount, 3650);
  });

  // 10. API getDailyDeposits Payload Enrichment Verification
  const mockReq = (outlet) => ({ params: { outletName: outlet }, query: {} });
  const mockRes = () => {
    let out = {};
    return {
      json: (data) => { out = data; return out; },
      status: (code) => ({ json: (d) => { out = { statusCode: code, ...d }; return out; } }),
      _getOut: () => out
    };
  };

  const resJT = mockRes();
  await getDailyDeposits(mockReq('Johar Town'), resJT);
  const dataJT = resJT._getOut();

  test('API Johar Town: requirements contain generatedCash, generalEntryReduction, availableCash, and journalEntries', () => {
    assert(Array.isArray(dataJT.requirements), 'Requirements must be an array');
    const r17 = dataJT.requirements.find(r => r.businessDate === '2026-09-17');
    assert(r17, '2026-09-17 row must be present');
    assert.strictEqual(r17.generatedCash, 23050);
    assert.strictEqual(r17.generalEntryReduction, 3470);
    assert.strictEqual(r17.availableCash, 19580);
    assert.strictEqual(r17.requiredAmount, 19580);
    assert(Array.isArray(r17.journalEntries), 'journalEntries must be an array');
    assert.strictEqual(r17.journalEntries.length, 2);
  });

  const resJR = mockRes();
  await getDailyDeposits(mockReq('Jail Road'), resJR);
  const dataJR = resJR._getOut();

  test('API Jail Road: requirements contain generatedCash, generalEntryReduction, availableCash, and journalEntries', () => {
    assert(Array.isArray(dataJR.requirements), 'Requirements must be an array');
    const r21 = dataJR.requirements.find(r => r.businessDate === '2026-09-21');
    assert(r21, '2026-09-21 row must be present');
    assert.strictEqual(r21.generatedCash, 28100);
    assert.strictEqual(r21.generalEntryReduction, 3650);
    assert.strictEqual(r21.availableCash, 24450);
    assert.strictEqual(r21.requiredAmount, 24450);
    assert(Array.isArray(r21.journalEntries), 'journalEntries must be an array');
  });

  // 11. Branch Isolation: Johar Town starts from 2026-09-15, Jail Road starts from 2026-09-21
  test('Branch Isolation: Johar Town includes dates from 2026-09-15 while Jail Road starts at 2026-09-21', () => {
    const jtDates = dataJT.requirements.map(r => r.businessDate);
    const jrDates = dataJR.requirements.map(r => r.businessDate);
    assert(jtDates.includes('2026-09-15'), 'Johar Town must include 2026-09-15');
    assert(jtDates.includes('2026-09-17'), 'Johar Town must include 2026-09-17');
    assert(!jrDates.includes('2026-09-15'), 'Jail Road must NOT include 2026-09-15');
    assert(!jrDates.includes('2026-09-20'), 'Jail Road must NOT include 2026-09-20');
    assert(jrDates.includes('2026-09-21'), 'Jail Road must include 2026-09-21');
  });

  await prisma.$disconnect();

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
