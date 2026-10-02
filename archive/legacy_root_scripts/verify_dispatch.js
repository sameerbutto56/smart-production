const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.order.count({
  where: {
    currentStage: 'DISPATCH',
    status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
  }
}).then(n => {
  console.log('Remaining active DISPATCH orders:', n);
  return p.order.count({
    where: {
      currentStage: { in: ['DISPATCH', 'IN_DISPATCH', 'OUT_FOR_DELIVERY'] },
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    }
  });
}).then(n2 => {
  console.log('Active DISPATCH+IN_DISPATCH+OUT_FOR_DELIVERY total:', n2);
}).finally(() => p.$disconnect());
