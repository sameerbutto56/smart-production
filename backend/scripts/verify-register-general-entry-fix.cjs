/**
 * Comprehensive Verification: verify-register-general-entry-fix.cjs
 * Validates:
 * 1. Register History (getBookHistory) yields correct positive Available Cash = Generated Cash - General Entry
 * 2. Johar Town 17 Sep (Generated 23,050 - General Entry 3,470 = Available 19,580)
 * 3. Jail Road 21 Sep (Generated 28,100 - General Entry 3,650 = Available 24,450)
 * 4. Register Available Cash strictly equals Bank Deposit Required Amount
 * 5. Zero negative Available Cash anywhere in closed PosBookSessions
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');
const { getBookHistory } = require('../src/controllers/pos.book.controller');
const { getAuthoritativeRegisterCash, syncDailyRequirements } = require('../src/controllers/dailyDeposit.controller');

async function runTests() {
  console.log('=== STARTING REGISTER & BANK DEPOSIT GENERAL ENTRY VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [TEST ${total}] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [TEST ${total}] ${name}`);
      console.error('    Error:', e.message);
    }
  }

  // 1. Mock request for Johar Town getBookHistory
  let jtHistory = [];
  const mockReqJT = {
    query: { outlet: 'Johar Town' },
  };
  const mockResJT = {
    json: (data) => { jtHistory = data; },
    status: () => mockResJT,
  };
  await getBookHistory(mockReqJT, mockResJT);

  // 2. Mock request for Jail Road getBookHistory
  let jrHistory = [];
  const mockReqJR = {
    query: { outlet: 'Jail Road' },
  };
  const mockResJR = {
    json: (data) => { jrHistory = data; },
    status: () => mockResJR,
  };
  await getBookHistory(mockReqJR, mockResJR);

  // Test 1: Johar Town 17 Sep Register History
  const jt17 = jtHistory.find(s => s.openedAt.toISOString().slice(0, 10) === '2026-09-17');
  test('Johar Town 17 Sep Register: Generated Cash 23,050 - General Entry 3,470 = Available Cash 19,580', () => {
    assert.ok(jt17, 'Johar Town 17 Sep session must exist');
    assert.strictEqual(jt17.summary.paymentSummary.cashCollected, 23050);
    assert.strictEqual(jt17.summary.totalJournalEntries, 3470);
    assert.strictEqual(jt17.summary.availableCash, 19580);
    const cashNet = jt17.summary.paymentBreakdown.find(p => p.method === 'CASH')?.net;
    assert.strictEqual(cashNet, 19580);
  });

  // Test 2: Johar Town 18 Sep Register History
  const jt18 = jtHistory.find(s => s.openedAt.toISOString().slice(0, 10) === '2026-09-18');
  test('Johar Town 18 Sep Register: Generated Cash 28,700 - General Entry 100 = Available Cash 28,600', () => {
    assert.ok(jt18, 'Johar Town 18 Sep session must exist');
    assert.strictEqual(jt18.summary.paymentSummary.cashCollected, 28700);
    assert.strictEqual(jt18.summary.totalJournalEntries, 100);
    assert.strictEqual(jt18.summary.availableCash, 28600);
  });

  // Test 3: Johar Town 19 Sep Register History
  const jt19 = jtHistory.find(s => s.openedAt.toISOString().slice(0, 10) === '2026-09-19');
  test('Johar Town 19 Sep Register: Generated Cash 26,900 - General Entry 300 = Available Cash 26,600', () => {
    assert.ok(jt19, 'Johar Town 19 Sep session must exist');
    assert.strictEqual(jt19.summary.paymentSummary.cashCollected, 26900);
    assert.strictEqual(jt19.summary.totalJournalEntries, 300);
    assert.strictEqual(jt19.summary.availableCash, 26600);
  });

  // Test 4: Jail Road 21 Sep Register History
  const jr21 = jrHistory.find(s => s.openedAt.toISOString().slice(0, 10) === '2026-09-21');
  test('Jail Road 21 Sep Register: Generated Cash 28,100 - General Entry 3,650 = Available Cash 24,450', () => {
    assert.ok(jr21, 'Jail Road 21 Sep session must exist');
    assert.strictEqual(jr21.summary.paymentSummary.cashCollected, 28100);
    assert.strictEqual(jr21.summary.totalJournalEntries, 3650);
    assert.strictEqual(jr21.summary.availableCash, 24450);
    const cashNet = jr21.summary.paymentBreakdown.find(p => p.method === 'CASH')?.net;
    assert.strictEqual(cashNet, 24450);
  });

  // Test 5: Jail Road 22 Sep Register History
  const jr22 = jrHistory.find(s => s.openedAt.toISOString().slice(0, 10) === '2026-09-22');
  test('Jail Road 22 Sep Register: Generated Cash 17,850 - General Entry 750 = Available Cash 17,100', () => {
    assert.ok(jr22, 'Jail Road 22 Sep session must exist');
    assert.strictEqual(jr22.summary.paymentSummary.cashCollected, 17850);
    assert.strictEqual(jr22.summary.totalJournalEntries, 750);
    assert.strictEqual(jr22.summary.availableCash, 17100);
  });

  // Test 6: Zero negative Available Cash across ALL closed sessions
  const allSessions = await prisma.posBookSession.findMany({
    where: { status: 'CLOSED' },
  });
  test('Zero negative availableCash across all closed sessions in database', () => {
    for (const s of allSessions) {
      const sum = typeof s.summary === 'string' ? JSON.parse(s.summary) : s.summary;
      assert(sum.availableCash >= 0, `Session ${s.id} has negative availableCash: ${sum.availableCash}`);
    }
  });

  // Test 7: Bank Deposit Requirements match Register Available Cash 1:1
  const jt17Authoritative = await getAuthoritativeRegisterCash('Johar Town', '2026-09-17');
  const jt17Req = await prisma.dailyCashRequirement.findUnique({
    where: { outletName_businessDate: { outletName: 'Johar Town', businessDate: '2026-09-17' } },
  });
  test('Johar Town 17 Sep: Register Available Cash (19,580) === Bank Deposit Required (19,580)', () => {
    assert.strictEqual(jt17Authoritative.availableCash, 19580);
    assert.strictEqual(jt17Req.requiredAmount, 19580);
    assert.strictEqual(jt17Authoritative.availableCash, jt17Req.requiredAmount);
  });

  const jr21Authoritative = await getAuthoritativeRegisterCash('Jail Road', '2026-09-21');
  const jr21Req = await prisma.dailyCashRequirement.findUnique({
    where: { outletName_businessDate: { outletName: 'Jail Road', businessDate: '2026-09-21' } },
  });
  test('Jail Road 21 Sep: Register Available Cash (24,450) === Bank Deposit Required (24,450)', () => {
    assert.strictEqual(jr21Authoritative.availableCash, 24450);
    assert.strictEqual(jr21Req.requiredAmount, 24450);
    assert.strictEqual(jr21Authoritative.availableCash, jr21Req.requiredAmount);
  });

  const jr22Authoritative = await getAuthoritativeRegisterCash('Jail Road', '2026-09-22');
  const jr22Req = await prisma.dailyCashRequirement.findUnique({
    where: { outletName_businessDate: { outletName: 'Jail Road', businessDate: '2026-09-22' } },
  });
  test('Jail Road 22 Sep: Register Available Cash (17,100) === Bank Deposit Required (17,100)', () => {
    assert.strictEqual(jr22Authoritative.availableCash, 17100);
    assert.strictEqual(jr22Req.requiredAmount, 17100);
    assert.strictEqual(jr22Authoritative.availableCash, jr22Req.requiredAmount);
  });

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===`);
  if (passed < total) process.exit(1);
}

runTests()
  .catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
