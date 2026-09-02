/**
 * Fix RETURNED orders stuck with currentStage=IN_DISPATCH
 * Their status is already RETURNED but currentStage was never updated
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stuck = await prisma.order.findMany({
    where: {
      currentStage: 'IN_DISPATCH',
      status: 'RETURNED'
    },
    select: { id: true, orderNumber: true, source: true }
  });

  console.log(`Found ${stuck.length} RETURNED orders stuck at IN_DISPATCH:`);
  stuck.forEach(o => console.log(`  #${o.orderNumber} | source=${o.source}`));

  if (stuck.length === 0) { console.log('Nothing to fix.'); return; }

  const ids = stuck.map(o => o.id);

  const result = await prisma.order.updateMany({
    where: { id: { in: ids }, status: 'RETURNED', currentStage: 'IN_DISPATCH' },
    data: { currentStage: 'RETURNED' }
  });

  console.log(`\n✅ Updated ${result.count} orders: currentStage IN_DISPATCH → RETURNED`);
  console.log('These will no longer appear in the In Dispatch page.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
