const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true, email: true }
    });
    console.log('All Users:', JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

check();
