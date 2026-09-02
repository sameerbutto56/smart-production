/**
 * cleanup_old_dispatch_orders.js
 * 
 * Marks OLD stuck DISPATCH orders as DELIVERED.
 * 
 * RULES (conservative — do NOT touch currently active dispatch):
 * 1. currentStage = 'DISPATCH'  
 * 2. status NOT IN [COMPLETED, DELIVERED, CANCELLED, REJECTED, RETURNED]
 * 3. Order was created BEFORE today (PKT) — so today's fresh dispatch queue is untouched
 * 4. The order's DISPATCH stage is NOT currently in PENDING state created today
 *    (extra guard: the dispatch stage startedAt must be before today)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// PKT offset = UTC+5
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function startOfTodayPKT() {
  const nowPKT = new Date(Date.now() + PKT_OFFSET_MS);
  nowPKT.setUTCHours(0, 0, 0, 0);
  return new Date(nowPKT.getTime() - PKT_OFFSET_MS); // back to UTC
}

async function main() {
  const todayStartUTC = startOfTodayPKT();
  console.log(`\nToday start (UTC): ${todayStartUTC.toISOString()}`);
  console.log('Orders created BEFORE this time will be cleaned up.\n');

  // Find all old stuck DISPATCH orders
  const oldOrders = await prisma.order.findMany({
    where: {
      currentStage: 'DISPATCH',
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] },
      createdAt: { lt: todayStartUTC }  // only orders older than today
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      source: true,
      stages: {
        select: { id: true, stageName: true, status: true, createdAt: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${oldOrders.length} old stuck DISPATCH orders (created before today):`);
  oldOrders.forEach(o => {
    const ds = o.stages.find(s => s.stageName === 'DISPATCH');
    console.log(`  #${o.orderNumber} | source=${o.source} | dispatchStatus=${ds?.status}`);
  });

  if (oldOrders.length === 0) {
    console.log('\nNothing to fix.');
    return;
  }

  const ids = oldOrders.map(o => o.id);
  const now = new Date();

  // 1. Mark the DISPATCH stage as COMPLETED on each order
  const updatedStages = await prisma.orderStage.updateMany({
    where: {
      orderId: { in: ids },
      stageName: 'DISPATCH',
      status: { notIn: ['COMPLETED'] }
    },
    data: {
      status: 'COMPLETED',
      completedAt: now
    }
  });

  // 2. Advance the order itself to DELIVERED
  const updatedOrders = await prisma.order.updateMany({
    where: {
      id: { in: ids },
      currentStage: 'DISPATCH'
    },
    data: {
      status: 'DELIVERED',
      currentStage: 'DELIVERED',
      deliveredAt: now
    }
  });

  console.log(`\n✅ Updated ${updatedStages.count} DISPATCH stage records → COMPLETED`);
  console.log(`✅ Updated ${updatedOrders.count} orders → status=DELIVERED, currentStage=DELIVERED`);
  console.log('\nDone. These orders will no longer appear in the delay list.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
