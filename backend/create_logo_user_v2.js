const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function createUser() {
  const hashedPassword = await bcrypt.hash('enamels11221', 10);
  try {
    const user = await prisma.user.upsert({
      where: { email: 'logo_design@smartpro.com' },
      update: {
        password: hashedPassword,
        role: 'LOGO_DESIGN'
      },
      create: {
        name: 'Logo Designer',
        email: 'logo_design@smartpro.com',
        password: hashedPassword,
        role: 'LOGO_DESIGN',
        employeeId: 'EMP-LOGO-002'
      }
    });
    console.log('✅ Logo Designer user created:', user.email);
  } catch (error) {
    console.error('❌ Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
