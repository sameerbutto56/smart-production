/**
 * clean-deposit-records.cjs
 * 
 * Wipes all CashDepositAllocation, CashDeposit, and BankDeposit records
 * for ALL outlets. Resets DailyCashRequirement rows to PENDING with
 * zero deposited amounts so the user can re-enter deposits from scratch.
 * 
 * Usage: node backend/scripts/clean-deposit-records.cjs
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== CLEANING ALL DEPOSIT RECORDS ===\n');

  // 1. Count existing records
  const allocCount = await prisma.cashDepositAllocation.count();
  const depositCount = await prisma.cashDeposit.count();
  const bankDepositCount = await prisma.bankDeposit.count();
  const reqCount = await prisma.dailyCashRequirement.count();

  console.log(`Before cleanup:`);
  console.log(`  CashDepositAllocation: ${allocCount} rows`);
  console.log(`  CashDeposit:           ${depositCount} rows`);
  console.log(`  BankDeposit:           ${bankDepositCount} rows`);
  console.log(`  DailyCashRequirement:  ${reqCount} rows (will be KEPT & reset)\n`);

  // 2. Delete allocations first (foreign key dependency)
  const deletedAllocs = await prisma.cashDepositAllocation.deleteMany({});
  console.log(`✓ Deleted ${deletedAllocs.count} CashDepositAllocation rows`);

  // 3. Delete cash deposits
  const deletedDeposits = await prisma.cashDeposit.deleteMany({});
  console.log(`✓ Deleted ${deletedDeposits.count} CashDeposit rows`);

  // 4. Delete bank deposits (backward-compat records)
  const deletedBankDeposits = await prisma.bankDeposit.deleteMany({});
  console.log(`✓ Deleted ${deletedBankDeposits.count} BankDeposit rows`);

  // 5. Reset all DailyCashRequirement rows
  const allReqs = await prisma.dailyCashRequirement.findMany({
    select: { id: true, requiredAmount: true },
  });

  let resetCount = 0;
  for (const r of allReqs) {
    await prisma.dailyCashRequirement.update({
      where: { id: r.id },
      data: {
        depositedAmount: 0,
        pendingAmount: r.requiredAmount,
        excessAmount: 0,
        status: r.requiredAmount > 0 ? 'PENDING' : 'DEPOSITED',
      },
    });
    resetCount++;
  }
  console.log(`✓ Reset ${resetCount} DailyCashRequirement rows (pendingAmount = requiredAmount)`);

  // 6. Verify
  const remainingAllocs = await prisma.cashDepositAllocation.count();
  const remainingDeposits = await prisma.cashDeposit.count();
  const remainingBankDeposits = await prisma.bankDeposit.count();
  const pendingReqs = await prisma.dailyCashRequirement.findMany({
    where: { pendingAmount: { gt: 0 } },
    select: { outletName: true, businessDate: true, requiredAmount: true, pendingAmount: true },
    orderBy: [{ outletName: 'asc' }, { businessDate: 'asc' }],
  });

  console.log(`\nAfter cleanup:`);
  console.log(`  CashDepositAllocation: ${remainingAllocs} rows`);
  console.log(`  CashDeposit:           ${remainingDeposits} rows`);
  console.log(`  BankDeposit:           ${remainingBankDeposits} rows`);
  console.log(`  DailyCashRequirement:  ${pendingReqs.length} rows with pending > 0\n`);

  // Summary per outlet
  const outlets = {};
  pendingReqs.forEach(r => {
    if (!outlets[r.outletName]) outlets[r.outletName] = { count: 0, totalPending: 0 };
    outlets[r.outletName].count++;
    outlets[r.outletName].totalPending += r.pendingAmount;
  });

  console.log('Pending summary per outlet:');
  Object.entries(outlets).forEach(([name, data]) => {
    console.log(`  ${name}: ${data.count} pending days, Rs ${Math.round(data.totalPending).toLocaleString()} total`);
  });

  console.log('\n=== ALL DEPOSIT RECORDS CLEANED. You can now re-enter deposits. ===');
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
