const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // 1. Enamels system user (SOFTWARE_SETTINGS) — email login
  const enamelsPassword = await bcrypt.hash('Enamels 9165', 10);
  await prisma.user.upsert({
    where: { email: 'sameer@enamels.com' },
    update: { name: 'Enamels', password: enamelsPassword, role: 'SOFTWARE_SETTINGS' },
    create: { name: 'Enamels', email: 'sameer@enamels.com', password: enamelsPassword, role: 'SOFTWARE_SETTINGS' },
  });

  // 2. Dispatch / Faisal profile employees (name-only login)
  const khawarPassword = await bcrypt.hash('K170', 10);
  const faisalPassword = await bcrypt.hash('F170', 10);
  await prisma.outletEmployee.upsert({
    where: { name_outletName: { name: 'Khawar', outletName: 'Dispatch' } },
    update: { password: khawarPassword, isActive: true, profiles: ['DISPATCH', 'FAISAL_PROFILE'] },
    create: { name: 'Khawar', outletName: 'Dispatch', password: khawarPassword, isActive: true, profiles: ['DISPATCH', 'FAISAL_PROFILE'] },
  });
  await prisma.outletEmployee.upsert({
    where: { name_outletName: { name: 'Faisal', outletName: 'Dispatch' } },
    update: { password: faisalPassword, isActive: true, profiles: ['DISPATCH', 'FAISAL_PROFILE'] },
    create: { name: 'Faisal', outletName: 'Dispatch', password: faisalPassword, isActive: true, profiles: ['DISPATCH', 'FAISAL_PROFILE'] },
  });

  // 3. Backfill profiles on existing outlet employees missing them (default POS + OUTLET_ORDER_ENTRY)
  const existing = await prisma.outletEmployee.findMany({});
  let backfilled = 0;
  for (const emp of existing) {
    if (!emp.profiles || (Array.isArray(emp.profiles) && emp.profiles.length === 0)) {
      await prisma.outletEmployee.update({
        where: { id: emp.id },
        data: { profiles: ['POS', 'OUTLET_ORDER_ENTRY'] },
      });
      backfilled++;
    }
  }

  const enamelsUser = await prisma.user.findUnique({ where: { email: 'sameer@enamels.com' }, select: { name: true, email: true, role: true } });
  console.log('Enamels user:', JSON.stringify(enamelsUser));
  console.log('Dispatch employees upserted: Khawar, Faisal');
  console.log(`Backfilled profiles on ${backfilled} existing outlet employees`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
