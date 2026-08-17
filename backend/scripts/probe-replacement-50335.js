// Read-only probe for the replacement-workflow fix: order 50335 + any
// replacement cases/orders tied to it. Deleted after use.
const prisma = require('../src/prisma');

async function dumpOrder(label, order) {
  if (!order) { console.log(`\n${label}: NOT FOUND`); return; }
  const routingHistory = await prisma.routingHistory.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'asc' }
  });
  const seenTasks = await prisma.seenTask.findMany({
    where: { orderId: order.id },
    orderBy: { seenAt: 'asc' }
  });
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify({
    id: order.id,
    orderNumber: order.orderNumber,
    invoiceNumber: order.invoiceNumber,
    source: order.source,
    type: order.type,
    priority: order.priority,
    customerName: order.customerName,
    currentStage: order.currentStage,
    status: order.status,
    replacementCaseId: order.replacementCaseId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    completedAt: order.completedAt,
    deliveredAt: order.deliveredAt
  }, null, 2));
  console.log('  STAGES:');
  for (const s of order.stages || []) {
    console.log(JSON.stringify({ stageName: s.stageName, status: s.status, startedAt: s.startedAt, completedAt: s.completedAt, deadlineAt: s.deadlineAt, assignedEmployee: s.assignedEmployee, returnReason: s.returnReason, createdAt: s.createdAt }));
  }
  console.log('  ROUTING:');
  for (const h of routingHistory) {
    console.log(JSON.stringify({ previousStage: h.previousStage, newStage: h.newStage, sentToStage: h.sentToStage, sentByUserId: h.sentByUserId, remarks: h.remarks, createdAt: h.createdAt }));
  }
  console.log('  SEEN TASKS:');
  for (const t of seenTasks) {
    console.log(JSON.stringify({ userId: t.userId, stageName: t.stageName, seenAt: t.seenAt }));
  }
}

async function main() {
  // 1. Original order(s) matching 50335
  const originals = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { contains: '50335', mode: 'insensitive' } },
        { invoiceNumber: { contains: '50335', mode: 'insensitive' } }
      ]
    },
    include: { stages: { orderBy: { createdAt: 'asc' } } }
  });
  console.log(`Found ${originals.length} order(s) containing 50335`);
  for (const o of originals) await dumpOrder('ORDER ' + o.orderNumber, o);

  // 2. All returnExchange cases where orderNumber mentions 50335 OR linked to these orders
  const originalIds = originals.map(o => o.id);
  const cases = await prisma.returnExchange.findMany({
    where: {
      OR: [
        { orderId: { in: originalIds } },
        { orderNumber: { contains: '50335', mode: 'insensitive' } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`\nFound ${cases.length} returnExchange case(s)`);
  for (const c of cases) {
    console.log(JSON.stringify({
      id: c.id,
      type: c.type,
      status: c.status,
      routedTo: c.routedTo,
      orderId: c.orderId,
      orderNumber: c.orderNumber,
      replacementOrderId: c.replacementOrderId,
      replacementCaseIdField: c.replacementCaseId,
      specialNote: c.specialNote,
      replacementCompleted: c.replacementCompleted,
      originalRestocked: c.originalRestocked,
      storeAcceptedAt: c.storeAcceptedAt,
      storeProcessedAt: c.storeProcessedAt,
      faisalApprovedAt: c.faisalApprovedAt,
      replacementSummary: c.replacementSummary,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }, null, 2));
    if (c.replacementOrderId) {
      const rep = await prisma.order.findUnique({
        where: { id: c.replacementOrderId },
        include: { stages: { orderBy: { createdAt: 'asc' } } }
      });
      await dumpOrder('REP ORDER ' + (rep?.orderNumber || c.replacementOrderId), rep);
    }
  }

  // 3. Simulate lookupOrder search for 50335 (the logic at returnExchange.controller.js:36-48)
  const lookup = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { equals: '50335', mode: 'insensitive' } },
        { orderNumber: { endsWith: '50335', mode: 'insensitive' } },
        { invoiceNumber: { equals: '50335', mode: 'insensitive' } },
        { invoiceNumber: { endsWith: '50335', mode: 'insensitive' } },
        { customerPhone: { contains: '50335' } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`\nlookupOrder('50335') -> ${lookup ? lookup.orderNumber + ' (id ' + lookup.id + ', source ' + lookup.source + ')' : 'NOT FOUND'}`);

  const lookupRep = await prisma.order.findFirst({
    where: { source: 'REPLACEMENT', orderNumber: { equals: 'REP-50335', mode: 'insensitive' } }
  });
  console.log(`lookupOrder('REP-50335') -> ${lookupRep ? lookupRep.orderNumber + ' (id ' + lookupRep.id + ')' : 'NOT FOUND'}`);
}

main().finally(() => prisma.$disconnect());
