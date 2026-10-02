const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const pending = await p.order.findMany({ where: { goForVerification: true, verifiedAt: null }, select: { id: true, orderNumber: true, currentStage: true, customerName: true }, take: 10 });
  console.log('Pending verification orders:', pending.length);
  pending.forEach(o => console.log(`  ${o.orderNumber} (${o.id}) - ${o.currentStage} - ${o.customerName}`));
  
  const verified = await p.order.findMany({ where: { goForVerification: true, verifiedAt: { not: null } }, select: { id: true, orderNumber: true, currentStage: true, verifiedByName: true }, take: 10 });
  console.log('\nVerified orders:', verified.length);
  verified.forEach(o => console.log(`  ${o.orderNumber} (${o.id}) - ${o.currentStage} - verified by ${o.verifiedByName}`));
  await p.$disconnect();
})();
