const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const cases = await p.returnExchange.findMany({
    where: { orderNumber: '#49502' },
    select: { id: true, status: true, routedTo: true, replacementOrderId: true, createdAt: true, storeProcessedAt: true, originalRestocked: true }
  });
  for (const c of cases) {
    let rep = null;
    if (c.replacementOrderId) {
      rep = await p.order.findUnique({
        where: { id: c.replacementOrderId },
        select: { orderNumber: true, currentStage: true, status: true, replacementCaseId: true, createdAt: true }
      });
    }
    console.log('CASE', c.status, c.routedTo, 'repOrder=', c.replacementOrderId, 'created', c.createdAt.toISOString(), 'restocked=', c.originalRestocked);
    if (rep) console.log('   REP ORDER:', rep.orderNumber, '| stage', rep.currentStage, '| status', rep.status, '| replacementCaseId', rep.replacementCaseId);
  }
  await p.$disconnect();
})();
