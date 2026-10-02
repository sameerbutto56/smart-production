const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Starting database cleanup...');

  try {
    // 1. Delete Audit Logs
    const auditLogs = await prisma.auditLog.deleteMany({});
    console.log(`✅ Deleted ${auditLogs.count} audit logs.`);

    // 2. Delete Order Stages
    const orderStages = await prisma.orderStage.deleteMany({});
    console.log(`✅ Deleted ${orderStages.count} order stages.`);

    // 3. Delete Orders
    const orders = await prisma.order.deleteMany({});
    console.log(`✅ Deleted ${orders.count} orders.`);

    // 4. Delete Inventory Items
    const inventory = await prisma.inventoryItem.deleteMany({});
    console.log(`✅ Deleted ${inventory.count} inventory items.`);

    console.log('\n✨ Database is now CLEAN. You can start adding fresh data.');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
