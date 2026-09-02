const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== AUDITING ACTIVE DB ORDERS ===');
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
    },
    select: {
      id: true,
      orderNumber: true,
      currentStage: true,
      status: true,
    }
  });

  console.log(`Total Active Non-Terminal Orders in DB: ${activeOrders.length}`);

  const byStage = {};
  for (const o of activeOrders) {
    byStage[o.currentStage] = (byStage[o.currentStage] || 0) + 1;
  }
  console.log('Active Orders Count by currentStage:', byStage);

  // 1. Auto-fix stale OrderStage rows where order is completed/delivered/cancelled/rejected
  const fixedStages = await prisma.orderStage.updateMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      order: {
        status: { in: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
      }
    },
    data: {
      status: 'COMPLETED',
      completedAt: new Date()
    }
  });
  console.log(`Fixed ${fixedStages.count} stale OrderStage rows to COMPLETED.`);

  // 2. Bulk fix completed orders with mismatched currentStage
  const fixedCompleted = await prisma.order.updateMany({
    where: {
      status: 'COMPLETED',
      currentStage: { not: 'COMPLETED' }
    },
    data: { currentStage: 'COMPLETED' }
  });
  console.log(`Fixed ${fixedCompleted.count} COMPLETED orders with mismatched currentStage.`);

  // 3. Bulk fix delivered orders with mismatched currentStage
  const fixedDelivered = await prisma.order.updateMany({
    where: {
      status: 'DELIVERED',
      currentStage: { not: 'DELIVERED' }
    },
    data: { currentStage: 'DELIVERED' }
  });
  console.log(`Fixed ${fixedDelivered.count} DELIVERED orders with mismatched currentStage.`);

  console.log('=== AUDIT COMPLETE ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
