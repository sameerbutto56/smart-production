const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const outlets = [
    { name: 'Outlet 1', email: 'outlet1@smart.com', password: 'outlet1password', role: 'OUTLET', employeeId: 'OUT001' },
    { name: 'Outlet 2', email: 'outlet2@smart.com', password: 'outlet2password', role: 'OUTLET', employeeId: 'OUT002' },
    { name: 'Outlet 3', email: 'outlet3@smart.com', password: 'outlet3password', role: 'OUTLET', employeeId: 'OUT003' },
  ];

  for (const outlet of outlets) {
    const hashedPassword = await bcrypt.hash(outlet.password, 10);
    try {
      const user = await prisma.user.upsert({
        where: { email: outlet.email },
        update: {
          role: 'OUTLET',
          password: hashedPassword,
        },
        create: {
          name: outlet.name,
          email: outlet.email,
          password: hashedPassword,
          role: 'OUTLET',
          employeeId: outlet.employeeId,
        },
      });
      console.log(`Created/Updated user: ${user.name} (${user.email})`);
    } catch (error) {
      console.error(`Error processing user ${outlet.email}:`, error);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
