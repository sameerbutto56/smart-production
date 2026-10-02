const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const waiting = await prisma.orderStage.count({
    where: { status: 'WAITING_APPROVAL' }
  });
  console.log('Orders waiting for approval:', waiting);
  process.exit(0);
}

check();
