require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BLOCKED_CREATE = ['PENDING', 'FAISAL_APPROVED', 'IN_PRODUCTION', 'STORE_RECEIVE', 'DISPATCH_READY', 'WAREHOUSE_APPROVED'];
const EXCLUDED_INFLIGHT = ['CANCELLED', 'COMPLETED', 'REPLACEMENT_COMPLETED', 'WAREHOUSE_REJECTED'];

async function main() {
  const cases = await prisma.returnExchange.findMany({
    where: { type: 'REPLACEMENT' },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Total REPLACEMENT cases: ${cases.length}`);

  const byOrder = {};
  cases.forEach(c => {
    if (!byOrder[c.orderId]) byOrder[c.orderId] = [];
    byOrder[c.orderId].push(c);
  });
  const multi = Object.entries(byOrder).filter(([, arr]) => arr.length > 1);
  console.log(`Orders with >1 replacement case: ${multi.length}`);
  for (const [orderId, arr] of multi) {
    console.log(`\n  order ${orderId}: ${arr.length} cases`);
    for (const c of arr) {
      const liveOrder = c.replacementOrderId
        ? await prisma.order.findUnique({ where: { id: c.replacementOrderId }, select: { id: true, orderNumber: true, currentStage: true, status: true } })
        : null;
      console.log(`    case ${c.id.slice(0, 8)} status=${c.status} routedTo=${c.routedTo} repOrder=${c.replacementOrderId ? c.replacementOrderId.slice(0, 8) : 'null'} created=${c.createdAt.toISOString()}`);
      if (c.replacementOrderId) {
        console.log(`      REP order: ${liveOrder ? `${liveOrder.orderNumber} stage=${liveOrder.currentStage} status=${liveOrder.status}` : 'MISSING (dead link)'}`);
      }
    }
  }

  // Count "zombie" cases: in a blocked status but their REP order is dead/missing/completed
  let zombies = 0;
  for (const c of cases) {
    if (!c.replacementOrderId) continue;
    if (EXCLUDED_INFLIGHT.includes(c.status)) continue;
    const repOrder = await prisma.order.findUnique({ where: { id: c.replacementOrderId }, select: { id: true, currentStage: true, status: true } });
    const dead = !repOrder || repOrder.status === 'CANCELLED' || repOrder.status === 'COMPLETED' || repOrder.currentStage === 'DELIVERED';
    if (dead) {
      zombies++;
      console.log(`\nZOMBIE case ${c.id} order ${c.orderId} status=${c.status} routedTo=${c.routedTo} rep=${c.replacementOrderId} -> REP ${repOrder ? `${repOrder.orderNumber} ${repOrder.currentStage}/${repOrder.status}` : 'MISSING'}`);
    }
  }
  console.log(`\nZombie cases (blocked status but dead/completed REP order): ${zombies}`);

  // Simulate: would createReturnExchange's guard block a fresh replacement for these originals?
  const ordersWithZombie = new Set(cases.filter(c => {
    if (!c.replacementOrderId) return false;
    if (EXCLUDED_INFLIGHT.includes(c.status)) return false;
    return true;
  }).map(c => c.orderId));
  console.log(`Orders with any non-excluded case carrying a replacementOrderId: ${ordersWithZombie.size}`);
  for (const oid of ordersWithZombie) {
    console.log(`  ${oid}`);
  }
}

main()
  .catch(e => { console.error('PROBE ERROR:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
