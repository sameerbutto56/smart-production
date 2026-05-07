const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeOrderAndFaisal() {
  console.log('🔄 Merging Order Entry into Faisal Control...');
  
  try {
    // 1. Update order@smartpro.com to have FAISAL role and name
    await prisma.user.update({
      where: { email: 'order@smartpro.com' },
      data: {
        role: 'FAISAL',
        name: 'Faisal Control (Order Login)'
      }
    });
    console.log('✅ Updated order@smartpro.com to FAISAL role.');

    // 2. (Optional) Could delete the old faisal@smartpro.com if desired, 
    // but better to just leave it or rename it for now to avoid breaking anything.
    await prisma.user.update({
      where: { email: 'faisal@smartpro.com' },
      data: {
        name: 'Faisal (Old Account)',
        email: 'faisal_old@smartpro.com'
      }
    });
    console.log('✅ Renamed old faisal@smartpro.com to faisal_old@smartpro.com.');

  } catch (error) {
    console.error('❌ Error merging accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

mergeOrderAndFaisal();
