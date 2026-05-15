const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.order.count();
  console.log('Current Order Count:', count);
  const orders = await prisma.order.findMany({ 
    select: { id: true, orderNumber: true, status: true, createdAt: true } 
  });
  console.log('Orders:', orders);
}

main().finally(() => prisma.$disconnect());
