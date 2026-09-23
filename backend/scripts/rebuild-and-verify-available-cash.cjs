const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });
const { rebuildOutletDepositState, getAuthoritativeRegisterCash, getDailyDeposits } = require('../src/controllers/dailyDeposit.controller');

async function main() {
  console.log('--- REBUILDING DEPOSIT STATE FOR BOTH OUTLETS ---');
  
  console.log('\n1. Rebuilding Johar Town...');
  const jtResult = await rebuildOutletDepositState('Johar Town');
  console.log('Johar Town Rebuild Result:', jtResult);

  console.log('\n2. Rebuilding Jail Road...');
  const jrResult = await rebuildOutletDepositState('Jail Road');
  console.log('Jail Road Rebuild Result:', jrResult);

  console.log('\n3. Checking Johar Town Requirements...');
  const jtReqs = await prisma.dailyCashRequirement.findMany({
    where: { outletName: 'Johar Town', businessDate: { gte: '2026-09-15' } },
    orderBy: { businessDate: 'asc' }
  });

  for (const r of jtReqs) {
    let notes = {};
    try { if (r.notes) notes = JSON.parse(r.notes); } catch (e) {}
    console.log(`[Johar Town] ${r.businessDate} | Generated: ${r.cashGenerated} | GenEntry: ${notes.generalEntryReduction || 0} | Req(Avail): ${r.requiredAmount} | Deposited: ${r.depositedAmount} | Pending: ${r.pendingAmount} | Excess: ${r.excessAmount} | Status: ${r.status}`);
  }

  console.log('\n4. Checking Jail Road Requirements...');
  const jrReqs = await prisma.dailyCashRequirement.findMany({
    where: { outletName: 'Jail Road', businessDate: { gte: '2026-09-21' } },
    orderBy: { businessDate: 'asc' }
  });

  for (const r of jrReqs) {
    let notes = {};
    try { if (r.notes) notes = JSON.parse(r.notes); } catch (e) {}
    console.log(`[Jail Road] ${r.businessDate} | Generated: ${r.cashGenerated} | GenEntry: ${notes.generalEntryReduction || 0} | Req(Avail): ${r.requiredAmount} | Deposited: ${r.depositedAmount} | Pending: ${r.pendingAmount} | Excess: ${r.excessAmount} | Status: ${r.status}`);
  }

  console.log('\n5. Checking Mock Req/Res for getDailyDeposits...');
  const mockReq = (outlet) => ({ query: { outlet } });
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
  console.log('\nJohar Town API Summary:', dataJT.summary);
  console.log('Johar Town API Requirements count:', dataJT.requirements?.length);
  if (dataJT.requirements) {
    dataJT.requirements.forEach(r => {
      console.log(`  ${r.businessDate} -> Gen: ${r.generatedCash} | GE: ${r.generalEntryReduction} | Avail: ${r.availableCash} | Req: ${r.requiredAmount} | Dep: ${r.depositedAmount} | Pend: ${r.pendingAmount} | Status: ${r.status}`);
    });
  }

  const resJR = mockRes();
  await getDailyDeposits(mockReq('Jail Road'), resJR);
  const dataJR = resJR._getOut();
  console.log('\nJail Road API Summary:', dataJR.summary);
  console.log('Jail Road API Requirements count:', dataJR.requirements?.length);
  if (dataJR.requirements) {
    dataJR.requirements.forEach(r => {
      console.log(`  ${r.businessDate} -> Gen: ${r.generatedCash} | GE: ${r.generalEntryReduction} | Avail: ${r.availableCash} | Req: ${r.requiredAmount} | Dep: ${r.depositedAmount} | Pend: ${r.pendingAmount} | Status: ${r.status}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error running rebuild:', err);
  process.exit(1);
});
