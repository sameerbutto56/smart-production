const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    include: { stages: true }
  });
  console.log("Orders count:", orders.length);
  for (const o of orders) {
    console.log(`Order #${o.orderNumber} (ID: ${o.id})`);
    console.log(`  Current Stage: ${o.currentStage}`);
    console.log(`  Stages:`);
    for (const s of o.stages) {
      console.log(`    - [${s.status}] ${s.stageName} (ID: ${s.id})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
