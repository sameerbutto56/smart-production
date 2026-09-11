const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('Searching for Customer Takeaway orders...');

  // Check orders where deliveryType is WALK_IN, or deliveryMethod contains takeaway or walk_in, or dispatchMethod is CUSTOMER_TAKEAWAY
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { deliveryType: 'WALK_IN' },
        { deliveryMethod: { contains: 'takeaway', mode: 'insensitive' } },
        { deliveryMethod: { contains: 'walk_in', mode: 'insensitive' } },
        { deliveryMethod: { contains: 'customer', mode: 'insensitive' } },
      ]
    },
    include: {
      stages: { orderBy: { createdAt: 'desc' } }
    }
  });

  console.log(`Found ${orders.length} orders matching deliveryType/deliveryMethod:`);
  for (const o of orders) {
    console.log({
      id: o.id,
      orderNumber: o.orderNumber,
      invoiceNumber: o.invoiceNumber,
      customerName: o.customerName,
      currentStage: o.currentStage,
      status: o.status,
      dispatchStatus: o.dispatchStatus,
      deliveryType: o.deliveryType,
      deliveryMethod: o.deliveryMethod,
      deliveredAt: o.deliveredAt,
      createdAt: o.createdAt,
      stages: o.stages.map(s => ({ stageName: s.stageName, status: s.status }))
    });
  }

  // Also check DispatchLog
  const logs = await prisma.dispatchLog.findMany({
    where: {
      dispatchMethod: { in: ['CUSTOMER_TAKEAWAY', 'WALK_IN'] }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`\nFound ${logs.length} dispatch logs for CUSTOMER_TAKEAWAY / WALK_IN:`);
  for (const l of logs) {
    const ord = await prisma.order.findUnique({
      where: { id: l.orderId },
      select: { id: true, orderNumber: true, currentStage: true, status: true, dispatchStatus: true, deliveredAt: true, deliveryType: true }
    });
    console.log('DispatchLog:', {
      orderId: l.orderId,
      officerName: l.officerName,
      action: l.action,
      dispatchMethod: l.dispatchMethod,
      createdAt: l.createdAt,
      order: ord
    });
  }
}

inspect().catch(console.error).finally(() => prisma.$disconnect());
