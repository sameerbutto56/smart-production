const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@smartpro.com' }
  });
  console.log('User admin@smartpro.com:', user);
  process.exit(0);
}

check();
