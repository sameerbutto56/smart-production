const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating user roles to match new system...');

  // Update Admin Boss to SUPER_ADMIN
  await prisma.user.update({
    where: { email: 'admin@smartpro.com' },
    data: { role: 'SUPER_ADMIN', name: 'Super Admin' }
  });

  // Create or Update Faisal
  await prisma.user.upsert({
    where: { email: 'faisal@smartpro.com' },
    update: { role: 'FAISAL' },
    create: {
      email: 'faisal@smartpro.com',
      name: 'Faisal Control',
      password: 'password123', // In a real app, hash this
      role: 'FAISAL'
    }
  });

  // Update employee roles to match new schema
  const roleMap = {
    'STORE_EMPLOYEE': 'STORE',
    'CUTTING_EMPLOYEE': 'CUTTING',
    'STITCHING_EMPLOYEE': 'STITCHING',
    'QUALITY_CHECK_EMPLOYEE': 'QA',
    'PRESSING_EMPLOYEE': 'PRESSING_PACKING',
    'PACKAGING_EMPLOYEE': 'PRESSING_PACKING',
    'ORDER_EMPLOYEE': 'ORDER_ENTRY'
  };

  for (const [oldRole, newRole] of Object.entries(roleMap)) {
    await prisma.user.updateMany({
      where: { role: oldRole },
      data: { role: newRole }
    });
  }

  console.log('✅ User roles synchronized!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
