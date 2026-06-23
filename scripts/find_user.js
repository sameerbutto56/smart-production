const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users in DB:");
  for (const u of users) {
    console.log(`- [${u.role}] ${u.name} (ID: ${u.id})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
