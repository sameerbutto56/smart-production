const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUpdate() {
  try {
    // Find a user
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No user found to test update');
      process.exit(1);
    }
    
    const originalName = user.name;
    const testName = originalName + ' (Test Update)';
    
    // Update
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: testName }
    });
    console.log('Update successful. New name:', updated.name);
    
    // Revert
    await prisma.user.update({
      where: { id: user.id },
      data: { name: originalName }
    });
    console.log('Revert successful. Restored name:', originalName);
    
    process.exit(0);
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
}

testUpdate();
