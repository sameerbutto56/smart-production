// Read-only probe for order 50335 (Store Receive -> Production routing fix). Deleted after use.
const prisma = require('../src/prisma');

async function main() {
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { contains: '50335', mode: 'insensitive' } },
        { invoiceNumber: { contains: '50335', mode: 'insensitive' } }
      ]
    },
    include: {
      stages: { orderBy: { createdAt: 'asc' } },
      auditLogs: { orderBy: { timestamp: 'asc' } }
    }
  });

  if (!order) { console.log('NOT FOUND'); return; }

  const routingHistory = await prisma.routingHistory.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'asc' }
  });

  const seenTasks = await prisma.seenTask.findMany({
    where: { orderId: order.id },
    orderBy: { seenAt: 'asc' }
  });

  console.log('=== ORDER ===');
  console.log(JSON.stringify({
    id: order.id,
    orderNumber: order.orderNumber,
    invoiceNumber: order.invoiceNumber,
    source: order.source,
    type: order.type,
    priority: order.priority,
    customerName: order.customerName,
    currentStage: order.currentStage,
    previousStage: order.previousStage,
    status: order.status,
    dispatchStatus: order.dispatchStatus,
    dispatchOfficer: order.dispatchOfficer,
    forwardedBy: order.forwardedBy,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    completedAt: order.completedAt,
    deliveredAt: order.deliveredAt,
    storeRequested: order.storeRequested,
    availabilityStatus: order.availabilityStatus
  }, null, 2));

  console.log('\n=== STAGES ===');
  for (const s of order.stages) {
    console.log(JSON.stringify({ id: s.id, stageName: s.stageName, status: s.status, startedAt: s.startedAt, completedAt: s.completedAt, deadlineAt: s.deadlineAt, assignedEmployee: s.assignedEmployee, returnReason: s.returnReason, createdAt: s.createdAt }));
  }

  console.log('\n=== ROUTING HISTORY ===');
  for (const h of routingHistory) {
    console.log(JSON.stringify({ id: h.id, previousStage: h.previousStage, newStage: h.newStage, sentToStage: h.sentToStage, sentByUserId: h.sentByUserId, remarks: h.remarks, createdAt: h.createdAt }));
  }

  console.log('\n=== AUDIT LOGS ===');
  for (const a of order.auditLogs) {
    console.log(JSON.stringify({ id: a.id, action: a.action, performedBy: a.performedBy, timestamp: a.timestamp, details: a.details }));
  }

  console.log('\n=== SEEN TASKS ===');
  for (const t of seenTasks) {
    console.log(JSON.stringify({ id: t.id, userId: t.userId, stageName: t.stageName, seenAt: t.seenAt }));
  }
}

main().finally(() => prisma.$disconnect());
