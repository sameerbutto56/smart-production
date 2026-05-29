const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  const hashedPassword = await bcrypt.hash('enamels11221', 10);

  console.log('🔄 Fixing roles and creating delivery user...');

  // 1. Fix Dispatch Manager role (from MAIN_EMPLOYEE to DISPATCH)
  await prisma.user.updateMany({
    where: { email: 'dispatch@smartpro.com' },
    data: { role: 'DISPATCH', name: 'Dispatch Manager' }
  });

  // 2. Create Out for Delivery user
  await prisma.user.upsert({
    where: { email: 'delivery@smartpro.com' },
    update: { role: 'OUT_FOR_DELIVERY' },
    create: {
      email: 'delivery@smartpro.com',
      name: 'Delivery Partner',
      password: hashedPassword,
      role: 'OUT_FOR_DELIVERY'
    }
  });

  console.log('✅ Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
