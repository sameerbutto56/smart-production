const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all orders stuck in DISPATCH stage that are active (not completed/delivered)
  const stuckOrders = await prisma.order.findMany({
    where: {
      currentStage: 'DISPATCH',
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    },
    select: {
      id: true,
      orderNumber: true,
      currentStage: true,
      status: true,
      source: true,
      customerName: true,
      createdAt: true,
      stages: {
        orderBy: { createdAt: 'desc' },
        select: { stageName: true, status: true, completedAt: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\nTotal stuck DISPATCH orders (active): ${stuckOrders.length}\n`);
  console.log('Sample (first 20):');
  stuckOrders.slice(0, 20).forEach(o => {
    const dispatchStage = o.stages.find(s => s.stageName === 'DISPATCH');
    console.log(`  #${o.orderNumber} | status=${o.status} | source=${o.source} | dispatchStageStatus=${dispatchStage?.status} | completedAt=${dispatchStage?.completedAt}`);
  });

  // Check if any of these already have a DISPATCH stage marked COMPLETED
  const alreadyCompletedDispatch = stuckOrders.filter(o => 
    o.stages.some(s => s.stageName === 'DISPATCH' && s.status === 'COMPLETED')
  );
  console.log(`\nOf those, ${alreadyCompletedDispatch.length} already have DISPATCH stage COMPLETED (but order.currentStage still = DISPATCH)`);
  
  // Show by source distribution
  const bySrc = {};
  stuckOrders.forEach(o => { bySrc[o.source] = (bySrc[o.source] || 0) + 1; });
  console.log('\nBy source:', bySrc);
}

main().catch(console.error).finally(() => prisma.$disconnect());
