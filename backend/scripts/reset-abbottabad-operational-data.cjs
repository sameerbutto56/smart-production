/**
 * reset-abbottabad-operational-data.cjs
 * Standalone, transactional script to completely wipe Abbottabad operational data,
 * resetting its balance to 0 and removing all Abbottabad demands, ledger, inventory,
 * and session records while asserting ZERO impact on other outlets and master data.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Starting Abbottabad Operational Data Reset ===\n');

  // 1. Pre-audit non-Abbottabad and master record counts
  const preCounts = {
    categories: await prisma.productCategoryConfig.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    users: await prisma.user.count(),
    joharDemands: await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Johar', mode: 'insensitive' } }
    }),
    jailDemands: await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Jail', mode: 'insensitive' } }
    }),
    joharInventory: await prisma.outletInventory.count({
      where: { outletName: { contains: 'Johar', mode: 'insensitive' } }
    }),
    jailInventory: await prisma.outletInventory.count({
      where: { outletName: { contains: 'Jail', mode: 'insensitive' } }
    }),
    totalSales: await prisma.posSale.count(),
    totalReturns: await prisma.posReturn.count(),
    costUploads: await prisma.abbottabadCostPriceUpload.count(),
    costItems: await prisma.abbottabadCostPriceItem.count()
  };

  console.log('Pre-reset Baseline Counts (Must remain strictly unchanged):');
  console.table(preCounts);

  // 2. Pre-audit Abbottabad operational rows
  const abbottabadPre = {
    demands: await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    }),
    inventory: await prisma.outletInventory.count({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    }),
    financials: await prisma.abbottabadDemandFinancial.count(),
    ledgers: await prisma.abbottabadAmountLedger.count(),
    proposals: await prisma.abbottabadAmountProposal.count(),
    bookSessions: await prisma.posBookSession.count({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    }),
    account: await prisma.abbottabadAmountAccount.findFirst({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    })
  };

  console.log('\nAbbottabad Operational Data to be Cleared:');
  console.log({
    demands: abbottabadPre.demands,
    inventory: abbottabadPre.inventory,
    financials: abbottabadPre.financials,
    ledgers: abbottabadPre.ledgers,
    proposals: abbottabadPre.proposals,
    bookSessions: abbottabadPre.bookSessions,
    account: abbottabadPre.account ? {
      approvedAmount: abbottabadPre.account.approvedAmount,
      runningBalance: abbottabadPre.account.runningBalance,
      totalConsumed: abbottabadPre.account.totalConsumed
    } : 'None'
  });

  // 3. Execute atomic reset in a single Prisma transaction
  console.log('\nExecuting atomic transaction...');
  await prisma.$transaction(async (tx) => {
    // A. Delete Abbottabad Demand Financials
    const delFin = await tx.abbottabadDemandFinancial.deleteMany({});
    console.log(`- Deleted ${delFin.count} abbottabadDemandFinancial rows`);

    // B. Delete Abbottabad Amount Ledgers
    const delLed = await tx.abbottabadAmountLedger.deleteMany({});
    console.log(`- Deleted ${delLed.count} abbottabadAmountLedger rows`);

    // C. Delete Abbottabad Amount Proposals
    const delProp = await tx.abbottabadAmountProposal.deleteMany({});
    console.log(`- Deleted ${delProp.count} abbottabadAmountProposal rows`);

    // D. Reset Abbottabad Amount Account to 0 balance
    const existingAccount = await tx.abbottabadAmountAccount.findFirst({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    });

    if (existingAccount) {
      await tx.abbottabadAmountAccount.update({
        where: { id: existingAccount.id },
        data: {
          approvedAmount: 0,
          runningBalance: 0,
          totalConsumed: 0,
          isCleared: false,
          lastClearedAt: null,
          updatedAt: new Date()
        }
      });
      console.log(`- Reset abbottabadAmountAccount (${existingAccount.id}) to 0 balance`);
    } else {
      await tx.abbottabadAmountAccount.create({
        data: {
          outletName: 'Abbottabad',
          approvedAmount: 0,
          runningBalance: 0,
          totalConsumed: 0,
          isCleared: false
        }
      });
      console.log(`- Initialized new abbottabadAmountAccount for Abbottabad with 0 balance`);
    }

    // E. Delete Abbottabad Outlet Demands
    const delDemands = await tx.outletDemandRequest.deleteMany({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    });
    console.log(`- Deleted ${delDemands.count} Abbottabad outletDemandRequest rows`);

    // F. Delete Abbottabad Outlet Inventory
    const delInv = await tx.outletInventory.deleteMany({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    });
    console.log(`- Deleted ${delInv.count} Abbottabad outletInventory rows`);

    // G. Delete or close any Abbottabad PosBookSession
    const delSessions = await tx.posBookSession.deleteMany({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    });
    console.log(`- Deleted ${delSessions.count} Abbottabad posBookSession rows`);
  });

  console.log('\nTransaction successfully committed!\n');

  // 4. Post-reset verification of Abbottabad state
  const abbottabadPost = {
    demands: await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    }),
    inventory: await prisma.outletInventory.count({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    }),
    financials: await prisma.abbottabadDemandFinancial.count(),
    ledgers: await prisma.abbottabadAmountLedger.count(),
    proposals: await prisma.abbottabadAmountProposal.count(),
    bookSessions: await prisma.posBookSession.count({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    }),
    account: await prisma.abbottabadAmountAccount.findFirst({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    })
  };

  console.log('Post-reset Abbottabad Operational State (Must be all zero / clean):');
  console.log({
    demands: abbottabadPost.demands,
    inventory: abbottabadPost.inventory,
    financials: abbottabadPost.financials,
    ledgers: abbottabadPost.ledgers,
    proposals: abbottabadPost.proposals,
    bookSessions: abbottabadPost.bookSessions,
    account: abbottabadPost.account ? {
      approvedAmount: abbottabadPost.account.approvedAmount,
      runningBalance: abbottabadPost.account.runningBalance,
      totalConsumed: abbottabadPost.account.totalConsumed,
      isCleared: abbottabadPost.account.isCleared
    } : 'None'
  });

  if (
    abbottabadPost.demands !== 0 ||
    abbottabadPost.inventory !== 0 ||
    abbottabadPost.financials !== 0 ||
    abbottabadPost.ledgers !== 0 ||
    abbottabadPost.proposals !== 0 ||
    abbottabadPost.bookSessions !== 0 ||
    !abbottabadPost.account ||
    abbottabadPost.account.approvedAmount !== 0 ||
    abbottabadPost.account.runningBalance !== 0 ||
    abbottabadPost.account.totalConsumed !== 0
  ) {
    throw new Error('FAILED: Abbottabad operational state is not completely reset to zero!');
  }
  console.log('✓ PASS: Abbottabad operational data is 100% clean and reset to zero.');

  // 5. Post-reset assertion: Non-Abbottabad and master counts must match pre-counts exactly
  const postCounts = {
    categories: await prisma.productCategoryConfig.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    users: await prisma.user.count(),
    joharDemands: await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Johar', mode: 'insensitive' } }
    }),
    jailDemands: await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Jail', mode: 'insensitive' } }
    }),
    joharInventory: await prisma.outletInventory.count({
      where: { outletName: { contains: 'Johar', mode: 'insensitive' } }
    }),
    jailInventory: await prisma.outletInventory.count({
      where: { outletName: { contains: 'Jail', mode: 'insensitive' } }
    }),
    totalSales: await prisma.posSale.count(),
    totalReturns: await prisma.posReturn.count(),
    costUploads: await prisma.abbottabadCostPriceUpload.count(),
    costItems: await prisma.abbottabadCostPriceItem.count()
  };

  console.log('\nPost-reset Non-Abbottabad & Master Counts:');
  console.table(postCounts);

  for (const [key, val] of Object.entries(preCounts)) {
    if (postCounts[key] !== val) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: ${key} changed from ${val} to ${postCounts[key]}!`);
    }
  }
  console.log('✓ PASS: Zero impact confirmed! Every non-Abbottabad and master catalog record was 100% preserved.\n');
}

main()
  .catch((e) => {
    console.error('Reset Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
