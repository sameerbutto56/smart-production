const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const todayStart = new Date(y, m, d);
  const todayEnd = new Date(y, m, d + 1);

  const totalOrders = await prisma.order.count();
  const totalOrdersToday = await prisma.order.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } });
  const faisalOrdersAll = await prisma.order.count({ where: { createdBy: { role: 'FAISAL' } } });
  const faisalOrdersToday = await prisma.order.count({ where: { createdAt: { gte: todayStart, lt: todayEnd }, createdBy: { role: 'FAISAL' } } });
  const createdByIdNull = await prisma.order.count({ where: { createdById: null } });
  const sourceNotOutlet = await prisma.order.count({ where: { source: { not: 'OUTLET' } } });

  console.log(JSON.stringify({
    totalOrders,
    totalOrdersToday,
    faisalOrdersAll,
    faisalOrdersToday,
    createdByIdNull,
    sourceNotOutlet,
    todayStart: todayStart.toISOString(),
    todayEnd: todayEnd.toISOString()
  }, null, 2));

  await prisma.$disconnect();
})();
