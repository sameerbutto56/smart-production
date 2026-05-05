const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    include: { stages: true }
  });
  console.log(`Total orders: ${orders.length}`);
  const waiting = orders.filter(o => o.stages.some(s => s.status === 'WAITING_APPROVAL'));
  console.log(`Orders waiting approval: ${waiting.length}`);
  if (waiting.length > 0) {
    console.log('First waiting order stages statuses:', waiting[0].stages.map(s => s.status));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
