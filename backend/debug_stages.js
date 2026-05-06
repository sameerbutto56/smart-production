const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStages() {
  const orders = await prisma.order.findMany({
    where: { status: { not: 'COMPLETED' } },
    select: { currentStage: true, id: true }
  });
  console.log('Active Current Stages:', orders.map(o => o.currentStage));

  const stages = await prisma.orderStage.findMany({
    where: { status: 'WAITING_APPROVAL' },
    select: { stageName: true, orderId: true }
  });
  console.log('Stages Waiting Approval:', stages.map(s => s.stageName));
  
  await prisma.$disconnect();
}

checkStages();
