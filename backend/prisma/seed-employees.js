const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const defaultPassword = await bcrypt.hash('1234', 10);
  const zainPassword = await bcrypt.hash('123456', 10);
  const gulPassword = await bcrypt.hash('G1122', 10);
  const junaidPassword = await bcrypt.hash('J125', 10);
  const sajawalPassword = await bcrypt.hash('Sajawal12', 10);
  const ibrarPassword = await bcrypt.hash('Ibrar562', 10);
  const mudassirPassword = await bcrypt.hash('75100', 10);
  const amirPassword = await bcrypt.hash('A86150', 10);

  const employees = [
    // Johar Town (matches existing POS employee list)
    { name: 'Sajawal', outletName: 'Johar Town', password: sajawalPassword, profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
    { name: 'Junaid', outletName: 'Johar Town', password: junaidPassword, profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
    { name: 'Gul', outletName: 'Johar Town', password: gulPassword, profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
    { name: 'Zain', outletName: 'Johar Town', password: zainPassword, profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
    { name: 'Mudassir', outletName: 'Johar Town', password: mudassirPassword, profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
    // Jail Road
    { name: 'Aamir', outletName: 'Jail Road', password: amirPassword, profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
    { name: 'Ibrar', outletName: 'Jail Road', password: ibrarPassword, profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
    { name: 'Junaid', outletName: 'Jail Road', password: junaidPassword, profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
    // Dispatch / Faisal profile employees (name-only login, no outlet)
    { name: 'Khawar', outletName: 'Dispatch', password: await bcrypt.hash('K170', 10), profiles: ['DISPATCH', 'FAISAL_PROFILE'] },
    { name: 'Faisal', outletName: 'Dispatch', password: await bcrypt.hash('F170', 10), profiles: ['DISPATCH', 'FAISAL_PROFILE'] },
  ];

  for (const emp of employees) {
    await prisma.outletEmployee.upsert({
      where: { name_outletName: { name: emp.name, outletName: emp.outletName } },
      update: { password: emp.password, isActive: true, profiles: emp.profiles },
      create: emp,
    });
  }

  console.log(`Seeded ${employees.length} outlet employees`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
