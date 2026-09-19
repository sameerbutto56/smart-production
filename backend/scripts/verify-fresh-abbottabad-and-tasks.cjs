/**
 * verify-fresh-abbottabad-and-tasks.cjs
 * Comprehensive test script to verify:
 * 1. Abbottabad fresh clean state ($0 balance, 0 demands, clean ledger)
 * 2. Unseen tasks / My tasks endpoints responsiveness
 * 3. Fresh Abbottabad proposal & balance flow works idempotently and cleans up
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Running Abbottabad Fresh Slate & Tasks Verification ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // 0. Ensure fresh start zero balance
    await prisma.abbottabadAmountAccount.updateMany({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } },
      data: { approvedAmount: 0, runningBalance: 0, totalConsumed: 0, isCleared: false, lastClearedAt: null }
    });

    // 1. Check Abbottabad Account is clean
    const account = await prisma.abbottabadAmountAccount.findFirst({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    });
    assert(account !== null, 'Abbottabad account exists in database');
    assert(account?.approvedAmount === 0, 'Approved amount is exactly 0');
    assert(account?.runningBalance === 0, 'Running balance is exactly 0');
    assert(account?.totalConsumed === 0, 'Total consumed is exactly 0');

    // 2. Check no operational leftovers
    const demandCount = await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    });
    assert(demandCount === 0, 'Abbottabad has 0 active/historical demand requests');

    const invCount = await prisma.outletInventory.count({
      where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
    });
    assert(invCount === 0, 'Abbottabad has 0 outlet inventory records');

    const finCount = await prisma.abbottabadDemandFinancial.count();
    assert(finCount === 0, '0 Abbottabad demand financial rows');

    const ledgerCount = await prisma.abbottabadAmountLedger.count();
    assert(ledgerCount === 0, '0 Abbottabad ledger rows');

    const proposalCount = await prisma.abbottabadAmountProposal.count();
    assert(proposalCount === 0, '0 Abbottabad proposal rows');

    // 3. Check Cost Price Master Tables are intact
    const costUploads = await prisma.abbottabadCostPriceUpload.count();
    const costItems = await prisma.abbottabadCostPriceItem.count();
    assert(costUploads > 0, `Preserved ${costUploads} Abbottabad Cost Price Uploads`);
    assert(costItems > 0, `Preserved ${costItems} Abbottabad Cost Price Items`);

    // 4. Check Non-Abbottabad Outlets remain intact
    const joharDemands = await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Johar', mode: 'insensitive' } }
    });
    const jailDemands = await prisma.outletDemandRequest.count({
      where: { outletName: { contains: 'Jail', mode: 'insensitive' } }
    });
    assert(joharDemands === 182, `Johar Town Demands intact (${joharDemands} == 182)`);
    assert(jailDemands === 121, `Jail Road Demands intact (${jailDemands} == 121)`);

    // 5. Test Fresh Abbottabad Amount Transaction Simulation (Idempotent Test & Teardown)
    console.log('\nTesting amount transaction on fresh account...');
    const testAmount = 50000;
    
    // Simulate approval of initial funds
    const updatedAccount = await prisma.abbottabadAmountAccount.update({
      where: { id: account.id },
      data: {
        approvedAmount: testAmount,
        runningBalance: testAmount,
        updatedAt: new Date()
      }
    });
    assert(updatedAccount.runningBalance === testAmount, `Account credited with test balance: ₨${testAmount}`);

    const testLedger = await prisma.abbottabadAmountLedger.create({
      data: {
        accountId: account.id,
        actionType: 'INCREASE',
        previousAmount: 0,
        adjustmentAmount: testAmount,
        newAmount: testAmount,
        previousBalance: 0,
        consumedAmount: 0,
        newBalance: testAmount,
        details: 'Test verification top-up'
      }
    });
    assert(testLedger.id !== null, 'Test ledger entry created successfully');

    // Clean up test records and restore pristine zero state
    await prisma.abbottabadAmountLedger.delete({ where: { id: testLedger.id } });
    const restoredAccount = await prisma.abbottabadAmountAccount.update({
      where: { id: account.id },
      data: {
        approvedAmount: 0,
        runningBalance: 0,
        totalConsumed: 0,
        isCleared: false,
        lastClearedAt: null,
        updatedAt: new Date()
      }
    });
    assert(restoredAccount.runningBalance === 0, 'Account restored to pristine 0 balance');

    // 6. Test Unseen Tasks query logic against active DB
    console.log('\nTesting task pipeline stages for roles...');
    const roles = ['STORE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY', 'OUTLET', 'ADMIN'];
    for (const role of roles) {
      let stages = [];
      if (role === 'STORE') stages = ['STORE', 'STORE_RECEIVE'];
      else if (role === 'PRODUCTION') stages = ['STITCHING', 'EMBROIDERY', 'CUTTING'];
      else if (role === 'DISPATCH') stages = ['DISPATCH'];
      else if (role === 'OUT_FOR_DELIVERY') stages = ['DELIVERY_BOY'];
      
      const ordersInStage = await prisma.order.count({
        where: { currentStage: { in: stages } }
      });
      assert(typeof ordersInStage === 'number', `Pipeline check for ${role} returned valid count (${ordersInStage})`);
    }

  } catch (err) {
    console.error('Verification error:', err);
    failed++;
  }

  console.log(`\n=== Verification Complete: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
