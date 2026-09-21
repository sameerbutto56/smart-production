const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const deposits = await prisma.cashDeposit.findMany({
    where: { outletName: 'Jail Road' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Deposits for Jail Road:');
  console.log(JSON.stringify(deposits, null, 2));

  const reqs = await prisma.dailyCashRequirement.findMany({
    where: { outletName: 'Jail Road' },
    orderBy: { businessDate: 'desc' }
  });
  console.log('Requirements for Jail Road:');
  console.log(JSON.stringify(reqs, null, 2));

  const allocs = await prisma.cashDepositAllocation.findMany({
    where: { cashDeposit: { outletName: 'Jail Road' } },
    include: { cashDeposit: true, requirement: true }
  });
  console.log('Allocations for Jail Road count:', allocs.length);
  console.log(JSON.stringify(allocs, null, 2));

  const { getDailyDeposits } = require('../src/controllers/dailyDeposit.controller');
  const mockReq = { params: { outletName: 'Jail Road' }, query: {} };
  const mockRes = {
    json: (data) => {
      console.log('=== GET DAILY DEPOSITS RESPONSE FOR JAIL ROAD ===');
      console.log('Cutoff Date:', data.cutoffDate);
      console.log('Summary:', JSON.stringify(data.summary, null, 2));
      console.log('Requirements count:', data.requirements.length);
      console.log('Requirements:', JSON.stringify(data.requirements, null, 2));
      console.log('Deposits count in active cycle:', data.deposits.length);
      console.log('Deposits:', JSON.stringify(data.deposits, null, 2));
    }
  };
  await getDailyDeposits(mockReq, mockRes);
}

run().catch(console.error).finally(() => prisma.$disconnect());
