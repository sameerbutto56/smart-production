const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== AUDITING IN_DISPATCH ORDERS ===');

  // 1. Orders where currentStage is IN_DISPATCH
  const currentStageInDispatch = await prisma.order.findMany({
    where: {
      currentStage: 'IN_DISPATCH',
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    },
    select: { id: true, orderNumber: true, status: true, currentStage: true, outletName: true, source: true }
  });

  console.log(`\n1. Orders with currentStage = "IN_DISPATCH" (active non-returned): ${currentStageInDispatch.length}`);
  currentStageInDispatch.forEach(o => console.log(`   #${o.orderNumber} | status=${o.status} | outlet=${o.outletName}`));

  // 2. Orders where status is IN_DISPATCH but currentStage is NOT IN_DISPATCH
  const statusInDispatchDiffStage = await prisma.order.findMany({
    where: {
      status: 'IN_DISPATCH',
      currentStage: { not: 'IN_DISPATCH' }
    },
    select: { id: true, orderNumber: true, status: true, currentStage: true }
  });

  console.log(`\n2. Orders with status = "IN_DISPATCH" but currentStage != "IN_DISPATCH": ${statusInDispatchDiffStage.length}`);
  statusInDispatchDiffStage.forEach(o => console.log(`   #${o.orderNumber} | status=${o.status} | currentStage=${o.currentStage}`));

  // 3. Orders with active stage IN_DISPATCH in order.stages but currentStage != IN_DISPATCH
  const stageInDispatchDiffCurrent = await prisma.order.findMany({
    where: {
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] },
      currentStage: { not: 'IN_DISPATCH' },
      stages: {
        some: { stageName: 'IN_DISPATCH', status: 'IN_PROGRESS' }
      }
    },
    select: { id: true, orderNumber: true, status: true, currentStage: true }
  });

  console.log(`\n3. Active orders with IN_DISPATCH stage IN_PROGRESS but currentStage != IN_DISPATCH: ${stageInDispatchDiffCurrent.length}`);
  stageInDispatchDiffCurrent.forEach(o => console.log(`   #${o.orderNumber} | status=${o.status} | currentStage=${o.currentStage}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
