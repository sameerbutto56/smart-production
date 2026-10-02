const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSTIC RECOVERY REPORT ---');
  
  const itemCount = await prisma.inventoryItem.count();
  const variantCount = await prisma.outletVariant.count();
  const logsCount = await prisma.auditLog.count({
    where: {
      action: {
        contains: 'DELETE'
      }
    }
  });

  console.log(`Current Inventory Items: ${itemCount}`);
  console.log(`Current Outlet Variants: ${variantCount}`);
  console.log(`Delete-related Audit Logs: ${logsCount}`);

  // Fetch recent delete logs
  const recentDeleteLogs = await prisma.auditLog.findMany({
    where: {
      details: {
        contains: 'delete'
      }
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: 10
  });

  console.log('\n--- RECENT DELETE LOGS ---');
  recentDeleteLogs.forEach(log => {
    console.log(`[${log.timestamp.toISOString()}] User ${log.performedBy}: ${log.details}`);
  });

  // Let's also check if there are deleted orders or records with item descriptions
  const deletedOrders = await prisma.deletedOrder.findMany({
    orderBy: { deletedAt: 'desc' },
    take: 5
  });
  console.log(`\nDeleted Orders Count: ${deletedOrders.length}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
