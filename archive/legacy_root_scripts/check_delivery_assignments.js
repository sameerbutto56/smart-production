/**
 * Check Enamels Delivery assignments for the 33 OUT_FOR_DELIVERY orders
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
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
          acceptedAt: true,
          deliveredAt: true
        }
      }
    }
  });

  console.log(`Checking ${deliveryOrders.length} orders for active delivery assignments:\n`);

  let activeDeliveryCount = 0;
  let noActiveDeliveryCount = 0;

  deliveryOrders.forEach(o => {
    // Active if assigned/accepted but NOT deliveredAt
    const activeAcceptance = o.orderAcceptances.find(a => a.assignedAt && !a.deliveredAt);
    if (activeAcceptance) {
      activeDeliveryCount++;
      console.log(`  [ACTIVE ENAMELS DELIVERY TASK] #${o.orderNumber} | rider=${activeAcceptance.riderName} | assignedAt=${activeAcceptance.assignedAt}`);
    } else {
      noActiveDeliveryCount++;
      console.log(`  [NO ACTIVE TASK / COURIER ORDER] #${o.orderNumber} | acceptances=${o.orderAcceptances.length}`);
    }
  });

  console.log(`\nSummary: ${activeDeliveryCount} have active Enamels Delivery rider tasks, ${noActiveDeliveryCount} have NO active rider task (third-party courier / past backlog).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
