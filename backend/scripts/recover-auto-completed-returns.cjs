// backend/scripts/recover-auto-completed-returns.cjs
// ===================================================================
// RECOVERY SCRIPT: Restore auto-completed return cases to Store workflow
//
// This script identifies RETURN cases from September 15 onward that were
// incorrectly auto-completed by bulkCompleteStaleReturns (handledBy condition)
// or redispatchOrder, and restores them to the Store return workflow.
//
// IDEMPOTENT: Running this script multiple times produces no duplicate changes.
// SAFE: Never auto-restocks. Store must manually process each recovered return.
//
// Usage: node backend/scripts/recover-auto-completed-returns.cjs [--dry-run]
// ===================================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const SEP_15_UTC = new Date('2026-09-14T19:00:00.000Z'); // Sep 15, 2026 00:00 PKT

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  RETURN RECOVERY SCRIPT ${DRY_RUN ? '(DRY RUN — no changes)' : '(LIVE MODE)'}`);
  console.log(`${'='.repeat(70)}\n`);

  // 1) Find all RETURN cases completed/cancelled from Sep 15 onward
  //    that were NOT legitimately processed through Store workflow
  const candidates = await prisma.returnExchange.findMany({
    where: {
      type: 'RETURN',
      status: { in: ['COMPLETED', 'CANCELLED'] },
      createdAt: { gte: SEP_15_UTC },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${candidates.length} COMPLETED/CANCELLED return cases from Sep 15 onward.\n`);

  // 2) Batch fetch linked orders
  const orderIds = [...new Set(candidates.map(c => c.orderId).filter(Boolean))];
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, status: true, orderNumber: true },
  });
  const orderMap = new Map(orders.map(o => [o.id, o]));

  // 3) Filter: only recover cases that were NOT legitimately completed
  //    A legitimate completion has BOTH:
  //    - storeAcceptedAt set (Store accepted the return)
  //    - completedBy set AND completedAt set (Store explicitly completed)
  //    - originalRestocked === true OR restockedProducts has entries
  const toRecover = [];
  const alreadyLegitimate = [];

  for (const c of candidates) {
    const hasStoreCompletion = c.storeAcceptedAt && c.completedBy && c.completedAt;
    const hasRestock = c.originalRestocked === true || (Array.isArray(c.restockedProducts) && c.restockedProducts.length > 0);

    if (hasStoreCompletion && hasRestock) {
      // This was legitimately processed through the full Store workflow
      alreadyLegitimate.push(c);
      continue;
    }

    // Check if the linked order was CANCELLED — those completions are valid
    const order = orderMap.get(c.orderId);
    if (order?.status === 'CANCELLED') {
      alreadyLegitimate.push(c);
      continue;
    }

    toRecover.push({ returnCase: c, order });
  }

  console.log(`  Legitimately completed (Store workflow or cancelled order): ${alreadyLegitimate.length}`);
  console.log(`  To recover (auto-completed without Store processing):      ${toRecover.length}\n`);

  if (toRecover.length === 0) {
    console.log('✓ No returns need recovery. All completions were legitimate.');
    await prisma.$disconnect();
    return;
  }

  // 3) Generate recovery report
  console.log(`${'─'.repeat(70)}`);
  console.log(`  RECOVERY REPORT`);
  console.log(`${'─'.repeat(70)}\n`);

  const report = [];
  for (const { returnCase: c, order } of toRecover) {
    const info = {
      returnId: c.id,
      orderNumber: c.orderNumber || order?.orderNumber || 'N/A',
      orderId: c.orderId,
      previousStatus: c.status,
      returnSource: c.returnSource || (c.deliveryReturnedBy ? 'ENAMELS_DELIVERY_BOY' : 'ORDER_LOOKUP'),
      returnReason: c.returnReason || 'N/A',
      handledBy: c.handledBy || 'N/A',
      inventoryAccepted: c.acceptedAt ? `Yes (${c.acceptedBy} at ${c.acceptedAt.toISOString()})` : 'No',
      storeAccepted: c.storeAcceptedAt ? `Yes (${c.storeAcceptedBy} at ${c.storeAcceptedAt.toISOString()})` : 'No',
      restocked: c.originalRestocked ? 'Yes' : 'No',
      createdAt: c.createdAt.toISOString(),
      correctedStatus: 'PENDING',
      correctedRoutedTo: 'STORE',
    };
    report.push(info);
    console.log(`  #${info.orderNumber} | ${info.previousStatus} → PENDING/STORE | Source: ${info.returnSource}`);
    console.log(`    Inventory Accepted: ${info.inventoryAccepted}`);
    console.log(`    Store Accepted: ${info.storeAccepted}`);
    console.log(`    Restocked: ${info.restocked}`);
    console.log(`    Handled By: ${info.handledBy}`);
    console.log('');
  }

  // 4) Execute recovery
  if (DRY_RUN) {
    console.log(`\n⚠  DRY RUN — no changes made. Run without --dry-run to apply.\n`);
  } else {
    console.log(`\n  Applying recovery to ${toRecover.length} cases...\n`);

    // Look up an admin user for AuditLog foreign key requirement
    const systemUser = await prisma.user.findFirst({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
      select: { id: true, name: true },
    });
    if (!systemUser) {
      throw new Error('No ADMIN or SUPER_ADMIN user found to record audit logs.');
    }
    console.log(`  Recording audit logs under user: ${systemUser.name} (${systemUser.id})\n`);

    let recovered = 0;
    for (const { returnCase: c } of toRecover) {
      try {
        await prisma.$transaction(async (tx) => {
          // Restore to Store pending — preserve all acceptance data
          await tx.returnExchange.update({
            where: { id: c.id },
            data: {
              status: 'PENDING',
              routedTo: 'STORE',
              // Preserve inventory acceptance data (acceptedBy, acceptedAt)
              // Do NOT clear completedBy/completedAt — preserve as historical
              // Do NOT auto-restock — Store must manually process
              // Set returnSource if not already set
              returnSource: c.returnSource || (c.deliveryReturnedBy ? 'ENAMELS_DELIVERY_BOY' : 'ORDER_LOOKUP'),
            },
          });

          // Create audit log for the recovery
          await tx.auditLog.create({
            data: {
              orderId: c.orderId,
              action: 'RETURN_RECOVERED',
              details: `Return case ${c.id} for order ${c.orderNumber || ''} recovered from ${c.status} to PENDING/STORE. Previous completion was auto-generated (no Store processing). Recovery script run at ${new Date().toISOString()}.`,
              performedBy: systemUser.id,
            },
          });
        });

        recovered++;
        console.log(`  ✓ Recovered #${c.orderNumber || c.id}`);
      } catch (err) {
        console.error(`  ✗ Failed to recover #${c.orderNumber || c.id}: ${err.message}`);
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`  RECOVERY COMPLETE: ${recovered}/${toRecover.length} cases restored to Store workflow`);
    console.log(`${'='.repeat(70)}\n`);
  }

  // 5) Summary
  console.log('SUMMARY:');
  console.log(`  Total COMPLETED/CANCELLED cases from Sep 15: ${candidates.length}`);
  console.log(`  Legitimately completed: ${alreadyLegitimate.length}`);
  console.log(`  Recovered to Store: ${toRecover.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Recovery script failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
