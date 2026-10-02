const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function updateAllPasswords() {
  const newPassword = 'enamels1212';
  console.log(`🔐 Updating all user passwords to: ${newPassword}`);
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  try {
    const result = await prisma.user.updateMany({
      data: {
        password: hashedPassword
      }
    });
    
    console.log(`✅ Success! Updated ${result.count} users.`);
  } catch (error) {
    console.error('❌ Error updating passwords:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAllPasswords();
