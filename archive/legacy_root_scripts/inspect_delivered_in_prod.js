const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== INSPECTING COMPLETED ORDERS IN PRODUCTION QUEUE ===');
  const orderNumbers = [
    '#48965', '##48965', '#48893', '##48893', '#48895', '##48895',
    '#48917', '##48917', '#48938', '##48938', '#48952', '##48952',
    '#48855', '##48855', '#48951', '##48951', '#48979', '##48979'
  ];

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { in: orderNumbers } },
        { orderNumber: { contains: '48965' } },
        { orderNumber: { contains: '48893' } },
        { orderNumber: { contains: '48895' } },
        { orderNumber: { contains: '48917' } },
        { orderNumber: { contains: '48938' } },
        { orderNumber: { contains: '48952' } },
        { orderNumber: { contains: '48855' } },
        { orderNumber: { contains: '48951' } },
        { orderNumber: { contains: '48979' } }
      ]
    },
    select: {
      id: true,
      orderNumber: true,
      currentStage: true,
      status: true,
      createdAt: true,
      deliveredAt: true,
      source: true,
      stages: {
        select: { id: true, stageName: true, status: true }
      }
    }
  });

  console.log(`Found ${orders.length} matching orders:`);
  for (const o of orders) {
    console.log(`\nOrder #${o.orderNumber} (id: ${o.id})`);
    console.log(`  status: "${o.status}"`);
    console.log(`  currentStage: "${o.currentStage}"`);
    console.log(`  source: "${o.source}"`);
    console.log(`  deliveredAt: ${o.deliveredAt}`);
    console.log('  stages:', o.stages);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
