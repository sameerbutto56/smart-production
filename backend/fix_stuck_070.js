const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStuckOrders() {
  console.log('Searching for stuck PENDING orders...');
  
  const stuckOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      currentStage: 'ORDER_ENTRY'
    }
  });

  console.log(`Found ${stuckOrders.length} stuck orders.`);

  for (const order of stuckOrders) {
    console.log(`Pusing order ${order.orderNumber || order.id} to STORE stage...`);
    
    // Check if STORE stage already exists
    const storeStage = await prisma.orderStage.findFirst({
      where: {
        orderId: order.id,
        stageName: 'STORE'
      }
    });

    if (!storeStage) {
      await prisma.orderStage.create({
        data: {
          orderId: order.id,
          stageName: 'STORE',
          status: 'PENDING',
          deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
        }
      });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        currentStage: 'STORE',
        status: 'IN_PROGRESS'
      }
    });
  }

  console.log('Done.');
}

fixStuckOrders()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
