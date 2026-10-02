const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function resetAllPasswords() {
  const NEW_PASSWORD = 'enamels11221';
  
  try {
    await prisma.$connect();
    console.log('Connected to database');

    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users\n`);

    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      console.log(`✅ ${user.name} (${user.email}) - role: ${user.role} - password reset`);
    }

    console.log(`\n🎉 All ${users.length} accounts now have password: ${NEW_PASSWORD}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetAllPasswords();
