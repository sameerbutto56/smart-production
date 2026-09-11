const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findStuckTakeaway() {
  console.log('--- Checking all orders with currentStage = OUT_FOR_DELIVERY ---');
  const outForDeliveryOrders = await prisma.order.findMany({
    where: {
      OR: [
        { currentStage: 'OUT_FOR_DELIVERY' },
        { status: 'OUT_FOR_DELIVERY' },
        { currentStage: 'IN_DISPATCH' }
      ]
    },
    include: {
      stages: { orderBy: { createdAt: 'desc' } },
      auditLogs: { orderBy: { timestamp: 'desc' }, take: 10 }
    }
  });

  console.log(`Found ${outForDeliveryOrders.length} orders with currentStage/status OUT_FOR_DELIVERY or IN_DISPATCH:`);
  for (const o of outForDeliveryOrders) {
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
      audits: o.auditLogs.map(a => `${a.action}: ${a.details}`),
      stages: o.stages.map(s => `${s.stageName}(${s.status})`)
    });
  }

  // Also check any dispatch log where dispatchMethod is CUSTOMER_TAKEAWAY or WALK_IN and order is not DELIVERED/COMPLETED
  const takeawayLogs = await prisma.dispatchLog.findMany({
    where: {
      dispatchMethod: { in: ['CUSTOMER_TAKEAWAY', 'WALK_IN'] }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`\nChecking all ${takeawayLogs.length} CUSTOMER_TAKEAWAY / WALK_IN dispatch logs for any order not completed:`);
  for (const l of takeawayLogs) {
    const ord = await prisma.order.findUnique({
      where: { id: l.orderId },
      include: { stages: { orderBy: { createdAt: 'desc' } } }
    });
    if (ord && (ord.currentStage !== 'COMPLETED' && ord.currentStage !== 'DELIVERED' || ord.status !== 'COMPLETED' && ord.status !== 'DELIVERED')) {
      console.log('STUCK ORDER FOUND:', {
        id: ord.id,
        orderNumber: ord.orderNumber,
        customerName: ord.customerName,
        currentStage: ord.currentStage,
        status: ord.status,
        dispatchStatus: ord.dispatchStatus,
        deliveryType: ord.deliveryType,
        deliveryMethod: ord.deliveryMethod,
        deliveredAt: ord.deliveredAt,
        logMethod: l.dispatchMethod,
        logDate: l.createdAt
      });
    }
  }

  // Also search audit logs for CUSTOMER_TAKEAWAY or Takeaway
  const takeawayAudits = await prisma.auditLog.findMany({
    where: {
      details: { contains: 'takeaway', mode: 'insensitive' }
    },
    orderBy: { timestamp: 'desc' }
  });
  console.log(`\nFound ${takeawayAudits.length} audit logs mentioning takeaway:`);
  for (const a of takeawayAudits) {
    const ord = await prisma.order.findUnique({
      where: { id: a.orderId },
      select: { id: true, orderNumber: true, currentStage: true, status: true, dispatchStatus: true, deliveryType: true, deliveryMethod: true }
    });
    console.log('Audit log:', a.action, a.details, 'Order:', ord);
  }
}

findStuckTakeaway().catch(console.error).finally(() => prisma.$disconnect());
