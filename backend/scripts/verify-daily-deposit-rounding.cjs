const prisma = require('../src/prisma');
const {
  syncDailyRequirements,
  getDailyDeposits,
  rebuildOutletDepositState,
} = require('../src/controllers/dailyDeposit.controller');

const getPktDateString = () => {
  const pktMs = Date.now() + 5 * 60 * 60 * 1000;
  return new Date(pktMs).toISOString().slice(0, 10);
};

async function verifyRounding() {
  console.log('=== VERIFYING BANK DEPOSIT AUTOMATIC WHOLE-RUPEE ROUNDING ===\n');

  const todayPkt = getPktDateString();
  console.log(`Current PKT Date: ${todayPkt}`);

  // 1. Rebuild deposit state for all outlets
  console.log('\n--- Step 1: Rebuilding deposit states for Johar Town and Jail Road ---');
  await rebuildOutletDepositState('Johar Town');
  await rebuildOutletDepositState('Jail Road');
  console.log('Rebuild completed successfully.');

  // 2. Check all requirements in DB
  console.log('\n--- Step 2: Checking Prisma DailyCashRequirement rows for any decimals ---');
  const reqs = await prisma.dailyCashRequirement.findMany({
    orderBy: { businessDate: 'asc' },
  });

  let decimalErrors = 0;
  for (const r of reqs) {
    const fields = [
      ['cashGenerated', r.cashGenerated],
      ['previousPending', r.previousPending],
      ['requiredAmount', r.requiredAmount],
      ['depositedAmount', r.depositedAmount],
      ['pendingAmount', r.pendingAmount],
      ['excessAmount', r.excessAmount],
    ];

    for (const [name, val] of fields) {
      if (val % 1 !== 0) {
        console.error(`Decimal detected in Requirement ID ${r.id} (${r.outletName}, ${r.businessDate}): ${name} = ${val}`);
        decimalErrors++;
      }
    }

    if (r.notes) {
      try {
        const p = JSON.parse(r.notes);
        for (const [key, val] of Object.entries(p)) {
          if (typeof val === 'number' && val % 1 !== 0) {
            console.error(`Decimal in Requirement notes (${r.outletName}, ${r.businessDate}): notes.${key} = ${val}`);
            decimalErrors++;
          }
        }
      } catch (e) {}
    }
  }

  if (decimalErrors === 0) {
    console.log(`PASS: All ${reqs.length} DailyCashRequirement records are 100% whole integers.`);
  } else {
    console.error(`FAIL: Found ${decimalErrors} decimal occurrences in requirements.`);
  }

  // 3. Check all CashDepositAllocations
  console.log('\n--- Step 3: Checking CashDepositAllocation rows for any decimals ---');
  const allocations = await prisma.cashDepositAllocation.findMany();
  let allocDecimalErrors = 0;
  for (const a of allocations) {
    if (a.amount % 1 !== 0) {
      console.error(`Decimal in allocation ${a.id}: amount = ${a.amount}`);
      allocDecimalErrors++;
    }
  }
  if (allocDecimalErrors === 0) {
    console.log(`PASS: All ${allocations.length} CashDepositAllocation records are 100% whole integers.`);
  } else {
    console.error(`FAIL: Found ${allocDecimalErrors} decimal allocations.`);
  }

  // 4. Test Johar Town 2026-09-21 specifically (which previously had 16892.28 and caused 0.28 dangling pending)
  console.log('\n--- Step 4: Verifying Johar Town 2026-09-21 and 2026-09-24 ---');
  const jt21 = await prisma.dailyCashRequirement.findUnique({
    where: { outletName_businessDate: { outletName: 'Johar Town', businessDate: '2026-09-21' } },
  });
  console.log('2026-09-21:', {
    cashGenerated: jt21?.cashGenerated,
    requiredAmount: jt21?.requiredAmount,
    depositedAmount: jt21?.depositedAmount,
    pendingAmount: jt21?.pendingAmount,
    excessAmount: jt21?.excessAmount,
  });

  const jt24 = await prisma.dailyCashRequirement.findUnique({
    where: { outletName_businessDate: { outletName: 'Johar Town', businessDate: '2026-09-24' } },
  });
  console.log('2026-09-24:', {
    cashGenerated: jt24?.cashGenerated,
    requiredAmount: jt24?.requiredAmount,
    depositedAmount: jt24?.depositedAmount,
    pendingAmount: jt24?.pendingAmount,
    excessAmount: jt24?.excessAmount,
  });

  if (jt24 && jt24.pendingAmount === 0) {
    console.log('PASS: 0.28 dangling pending on 2026-09-24 is cleanly resolved to 0!');
  } else {
    console.error(`FAIL: 2026-09-24 pendingAmount is ${jt24?.pendingAmount}`);
  }

  // 5. Test mock controller response via getDailyDeposits
  console.log('\n--- Step 5: Testing getDailyDeposits response payload ---');
  let mockPayload = null;
  const mockReq = {
    params: { outletName: 'Johar Town' },
    query: {},
  };
  const mockRes = {
    json: (data) => { mockPayload = data; return data; },
    status: () => mockRes,
  };
  await getDailyDeposits(mockReq, mockRes);

  let summaryDecimalErrors = 0;
  for (const [key, val] of Object.entries(mockPayload.summary)) {
    if (typeof val === 'number' && val % 1 !== 0) {
      console.error(`Decimal in summary.${key} = ${val}`);
      summaryDecimalErrors++;
    }
  }

  let reqsDecimalErrors = 0;
  for (const r of mockPayload.requirements) {
    const numericKeys = [
      'generatedCash', 'registerCash', 'generalEntryReduction',
      'baseRequired', 'availableCash', 'previousPending',
      'previousExcess', 'consumedCredit', 'netRequired',
      'appliedToPrev', 'appliedToCurrent', 'depositedAmount',
      'pendingAmount', 'excessAmount', 'remainingAmount'
    ];
    for (const k of numericKeys) {
      if (typeof r[k] === 'number' && r[k] % 1 !== 0) {
        console.error(`Decimal in payload requirement (${r.businessDate}).${k} = ${r[k]}`);
        reqsDecimalErrors++;
      }
    }
  }

  if (summaryDecimalErrors === 0 && reqsDecimalErrors === 0) {
    console.log('PASS: getDailyDeposits payload summary and requirements contain ZERO decimals.');
  } else {
    console.error(`FAIL: Found ${summaryDecimalErrors + reqsDecimalErrors} decimal values in payload.`);
  }

  const allPassed = decimalErrors === 0 && allocDecimalErrors === 0 && (jt24?.pendingAmount === 0) && summaryDecimalErrors === 0 && reqsDecimalErrors === 0;
  console.log(`\n=== OVERALL VERIFICATION: ${allPassed ? 'ALL PASSED (100%)' : 'SOME TESTS FAILED'} ===`);

  if (!allPassed) {
    process.exit(1);
  }
}

verifyRounding()
  .catch((err) => {
    console.error('Verification error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
