const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function createUser() {
  const hashedPassword = await bcrypt.hash('enamels1212', 10);
  try {
    const user = await prisma.user.upsert({
      where: { email: 'logo@enamels.com' },
      update: {
        password: hashedPassword,
        role: 'LOGO_DESIGN'
      },
      create: {
        name: 'Logo Designer',
        email: 'logo@enamels.com',
        password: hashedPassword,
        role: 'LOGO_DESIGN',
        employeeId: 'EMP-LOGO-001'
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
