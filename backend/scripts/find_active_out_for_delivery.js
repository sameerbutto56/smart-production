const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findOutForDelivery() {
  // Find all orders currently in OUT_FOR_DELIVERY stage or with OUT_FOR_DELIVERY status
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { currentStage: 'OUT_FOR_DELIVERY' },
        { status: 'OUT_FOR_DELIVERY' },
        { dispatchStatus: { in: ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'DISPATCHED', 'BOOKED'] } },
        { stages: { some: { stageName: 'OUT_FOR_DELIVERY', status: { not: 'COMPLETED' } } } }
      ]
    },
    include: {
      stages: { orderBy: { createdAt: 'desc' } },
      auditLogs: { orderBy: { timestamp: 'desc' }, take: 5 }
    }
  });

  console.log(`Found ${orders.length} orders in OUT_FOR_DELIVERY / active dispatch:`);
  for (const o of orders) {
    console.log('-----------------------------------------');
    console.log({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      currentStage: o.currentStage,
      status: o.status,
      dispatchStatus: o.dispatchStatus,
      deliveryType: o.deliveryType,
      deliveryMethod: o.deliveryMethod,
      deliveredAt: o.deliveredAt,
      createdAt: o.createdAt,
      recentAudit: o.auditLogs.map(a => `${a.action}: ${a.details}`),
      stages: o.stages.map(s => `${s.stageName}(${s.status})`)
    });
  }
}

findOutForDelivery().catch(console.error).finally(() => prisma.$disconnect());
