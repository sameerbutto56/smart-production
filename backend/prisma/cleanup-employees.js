const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.outletEmployee.deleteMany({ where: { name: 'Gull', outletName: 'Johar Town' } });
  console.log('Cleaned up duplicate Gull');
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
