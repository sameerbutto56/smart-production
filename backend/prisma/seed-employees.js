const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const defaultPassword = await bcrypt.hash('1234', 10);
  const gulPassword = await bcrypt.hash('G1122', 10);
  const junaidPassword = await bcrypt.hash('J125', 10);
  const sajawalPassword = await bcrypt.hash('Sajawal12', 10);
  const ibrarPassword = await bcrypt.hash('Ibrar562', 10);
  const mudassirPassword = await bcrypt.hash('75100', 10);

  const employees = [
    // Johar Town (matches existing POS employee list)
    { name: 'Sajawal', outletName: 'Johar Town', password: sajawalPassword },
    { name: 'Junaid', outletName: 'Johar Town', password: junaidPassword },
    { name: 'Gul', outletName: 'Johar Town', password: gulPassword },
    { name: 'Zain', outletName: 'Johar Town', password: defaultPassword },
    { name: 'Mudassir', outletName: 'Johar Town', password: mudassirPassword },
    // Jail Road
    { name: 'Aamir', outletName: 'Jail Road', password: defaultPassword },
    { name: 'Ibrar', outletName: 'Jail Road', password: ibrarPassword },
    { name: 'Junaid', outletName: 'Jail Road', password: junaidPassword },
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
