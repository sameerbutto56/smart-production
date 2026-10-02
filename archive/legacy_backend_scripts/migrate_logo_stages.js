const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateStages() {
  try {
    // 1. Update orders where currentStage is old logo names
    const ordersToUpdate = await prisma.order.updateMany({
      where: {
        currentStage: { in: ['NAME_LOGO', 'CUSTOM_LOGO'] }
      },
      data: {
        currentStage: 'LOGO_DESIGN'
      }
    });
    console.log(`✅ Updated ${ordersToUpdate.count} orders currentStage`);

    // 2. Update order stages where stageName is old logo names
    const stagesToUpdate = await prisma.orderStage.updateMany({
      where: {
        stageName: { in: ['NAME_LOGO', 'CUSTOM_LOGO'] }
      },
      data: {
        stageName: 'LOGO_DESIGN'
      }
    });
    console.log(`✅ Updated ${stagesToUpdate.count} order stages stageName`);

  } catch (error) {
    console.error('❌ Migration Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateStages();
