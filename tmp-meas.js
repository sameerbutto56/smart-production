const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.order.findMany({
  where: {
    sizeData: { not: null },
    NOT: { sizeData: '{}' }
  },
  orderBy: { createdAt: 'desc' },
  take: 30,
  select: { orderNumber: true, type: true }
}).then(orders => {
  console.log('Orders WITH measurement data:');
  orders.forEach(o => console.log('  ' + o.orderNumber + ' (' + o.type + ')'));
  console.log('Total: ' + orders.length);
  prisma.$disconnect();
}).catch(e => { console.error(e); prisma.$disconnect(); });
