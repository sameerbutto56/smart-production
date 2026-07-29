const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // Simulate exactly what the backend does
  const from = "2026-07-28";  // frontend would send this due to PKT→UTC conversion
  const to = "2026-07-28";
  const dateFrom = from ? new Date(from) : new Date('2000-01-01');
  const dateTo = to ? new Date(to + 'T23:59:59.999Z') : new Date('2100-01-01');

  console.log('Backend dateFrom:', dateFrom.toISOString());
  console.log('Backend dateTo:', dateTo.toISOString());

  const faisalEntered = await prisma.order.count({
    where: { createdAt: { gte: dateFrom, lte: dateTo }, createdBy: { role: 'FAISAL' } }
  });

  const totalOrders = await prisma.order.count({
    where: { createdAt: { gte: dateFrom, lte: dateTo } }
  });

  const sourceNotOutlet = await prisma.order.count({
    where: { createdAt: { gte: dateFrom, lte: dateTo }, source: { not: 'OUTLET' } }
  });

  const distinctStageOrderCount = async (stageNameOrNames, dateField, statusFilter) => {
    const where = { stageName: Array.isArray(stageNameOrNames) ? { in: stageNameOrNames } : stageNameOrNames };
    if (dateField === 'startedAt') {
      where.startedAt = { gte: dateFrom, lte: dateTo };
      where.status = 'IN_PROGRESS';
    } else if (dateField === 'completedAt') {
      where.completedAt = { gte: dateFrom, lte: dateTo };
      where.status = 'COMPLETED';
    } else {
      where.createdAt = { gte: dateFrom, lte: dateTo };
      if (statusFilter) where.status = statusFilter;
    }
    const records = await prisma.orderStage.findMany({
      where,
      distinct: ['orderId'],
      select: { orderId: true }
    });
    return records.length;
  };

  const [storeAccepted, storeSentForward, storePending] = await Promise.all([
    distinctStageOrderCount('STORE', 'startedAt'),
    distinctStageOrderCount('STORE', 'completedAt'),
    distinctStageOrderCount('STORE', 'createdAt', 'PENDING'),
  ]);

  const [verificationVerified, verificationPendingCount, verificationReturned] = await Promise.all([
    prisma.order.count({ where: { verifiedAt: { gte: dateFrom, lte: dateTo } } }),
    prisma.order.count({ where: { goForVerification: true, verifiedAt: null, createdAt: { gte: dateFrom, lte: dateTo } } }),
    prisma.order.count({ where: { verificationReturnedAt: { gte: dateFrom, lte: dateTo } } }),
  ]);

  console.log(JSON.stringify({
    faisalEntered,
    totalOrders,
    sourceNotOutlet,
    store: { accepted: storeAccepted, sentForward: storeSentForward, pending: storePending },
    verification: { verified: verificationVerified, pending: verificationPendingCount, returned: verificationReturned },
  }, null, 2));

  await prisma.$disconnect();
})();
