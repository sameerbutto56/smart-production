const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    },
    select: {
      id: true,
      orderNumber: true,
      currentStage: true,
      status: true,
      createdAt: true,
      stages: {
        select: { stageName: true, status: true, createdAt: true }
      }
    }
  });

  console.log(`Total active orders in DB: ${activeOrders.length}`);
  
  const stageCounts = {};
  activeOrders.forEach(o => {
    stageCounts[o.currentStage] = (stageCounts[o.currentStage] || 0) + 1;
  });
  console.log('Active orders by currentStage:', stageCounts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
