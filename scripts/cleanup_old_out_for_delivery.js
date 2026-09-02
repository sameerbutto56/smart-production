/**
 * cleanup_old_out_for_delivery.js
 * 
 * Rule:
 * - DO NOT TOUCH orders assigned to Enamels Delivery TODAY (Sep 2, 2026 PKT).
 * - Mark as DELIVERED only old OUT_FOR_DELIVERY / ENAMELS_DELIVERY orders from yesterday or earlier.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
function startOfTodayPKT() {
  const nowPKT = new Date(Date.now() + PKT_OFFSET_MS);
  nowPKT.setUTCHours(0, 0, 0, 0);
  return new Date(nowPKT.getTime() - PKT_OFFSET_MS);
}

async function main() {
  const todayStart = startOfTodayPKT();
  console.log(`\nToday PKT Start (UTC): ${todayStart.toISOString()}\n`);

  // Find all active orders in OUT_FOR_DELIVERY or ENAMELS_DELIVERY stage
  const deliveryOrders = await prisma.order.findMany({
    where: {
      currentStage: { in: ['OUT_FOR_DELIVERY', 'ENAMELS_DELIVERY'] },
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    },
    select: {
      id: true,
      orderNumber: true,
      currentStage: true,
      status: true,
      createdAt: true,
      orderAcceptances: {
        select: {
          id: true,
          riderName: true,
          assignedAt: true,
          deliveredAt: true
        }
      }
    }
  });

  const ordersToUpdate = [];
  const ordersToSkip = [];

  deliveryOrders.forEach(o => {
    // Check if there is an active acceptance assigned TODAY
    const assignedToday = o.orderAcceptances.some(a => a.assignedAt && new Date(a.assignedAt) >= todayStart);

    if (assignedToday) {
      ordersToSkip.push(o);
    } else {
      ordersToUpdate.push(o);
    }
  });

  console.log(`=== SKIPPING (Assigned Today in Enamels Delivery) [Count: ${ordersToSkip.length}] ===`);
  ordersToSkip.forEach(o => {
    const acc = o.orderAcceptances.find(a => a.assignedAt && new Date(a.assignedAt) >= todayStart);
    console.log(`  #${o.orderNumber} | assignedAt=${acc?.assignedAt}`);
  });

  console.log(`\n=== MARKING AS DELIVERED (Yesterday or Earlier) [Count: ${ordersToUpdate.length}] ===`);
  ordersToUpdate.forEach(o => {
    console.log(`  #${o.orderNumber} | createdAt=${o.createdAt.toISOString()}`);
  });

  if (ordersToUpdate.length === 0) {
    console.log('\nNo old delivery orders to update.');
    return;
  }

  const idsToUpdate = ordersToUpdate.map(o => o.id);
  const now = new Date();

  // 1. Mark OUT_FOR_DELIVERY and ENAMELS_DELIVERY stages as COMPLETED
  const stageResult = await prisma.orderStage.updateMany({
    where: {
      orderId: { in: idsToUpdate },
      stageName: { in: ['OUT_FOR_DELIVERY', 'ENAMELS_DELIVERY'] },
      status: { notIn: ['COMPLETED'] }
    },
    data: {
      status: 'COMPLETED',
      completedAt: now
    }
  });

  // 2. Advance the order status and currentStage to DELIVERED
  const orderResult = await prisma.order.updateMany({
    where: {
      id: { in: idsToUpdate }
    },
    data: {
      status: 'DELIVERED',
      currentStage: 'DELIVERED',
      deliveredAt: now
    }
  });

  // 3. Close old orderAcceptances if any
  const acceptanceResult = await prisma.orderAcceptance.updateMany({
    where: {
      orderId: { in: idsToUpdate },
      deliveredAt: null
    },
    data: {
      deliveredAt: now
    }
  });

  console.log(`\n✅ Marked ${stageResult.count} delivery stage records as COMPLETED`);
  console.log(`✅ Marked ${orderResult.count} orders as status=DELIVERED, currentStage=DELIVERED`);
  console.log(`✅ Closed ${acceptanceResult.count} old orderAcceptance records`);
  console.log(`\nDone. Today's ${ordersToSkip.length} Enamels Delivery tasks remain completely untouched.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
