const prisma = require('../src/prisma');
const { syncDailyRequirements, getOutletCutoffDate } = require('../src/controllers/dailyDeposit.controller');

async function clearDep847533() {
  console.log('--- Clearing DEP-847533 from 21 Sep Cycle ---');

  // 1. Find the deposit
  const deposit = await prisma.cashDeposit.findFirst({
    where: { outletName: 'Jail Road', referenceNumber: 'DEP-847533' },
  });

  if (!deposit) {
    console.log('Deposit DEP-847533 not found!');
    return;
  }

  console.log('Found deposit:', deposit.id, deposit.referenceNumber, deposit.businessDate, deposit.amount);

  // 2. Move businessDate to '2026-09-20' (previous cycle)
  await prisma.cashDeposit.update({
    where: { id: deposit.id },
    data: {
      businessDate: '2026-09-20',
      notes: 'Deposit for previous cycle ending 20 September 2026',
    },
  });
  console.log('Updated CashDeposit businessDate to 2026-09-20');

  // 3. Update BankDeposit notes if exists
  await prisma.bankDeposit.updateMany({
    where: { slipNumber: 'DEP-847533' },
    data: {
      notes: 'Daily deposit for previous cycle (2026-09-20)',
    },
  });
  console.log('Updated BankDeposit notes');

  // 4. Delete the excess allocation to 2026-09-21
  const deletedAlloc = await prisma.cashDepositAllocation.deleteMany({
    where: {
      cashDepositId: deposit.id,
      businessDate: { gte: '2026-09-21' },
    },
  });
  console.log('Deleted allocations >= 2026-09-21 count:', deletedAlloc.count);

  // 5. Delete any allocations on requirement 2026-09-21
  await prisma.cashDepositAllocation.deleteMany({
    where: {
      requirement: { outletName: 'Jail Road', businessDate: '2026-09-21' },
    },
  });

  // 6. Resync requirement for 2026-09-21
  await syncDailyRequirements('Jail Road', '2026-09-21');
  console.log('Resynced Jail Road requirements for 2026-09-21');

  // 7. Verify the requirement row
  const req21 = await prisma.dailyCashRequirement.findUnique({
    where: { outletName_businessDate: { outletName: 'Jail Road', businessDate: '2026-09-21' } },
    include: { allocations: true },
  });
  console.log('Requirement for 2026-09-21 after reset:');
  console.log(JSON.stringify(req21, null, 2));

  // 8. Verify deposit record is still intact
  const preservedDeposit = await prisma.cashDeposit.findUnique({
    where: { id: deposit.id },
    include: { allocations: true },
  });
  console.log('Preserved historical deposit in database:');
  console.log(JSON.stringify(preservedDeposit, null, 2));
}

clearDep847533().catch(console.error).finally(() => prisma.$disconnect());
