/**
 * Inspect orders in OUT_FOR_DELIVERY / ENAMELS_DELIVERY
 * Separated by Yesterday or earlier vs Today
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// PKT midnight start of today: 2026-09-01T19:00:00.000Z
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
      source: true,
      currentStage: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      stages: {
        where: { stageName: { in: ['OUT_FOR_DELIVERY', 'ENAMELS_DELIVERY'] } },
        select: { stageName: true, status: true, createdAt: true, startedAt: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Total active OUT_FOR_DELIVERY / ENAMELS_DELIVERY orders in DB: ${deliveryOrders.length}\n`);

  const yesterdayOrEarlier = [];
  const todayOrders = [];

  deliveryOrders.forEach(o => {
    // Check when stage was entered or order created
    const stage = o.stages[0];
    const enteredAt = stage?.createdAt || o.createdAt;
    const isToday = new Date(enteredAt) >= todayStart;
    
    if (isToday) {
      todayOrders.push(o);
    } else {
      yesterdayOrEarlier.push(o);
    }
  });

  console.log(`=== TODAY'S ORDERS (DO NOT TOUCH) [Count: ${todayOrders.length}] ===`);
  todayOrders.forEach(o => {
    console.log(`  #${o.orderNumber} | stage=${o.currentStage} | created=${o.createdAt.toISOString()}`);
  });

  console.log(`\n=== YESTERDAY OR EARLIER ORDERS (TO MARK DELIVERED) [Count: ${yesterdayOrEarlier.length}] ===`);
  yesterdayOrEarlier.forEach(o => {
    console.log(`  #${o.orderNumber} | stage=${o.currentStage} | created=${o.createdAt.toISOString()}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
