/**
 * Script: realign-and-verify-deposits.cjs
 * Purpose:
 * 1. Realign Jail Road deposit DEP-168236 (Rs 28,100) to businessDate 2026-09-21
 * 2. Delete duplicate test slip DEP-849245 on Johar Town
 * 3. Rebuild deposit ledger state for both Johar Town and Jail Road
 * 4. Verify authoritative sync against PosBookSession closed registers
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  rebuildOutletDepositState,
  getAuthoritativeRegisterCash,
} = require('../src/controllers/dailyDeposit.controller');

async function main() {
  console.log('=== REALIGNING DEPOSITS DATA ===\n');

  // 1. Check Jail Road deposit DEP-168236
  const jrDep = await prisma.cashDeposit.findFirst({
    where: {
      outletName: 'Jail Road',
      referenceNumber: 'DEP-168236',
    },
  });

  if (jrDep) {
    console.log(`Found Jail Road deposit DEP-168236 with businessDate=${jrDep.businessDate}, amount=${jrDep.amount}`);
    if (jrDep.businessDate !== '2026-09-21') {
      await prisma.cashDeposit.update({
        where: { id: jrDep.id },
        data: { businessDate: '2026-09-21' },
      });
      console.log('-> Updated DEP-168236 businessDate to 2026-09-21');
    }
  } else {
    console.log('Jail Road deposit DEP-168236 not found or already aligned.');
  }

  // 2. Check Johar Town duplicate deposit DEP-849245
  const jtDup = await prisma.cashDeposit.findFirst({
    where: {
      outletName: 'Johar Town',
      referenceNumber: 'DEP-849245',
    },
  });

  if (jtDup) {
    console.log(`Found Johar Town duplicate test deposit DEP-849245 (amount=${jtDup.amount}), deleting allocations & deposit...`);
    await prisma.cashDepositAllocation.deleteMany({
      where: { cashDepositId: jtDup.id },
    });
    await prisma.cashDeposit.delete({
      where: { id: jtDup.id },
    });
    console.log('-> Successfully deleted duplicate DEP-849245');
  } else {
    console.log('Johar Town duplicate deposit DEP-849245 not present.');
  }

  // 3. Rebuild deposit state for both outlets
  console.log('\nRebuilding deposit state for Johar Town...');
  await rebuildOutletDepositState('Johar Town');

  console.log('\nRebuilding deposit state for Jail Road...');
  await rebuildOutletDepositState('Jail Road');

  // 4. Verify Jail Road
  console.log('\n=== VERIFYING JAIL ROAD ===');
  const jrReqs = await prisma.dailyCashRequirement.findMany({
    where: { outletName: 'Jail Road', businessDate: { gte: '2026-09-21' } },
    orderBy: { businessDate: 'asc' },
    include: { allocations: { include: { cashDeposit: true } } },
  });

  for (const r of jrReqs) {
    const regCash = await getAuthoritativeRegisterCash('Jail Road', r.businessDate);
    console.log(`Date: ${r.businessDate} | RegisterCash: ${regCash} | Required: ${r.requiredAmount} | Deposited: ${r.depositedAmount} | Pending: ${r.pendingAmount} | Excess: ${r.excessAmount} | Status: ${r.status}`);
  }

  // 5. Verify Johar Town
  console.log('\n=== VERIFYING JOHAR TOWN ===');
  const jtReqs = await prisma.dailyCashRequirement.findMany({
    where: { outletName: 'Johar Town', businessDate: { gte: '2026-09-15' } },
    orderBy: { businessDate: 'asc' },
    include: { allocations: { include: { cashDeposit: true } } },
  });

  for (const r of jtReqs) {
    const regCash = await getAuthoritativeRegisterCash('Johar Town', r.businessDate);
    console.log(`Date: ${r.businessDate} | RegisterCash: ${regCash} | Required: ${r.requiredAmount} | Deposited: ${r.depositedAmount} | Pending: ${r.pendingAmount} | Excess: ${r.excessAmount} | Status: ${r.status}`);
  }

  console.log('\n=== ALL CHECKS FINISHED ===');
}

main()
  .catch(err => {
    console.error('Realign error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
