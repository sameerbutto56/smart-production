const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orderNumbers = ['30641', '40641', '50368', '50322', '50257', '50183', '50127', '50144', '50031'];

  const orders = await prisma.order.findMany({
    where: {
      OR: orderNumbers.map(n => ({ orderNumber: { contains: n } }))
    },
    select: {
      id: true,
      orderNumber: true,
      source: true,
      outletName: true,
      currentStage: true,
      status: true,
      customerName: true,
      createdAt: true,
      stages: {
        select: { stageName: true, status: true }
      }
    }
  });

  console.log(`\nFound ${orders.length} matching orders:\n`);
  orders.forEach(o => {
    console.log(`  #${o.orderNumber} | source=${o.source} | outletName=${o.outletName} | status=${o.status} | currentStage=${o.currentStage}`);
  });

  // Also get full picture of IN_DISPATCH orders by source
  const allInDispatch = await prisma.order.findMany({
    where: {
      currentStage: 'IN_DISPATCH',
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    },
    select: { id: true, orderNumber: true, source: true, outletName: true }
  });

  const bySrc = {};
  allInDispatch.forEach(o => {
    const key = `${o.source}|${o.outletName || 'n/a'}`;
    bySrc[key] = (bySrc[key] || 0) + 1;
  });

  console.log('\nAll active IN_DISPATCH orders by source+outlet:');
  Object.entries(bySrc).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`  TOTAL: ${allInDispatch.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
