/**
 * Verification Script for Jail Road Deposit Cycle Reset (21 Sep 2026)
 */

const assert = require('assert');
const prisma = require('../src/prisma');
const {
  DEFAULT_CUTOFF_DATE,
  CUTOFF_DATE,
  OUTLET_CUTOFF_DATES,
  getOutletCutoffDate,
  syncDailyRequirements,
  getDailyDeposits,
} = require('../src/controllers/dailyDeposit.controller');

async function run() {
  console.log('=== STARTING JAIL ROAD DEPOSIT RESET VERIFICATION ===\n');

  // Test 1: Config check
  console.log('1. Checking Cutoff Configurations:');
  assert.strictEqual(DEFAULT_CUTOFF_DATE, '2026-09-15', 'Default cutoff is 2026-09-15');
  assert.strictEqual(CUTOFF_DATE, '2026-09-15', 'CUTOFF_DATE export preserved as 2026-09-15');
  assert.strictEqual(getOutletCutoffDate('Jail Road'), '2026-09-21', 'Jail Road cutoff is strictly 2026-09-21');
  assert.strictEqual(getOutletCutoffDate('Johar Town'), '2026-09-15', 'Johar Town cutoff is 2026-09-15');
  assert.strictEqual(getOutletCutoffDate('Abbottabad'), '2026-09-15', 'Abbottabad cutoff is 2026-09-15');
  console.log('  ✓ Test 1 passed: All cutoff configs are strictly enforced.');

  // Test 2: Historical records check (NO deletion)
  console.log('\n2. Verifying Historical Data Preservation for Jail Road:');
  const allJailReqsInDb = await prisma.dailyCashRequirement.findMany({
    where: { outletName: 'Jail Road' },
    orderBy: { businessDate: 'asc' },
  });
  assert(allJailReqsInDb.length >= 7, 'Historical requirements >= 7 still stored in database');
  const pastDates = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];
  for (const pd of pastDates) {
    const found = allJailReqsInDb.find(r => r.businessDate === pd);
    assert(found !== undefined, `Historical requirement for ${pd} exists in DB`);
  }
  const jailDeposits = await prisma.cashDeposit.findMany({
    where: { outletName: 'Jail Road' },
  });
  assert(jailDeposits.length >= 1, 'Historical deposits intact in DB');
  console.log('  ✓ Test 2 passed: Historical records (15-20 Sep) are safely preserved in DB.');

  // Test 3: Jail Road getDailyDeposits API verification
  console.log('\n3. Verifying Jail Road Current Deposit Cycle & Pending Balance:');
  const jailReqMock = { params: { outletName: 'Jail Road' }, query: {} };
  let jailOutput = null;
  const resMock = { json: (d) => { jailOutput = d; return d; }, status: () => ({ json: (d) => { jailOutput = d; return d; } }) };
  await getDailyDeposits(jailReqMock, resMock);

  assert.strictEqual(jailOutput.outletName, 'Jail Road');
  assert.strictEqual(jailOutput.cutoffDate, '2026-09-21', 'Jail Road reports cutoffDate 2026-09-21');
  assert.strictEqual(jailOutput.summary.todayPending, 0, 'Jail Road current pending balance is Rs. 0');
  assert.strictEqual(jailOutput.summary.previousPending, 0, 'Jail Road previous pending is Rs. 0 (cleared/not carried forward)');
  assert.strictEqual(jailOutput.summary.totalPendingAllTime, 0, 'Jail Road totalPendingAllTime is Rs. 0');
  assert(jailOutput.requirements.length >= 1, 'Jail Road has current cycle requirement');
  assert.strictEqual(jailOutput.requirements[0].businessDate, '2026-09-21', 'Active requirement starts from 2026-09-21');
  assert.strictEqual(jailOutput.requirements[0].pendingAmount, 0, 'Active requirement pending is 0');
  console.log('  ✓ Test 3 passed: Jail Road current pending balance is Rs. 0 with new cycle starting 21 September.');

  // Test 4: Other Outlets Untouched
  console.log('\n4. Verifying Other Outlets Are Completely Untouched:');
  const jtReqMock = { params: { outletName: 'Johar Town' }, query: {} };
  let jtOutput = null;
  const jtResMock = { json: (d) => { jtOutput = d; return d; }, status: () => ({ json: (d) => { jtOutput = d; return d; } }) };
  await getDailyDeposits(jtReqMock, jtResMock);
  assert.strictEqual(jtOutput.cutoffDate, '2026-09-15', 'Johar Town cutoff remains 2026-09-15');
  assert(jtOutput.requirements.length >= 7, 'Johar Town has full requirement history from 15 Sep');
  console.log('  ✓ Test 4 passed: Johar Town and other branches operate on 15 Sep cutoff as before.');

  console.log('\n=== ALL VERIFICATION CHECKS PASSED (4/4) ===');
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
}).finally(() => process.exit(0));
