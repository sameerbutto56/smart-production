const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('1234', 10);

  const employees = [
    // Johar Town (matches existing POS employee list)
    { name: 'Sajawal', outletName: 'Johar Town', password },
    { name: 'Junaid', outletName: 'Johar Town', password },
    { name: 'Gul', outletName: 'Johar Town', password },
    { name: 'Zain', outletName: 'Johar Town', password },
    // Jail Road
    { name: 'Aamir', outletName: 'Jail Road', password },
    { name: 'Ibrar', outletName: 'Jail Road', password },
    { name: 'Junaid', outletName: 'Jail Road', password },
  ];

  for (const emp of employees) {
    await prisma.outletEmployee.upsert({
      where: { name_outletName: { name: emp.name, outletName: emp.outletName } },
      update: { password: emp.password, isActive: true },
      create: emp,
    });
  }

  console.log(`Seeded ${employees.length} outlet employees`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
