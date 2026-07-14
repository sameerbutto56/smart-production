// Fix stuck orders at STORE stage with completed/inactive STORE stage records.
// Run: node prisma/fix-stuck-store-orders.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNOSTIC: Orders stuck at STORE with no active stage ===\n');

  const stuckOrders = await prisma.order.findMany({
    where: {
      currentStage: 'STORE',
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] },
      stages: {
        none: {
          stageName: 'STORE',
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      }
    },
    include: {
      stages: { orderBy: { createdAt: 'asc' } }
    }
  });

  console.log(`Found ${stuckOrders.length} stuck orders.\n`);

  for (const order of stuckOrders) {
    const storeStages = order.stages.filter(s => s.stageName === 'STORE');
    const otherStagesAfterStore = order.stages.filter(s =>
      s.stageName !== 'STORE' && s.stageName !== 'ORDER_ENTRY' &&
      s.status === 'PENDING'
    );

    console.log(`Order #${order.orderNumber} (${order.id})`);
    console.log(`  Status: ${order.status}, Source: ${order.source}`);
    console.log(`  STORE stages: ${storeStages.length}`);
    storeStages.forEach(s =>
      console.log(`    - status: ${s.status}, startedAt: ${s.startedAt ? s.startedAt.toISOString() : 'null'}, completedAt: ${s.completedAt ? s.completedAt.toISOString() : 'null'}, returnedFrom: ${s.returnedFrom || 'null'}`)
    );

    if (otherStagesAfterStore.length > 0) {
      console.log(`  Next pending stages found: ${otherStagesAfterStore.map(s => `${s.stageName} (${s.status})`).join(', ')}`);
      console.log(`  ACTION: currentStage will be updated to ${otherStagesAfterStore[0].stageName}`);

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { currentStage: otherStagesAfterStore[0].stageName, status: 'IN_PROGRESS' }
        });
        await tx.auditLog.create({
          data: {
            orderId: order.id,
            action: 'STUCK_ORDER_FIX',
            details: `Auto-fixed: currentStage updated from STORE to ${otherStagesAfterStore[0].stageName} (pending stage existed)`,
            performedBy: 'SYSTEM'
          }
        });
      });
      console.log('  ✅ Fixed\n');
    } else if (storeStages.some(s => s.status === 'COMPLETED' && s.completedAt)) {
      console.log(`  No pending successor stage. Last STORE stage completed at ${storeStages.find(s => s.status === 'COMPLETED')?.completedAt?.toISOString() || 'unknown'}`);
      console.log('  ACTION: Creating new PENDING STORE stage to make order actionable\n');

      await prisma.$transaction(async (tx) => {
        await tx.orderStage.create({
          data: { orderId: order.id, stageName: 'STORE', status: 'PENDING' }
        });
        await tx.auditLog.create({
          data: {
            orderId: order.id,
            action: 'STUCK_ORDER_FIX',
            details: 'Auto-fixed: created new PENDING STORE stage for previously stuck order',
            performedBy: 'SYSTEM'
          }
        });
      });
      console.log('  ✅ Fixed\n');
    } else {
      console.log('  ⚠️  No action taken (manual review needed)\n');
    }
  }

  const totalFixed = stuckOrders.filter(o => {
    const storeStages = o.stages.filter(s => s.stageName === 'STORE');
    const otherStages = o.stages.filter(s =>
      s.stageName !== 'STORE' && s.stageName !== 'ORDER_ENTRY' &&
      s.status === 'PENDING'
    );
    return otherStages.length > 0 || storeStages.some(s => s.status === 'COMPLETED' && s.completedAt);
  }).length;

  console.log(`\n=== Done. ${totalFixed}/${stuckOrders.length} stuck orders fixed. ===`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
