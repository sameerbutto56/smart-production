/**
 * fix_stuck_takeaway_orders.cjs
 *
 * One-time migration: find orders stuck in OUT_FOR_DELIVERY that have
 * dispatchStatus='DELIVERED' and deliveredAt set (Customer Takeaway orders).
 * Fix them by:
 *   1. Setting currentStage → 'DELIVERED', status → 'COMPLETED'
 *   2. Completing the OUT_FOR_DELIVERY stage record
 *   3. Creating a DELIVERED stage record
 *   4. Adding an audit log entry
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Fix Stuck Customer Takeaway Orders ===\n');

  // Find orders stuck in OUT_FOR_DELIVERY with DELIVERED dispatchStatus
  const stuckOrders = await prisma.order.findMany({
    where: {
      currentStage: 'OUT_FOR_DELIVERY',
      dispatchStatus: 'DELIVERED',
      deliveredAt: { not: null }
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      currentStage: true,
      status: true,
      dispatchStatus: true,
      deliveryType: true,
      deliveredAt: true,
      stages: {
        where: { stageName: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] } },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  console.log(`Found ${stuckOrders.length} stuck order(s):\n`);

  if (stuckOrders.length === 0) {
    console.log('No stuck orders found. Nothing to fix.');
    return;
  }

  for (const order of stuckOrders) {
    console.log(`  #${order.orderNumber} (${order.id})`);
    console.log(`    currentStage: ${order.currentStage}`);
    console.log(`    status: ${order.status}`);
    console.log(`    dispatchStatus: ${order.dispatchStatus}`);
    console.log(`    deliveryType: ${order.deliveryType}`);
    console.log(`    deliveredAt: ${order.deliveredAt?.toISOString()}`);
    console.log('');
  }

  // Fix each stuck order
  let fixedCount = 0;
  for (const order of stuckOrders) {
    const now = new Date();
    const deliveredAt = order.deliveredAt || now;

    await prisma.$transaction(async (tx) => {
      // 1. Update the order to DELIVERED + COMPLETED
      await tx.order.update({
        where: { id: order.id },
        data: {
          currentStage: 'DELIVERED',
          status: 'COMPLETED'
        }
      });

      // 2. Complete the OUT_FOR_DELIVERY stage if still active
      const ofdStage = order.stages.find(s => s.stageName === 'OUT_FOR_DELIVERY' && s.status !== 'COMPLETED');
      if (ofdStage) {
        await tx.orderStage.update({
          where: { id: ofdStage.id },
          data: { status: 'COMPLETED', completedAt: deliveredAt }
        });
      }

      // 3. Create DELIVERED stage record if missing
      const hasDeliveredStage = order.stages.some(s => s.stageName === 'DELIVERED');
      if (!hasDeliveredStage) {
        await tx.orderStage.create({
          data: {
            orderId: order.id,
            stageName: 'DELIVERED',
            status: 'COMPLETED',
            completedAt: deliveredAt
          }
        });
      }

      // 4. Audit log (skip if no valid system user — performedBy is a FK)
      try {
        // Find any admin user to attribute the migration to
        const adminUser = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
        if (adminUser) {
          await tx.auditLog.create({
            data: {
              orderId: order.id,
              action: 'MIGRATION_FIX_TAKEAWAY_DELIVERED',
              details: `Migration: fixed stuck Customer Takeaway order from OUT_FOR_DELIVERY → DELIVERED. Original deliveredAt: ${deliveredAt.toISOString()}`,
              performedBy: adminUser.id,
              timestamp: now
            }
          });
        }
      } catch (e) {
        console.log(`    (audit log skipped: ${e.message})`);
      }
    });

    fixedCount++;
    console.log(`  ✓ Fixed #${order.orderNumber} → DELIVERED/COMPLETED`);
  }

  console.log(`\n=== Done: ${fixedCount}/${stuckOrders.length} orders fixed ===`);

  // Verify
  const stillStuck = await prisma.order.count({
    where: {
      currentStage: 'OUT_FOR_DELIVERY',
      dispatchStatus: 'DELIVERED',
      deliveredAt: { not: null }
    }
  });
  console.log(`\nVerification: ${stillStuck} orders still stuck (should be 0)`);
  if (stillStuck > 0) {
    console.error('WARNING: Some orders are still stuck!');
    process.exit(1);
  }
}

main()
  .catch(e => { console.error('Migration error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
