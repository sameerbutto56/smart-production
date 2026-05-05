const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.order.count();
  console.log(`Total orders in DB: ${count}`);
  const users = await prisma.user.count();
  console.log(`Total users in DB: ${users}`);
  process.exit(0);
}

check();
