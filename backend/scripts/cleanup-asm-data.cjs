const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('=== STARTING ASM DATA CLEANUP ===\n');

  // 1. Identify the keeper: latest ASM vendor/request created yesterday and already sent to Store
  const keeperOrder = await prisma.vendorOrder.findFirst({
    where: {
      currentStage: { in: ['SENT_TO_STORE', 'SENT_TO_ASM', 'ASM_ACCEPTED', 'GIVE_STOCK'] },
      items: { some: {} },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      vendor: true,
      items: true,
    }
  });

  if (!keeperOrder) {
    throw new Error('Could not identify keeper order! Aborting cleanup.');
  }

  console.log('IDENTIFIED KEEPER ASM VENDOR & REQUEST:');
  console.log(`  Order Number: ${keeperOrder.orderNumber}`);
  console.log(`  Order ID:     ${keeperOrder.id}`);
  console.log(`  Vendor:       ${keeperOrder.vendor?.name} (ID: ${keeperOrder.vendorId}, Phone: ${keeperOrder.vendor?.phone})`);
  console.log(`  Stage:        ${keeperOrder.currentStage}`);
  console.log(`  Items Count:  ${keeperOrder.items.length}`);
  console.log(`  Created At:   ${keeperOrder.createdAt.toISOString()}`);

  const keeperOrderId = keeperOrder.id;
  const keeperVendorId = keeperOrder.vendorId;

  // Master data pre-counts to verify no shared master data is touched
  const userCountBefore = await prisma.user.count();
  const productCountBefore = await prisma.inventoryItem.count();

  // 2. Perform Transactional Cleanup of all other ASM test data
  const result = await prisma.$transaction(async (tx) => {
    // Delete non-keeper orders (cascade deletes items, statusHistory, documentRevisions, documents, allocations, routingItems, inventoryAudits, payments)
    const deletedOrders = await tx.vendorOrder.deleteMany({
      where: {
        id: { not: keeperOrderId }
      }
    });

    // Delete non-keeper vendors
    const deletedVendors = await tx.vendor.deleteMany({
      where: {
        id: { not: keeperVendorId }
      }
    });

    return { deletedOrders: deletedOrders.count, deletedVendors: deletedVendors.count };
  });

  console.log(`\nCleanup Results:`);
  console.log(`  Deleted Test Orders:  ${result.deletedOrders}`);
  console.log(`  Deleted Test Vendors: ${result.deletedVendors}`);

  // 3. Post-cleanup verification
  const remainingOrders = await prisma.vendorOrder.findMany({
    select: { id: true, orderNumber: true, currentStage: true, vendor: { select: { name: true } } }
  });
  const remainingVendors = await prisma.vendor.findMany({
    select: { id: true, name: true, phone: true }
  });

  console.log('\nPost-Cleanup Remaining State:');
  console.log('  Remaining Orders:', remainingOrders.length);
  remainingOrders.forEach(o => console.log(`    - ${o.orderNumber} (Stage: ${o.currentStage}, Vendor: ${o.vendor?.name})`));
  console.log('  Remaining Vendors:', remainingVendors.length);
  remainingVendors.forEach(v => console.log(`    - ${v.name} (${v.phone})`));

  // Master data safety verification
  const userCountAfter = await prisma.user.count();
  const productCountAfter = await prisma.inventoryItem.count();
  console.log(`\nMaster Data Integrity Check:`);
  console.log(`  Users: ${userCountBefore} -> ${userCountAfter} (Unchanged: ${userCountBefore === userCountAfter})`);
  console.log(`  Inventory Items: ${productCountBefore} -> ${productCountAfter} (Unchanged: ${productCountBefore === productCountAfter})`);

  if (remainingOrders.length !== 1 || remainingOrders[0].id !== keeperOrderId) {
    throw new Error('Safety assertion failed: keeper order is not the only order remaining!');
  }
  if (remainingVendors.length !== 1 || remainingVendors[0].id !== keeperVendorId) {
    throw new Error('Safety assertion failed: keeper vendor is not the only vendor remaining!');
  }

  console.log('\n✓ ASM DATA CLEANUP COMPLETED SUCCESSFULLY!');
  await prisma.$disconnect();
}

cleanup().catch(e => {
  console.error('Cleanup error:', e);
  prisma.$disconnect();
  process.exit(1);
});
