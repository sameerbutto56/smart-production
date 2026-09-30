const prisma = require('../src/prisma');
const { getDailyDeposits, syncDailyRequirements } = require('../src/controllers/dailyDeposit.controller');

async function test() {
  console.log('--- 1. Testing syncDailyRequirements for Johar Town ---');
  await syncDailyRequirements('Johar Town');

  console.log('\n--- 2. Testing getDailyDeposits for Johar Town ---');
  let data = null;
  const req = { query: { outlet: 'Johar Town' } };
  const res = {
    json: (d) => { data = d; },
    status: (code) => ({ json: (d) => { throw new Error(`HTTP ${code}: ${JSON.stringify(d)}`); } })
  };

  await getDailyDeposits(req, res);

  if (!data || !Array.isArray(data.requirements)) {
    throw new Error('Invalid response from getDailyDeposits');
  }

  console.log('Total requirements returned:', data.requirements.length);

  // Check 2026-09-25
  const req25 = data.requirements.find(r => r.businessDate === '2026-09-25');
  console.log('\n--- Checking 2026-09-25 Requirement ---', req25);
  if (!req25) {
    throw new Error('2026-09-25 requirement not found');
  }

  console.log(`25 Sep: Generated Cash = ${req25.generatedCash}, General Entry Deduction = ${req25.generalEntryReduction}, Base Required = ${req25.baseRequired}`);

  if (req25.generatedCash !== 3500) {
    throw new Error(`Expected generatedCash 3500 on 25 Sep, got ${req25.generatedCash}`);
  }
  if (req25.generalEntryReduction !== 2700) {
    throw new Error(`Expected generalEntryReduction 2700 on 25 Sep, got ${req25.generalEntryReduction}`);
  }
  if (req25.baseRequired !== 800) {
    throw new Error(`Expected baseRequired 800 on 25 Sep, got ${req25.baseRequired}`);
  }

  // Check 2026-09-26
  const req26 = data.requirements.find(r => r.businessDate === '2026-09-26');
  console.log('\n--- Checking 2026-09-26 Requirement ---', req26);
  if (req26) {
    console.log(`26 Sep: Generated Cash = ${req26.generatedCash}, General Entry Deduction = ${req26.generalEntryReduction}, Base Required = ${req26.baseRequired}`);
    if (req26.generalEntryReduction !== 1150) {
      throw new Error(`Expected generalEntryReduction 1150 on 26 Sep, got ${req26.generalEntryReduction}`);
    }
    if (req26.baseRequired !== 23650) {
      throw new Error(`Expected baseRequired 23650 on 26 Sep, got ${req26.baseRequired}`);
    }
  }

  console.log('\n✅ ALL VERIFICATIONS PASSED: General Entry is properly deducted from Bank Deposit in Johar Town!');
  await prisma.$disconnect();
}

test().catch(async (err) => {
  console.error('Test failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
