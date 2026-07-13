const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const employees = await prisma.outletEmployee.findMany();
  console.log('Employees in DB:', employees.length);
  employees.forEach(e => console.log(`  ${e.name} @ ${e.outletName} (active: ${e.isActive})`));
  const entries = await prisma.journalEntry.findMany();
  console.log('Journal entries in DB:', entries.length);
}
main().catch(e => console.error(e.message)).finally(() => prisma.$disconnect());
