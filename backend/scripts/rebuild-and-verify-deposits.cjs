const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const {
  CUTOFF_DATE,
  calculateAuthoritativeDailyCash,
  syncDailyRequirements,
  rebuildOutletDepositState,
} = require('../src/controllers/dailyDeposit.controller');

const { computeUnifiedSalesSummary } = require('../src/utils/posUnified');

async function runTests() {
  console.log('=== STARTING OUTLET DAILY CASH DEPOSIT & EXPORT VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: Rebuild state starting from CUTOFF_DATE (2026-09-15) for active outlets
    console.log('--- Test 1: Rebuild Deposit Ledger State ---');
    const rebuildResults = await rebuildOutletDepositState();
    assert(rebuildResults && Object.keys(rebuildResults).length > 0, 'Rebuild completed for active outlets');
    console.log('Rebuild results per outlet:', rebuildResults);

    // Test 2: Verify CUTOFF_DATE is 2026-09-15
    console.log('\n--- Test 2: Cutoff Date Policy ---');
    assert(CUTOFF_DATE === '2026-09-15', 'Cutoff date is set to 2026-09-15');

    // Test 3: Check Johar Town cash requirement sync
    console.log('\n--- Test 3: Johar Town Requirement Chain Sync ---');
    const reqs = await syncDailyRequirements('Johar Town', '2026-09-18');
    assert(Array.isArray(reqs) && reqs.length >= 4, 'Requirement chain created for 15, 16, 17, 18 Sep');

    const sep15Req = reqs.find(r => r.businessDate === '2026-09-15');
    assert(sep15Req !== undefined, '15 Sep requirement exists');
    assert(sep15Req.previousPending === 0, '15 Sep has 0 previous pending (cutoff boundary)');

    // Test 4: Verify Cash Journal Expenses Filtering
    console.log('\n--- Test 4: Cash Journal Expense Filter ---');
    const testDate = '2026-09-16';
    const dailyCashResult = await calculateAuthoritativeDailyCash('Johar Town', testDate);
    assert(dailyCashResult && typeof dailyCashResult.netCash === 'number', 'Authoritative daily cash calculated');
    assert(typeof dailyCashResult.breakdown.cashExpenses === 'number', 'Cash expenses broken down separately from non-cash');

    // Test 5: Check computeUnifiedSalesSummary outputs cashJournalExpenses
    console.log('\n--- Test 5: computeUnifiedSalesSummary returns cashJournalExpenses ---');
    const unifiedSummary = await computeUnifiedSalesSummary(prisma, {
      outlet: 'Johar Town',
      start: new Date('2026-09-16T00:00:00Z'),
      end: new Date('2026-09-16T23:59:59Z'),
    });
    assert(typeof unifiedSummary.cashJournalExpenses === 'number', 'posUnified exports cashJournalExpenses');

    // Test 6: Verify Requirement Chain Sequential Continuity
    console.log('\n--- Test 6: FIFO Sequential Carry-Forward Continuity ---');
    let validChain = true;
    for (let i = 1; i < reqs.length; i++) {
      const prev = reqs[i - 1];
      const curr = reqs[i];
      if (curr.previousPending !== prev.pendingAmount) {
        validChain = false;
        console.error(`Mismatch at ${curr.businessDate}: curr.previousPending=${curr.previousPending} !== prev.pendingAmount=${prev.pendingAmount}`);
      }
    }
    assert(validChain, 'Every date previousPending strictly equals previous date pendingAmount');

    // Test 7: Deposit Status Rules
    console.log('\n--- Test 7: Deposit Status Rules ---');
    for (const r of reqs) {
      if (r.excessAmount > 0) {
        assert(r.status === 'EXCESS', `Status EXCESS for ${r.businessDate}`);
      } else if (r.pendingAmount === 0 && (r.depositedAmount > 0 || r.requiredAmount === 0)) {
        assert(['DEPOSITED', 'CLEARED_BY_CARRY_FORWARD'].includes(r.status), `Status DEPOSITED/CLEARED for ${r.businessDate}`);
      } else if (r.depositedAmount > 0 && r.pendingAmount > 0) {
        assert(r.status === 'PARTIALLY_DEPOSITED', `Status PARTIALLY_DEPOSITED for ${r.businessDate}`);
      } else {
        assert(r.status === 'PENDING', `Status PENDING for ${r.businessDate}`);
      }
    }

    console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
