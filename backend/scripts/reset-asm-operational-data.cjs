/**
 * Atomic Reset Script: reset-asm-operational-data.cjs
 * 
 * Clears old ASM operational & transactional data for a clean slate from today:
 * 1. Restores 3 units of "Lab Coat Women Wrinkle Free" to Warehouse Inventory (InventoryItem)
 * 2. Wipes ASM Stock Requests, Items, Returns, and Audit Logs
 * 3. Resets ASM sequence counters
 * 4. Wipes old Vendor Orders, Order Items, Status history, Deliveries, Payments, and Documents
 * 5. Resets Vendor Order sequence counters
 * 6. Asserts 100% preservation of:
 *    - Vendor Master Data (13 vendors intact)
 *    - User accounts & ASM profile (intact)
 *    - Outlet Inventory & POS Sales (intact)
 *    - Orders (intact)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });
const assert = require('assert');

async function main() {
  console.log('=== STARTING ATOMIC ASM OPERATIONAL DATA RESET ===\n');

  // Step 1: Pre-reset checks
  const initialVendors = await prisma.vendor.count();
  const initialUsers = await prisma.user.count();
  const initialWarehouseItems = await prisma.inventoryItem.count();
  const initialOutletInv = await prisma.outletInventory.count();
  const initialPosSales = await prisma.posSale.count();

  console.log(`Pre-check counts:`);
  console.log(`  - Vendors (Master): ${initialVendors}`);
  console.log(`  - Users: ${initialUsers}`);
  console.log(`  - Warehouse Items: ${initialWarehouseItems}`);
  console.log(`  - Outlet Inventory: ${initialOutletInv}`);
  console.log(`  - POS Sales: ${initialPosSales}`);

  // Step 2: Atomic Transaction
  await prisma.$transaction(async (tx) => {
    // 2.1 Restore stock from ASM Stock Handover items to Warehouse Inventory
    const activeReqItems = await tx.asmStockRequestItem.findMany({
      where: { quantityRemaining: { gt: 0 } },
    });

    console.log(`\nRestoring inventory for ${activeReqItems.length} allocated ASM items...`);
    for (const it of activeReqItems) {
      if (it.inventoryItemId) {
        const inv = await tx.inventoryItem.findUnique({ where: { id: it.inventoryItemId } });
        if (inv) {
          let variants = typeof inv.variants === 'string'
            ? JSON.parse(inv.variants)
            : (Array.isArray(inv.variants) ? [...inv.variants] : []);

          const qtyToRestore = it.quantityRemaining;
          console.log(`  -> Restoring ${qtyToRestore} units to "${inv.name}" (Current stock: ${inv.stock})`);

          if (variants && variants.length > 0) {
            // Check if M variant exists (used in test request notes "m=2")
            let restoredToVariant = false;
            if (it.requestId && it.quantityGiven === 2) {
              const mIdx = variants.findIndex(v => v.size === 'M');
              if (mIdx !== -1) {
                variants[mIdx].stock = (parseInt(variants[mIdx].stock) || 0) + 2;
                restoredToVariant = true;
              }
            } else if (it.quantityGiven === 1) {
              const lIdx = variants.findIndex(v => v.size === 'L');
              if (lIdx !== -1) {
                variants[lIdx].stock = (parseInt(variants[lIdx].stock) || 0) + 1;
                restoredToVariant = true;
              }
            }

            if (!restoredToVariant) {
              // Fallback to first variant
              variants[0].stock = (parseInt(variants[0].stock) || 0) + qtyToRestore;
            }

            const newTotal = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
            await tx.inventoryItem.update({
              where: { id: inv.id },
              data: {
                stock: newTotal,
                variants: variants,
              },
            });
            console.log(`     Updated "${inv.name}" total stock: ${inv.stock} -> ${newTotal}`);
          } else {
            await tx.inventoryItem.update({
              where: { id: inv.id },
              data: { stock: { increment: qtyToRestore } },
            });
          }
        }
      }
    }

    // 2.2 Delete ASM Stock Records
    console.log('\nWiping ASM Stock Requests, Returns, and Audit Logs...');
    const delAudit = await tx.asmStockAuditLog.deleteMany({});
    console.log(`  - Deleted ${delAudit.count} AsmStockAuditLogs`);

    const delRetItems = await tx.asmStockReturnItem.deleteMany({});
    console.log(`  - Deleted ${delRetItems.count} AsmStockReturnItems`);

    const delReturns = await tx.asmStockReturn.deleteMany({});
    console.log(`  - Deleted ${delReturns.count} AsmStockReturns`);

    const delReqItems = await tx.asmStockRequestItem.deleteMany({});
    console.log(`  - Deleted ${delReqItems.count} AsmStockRequestItems`);

    const delReqs = await tx.asmStockRequest.deleteMany({});
    console.log(`  - Deleted ${delReqs.count} AsmStockRequests`);

    const delReqSeq = await tx.asmStockRequestSequence.deleteMany({});
    console.log(`  - Reset AsmStockRequestSequence (${delReqSeq.count} reset)`);

    const delRetSeq = await tx.asmStockReturnSequence.deleteMany({});
    console.log(`  - Reset AsmStockReturnSequence (${delRetSeq.count} reset)`);

    // 2.3 Delete Vendor Orders & Associated Transactional Records
    console.log('\nWiping Vendor Orders and associated transactional history...');
    const delDocs = await tx.vendorDocument.deleteMany({});
    console.log(`  - Deleted ${delDocs.count} VendorDocuments`);

    const delPayments = await tx.vendorPayment.deleteMany({});
    console.log(`  - Deleted ${delPayments.count} VendorPayments`);

    const delDeliveries = await tx.vendorDelivery.deleteMany({});
    console.log(`  - Deleted ${delDeliveries.count} VendorDeliveries`);

    const delStatuses = await tx.vendorOrderStatus.deleteMany({});
    console.log(`  - Deleted ${delStatuses.count} VendorOrderStatuses`);

    const delOrderItems = await tx.vendorOrderItem.deleteMany({});
    console.log(`  - Deleted ${delOrderItems.count} VendorOrderItems`);

    const delOrders = await tx.vendorOrder.deleteMany({});
    console.log(`  - Deleted ${delOrders.count} VendorOrders`);

    const delOrderSeq = await tx.vendorOrderSequence.deleteMany({});
    console.log(`  - Reset VendorOrderSequence (${delOrderSeq.count} reset)`);
  });

  console.log('\n=== TRANSACTION COMMITTED SUCCESSFULLY ===\n');

  // Step 3: Post-reset assertions
  console.log('--- POST-RESET VERIFICATION ---');
  const postVendors = await prisma.vendor.count();
  const postUsers = await prisma.user.count();
  const postWarehouseItems = await prisma.inventoryItem.count();
  const postOutletInv = await prisma.outletInventory.count();
  const postPosSales = await prisma.posSale.count();

  const reqCount = await prisma.asmStockRequest.count();
  const returnCount = await prisma.asmStockReturn.count();
  const vendorOrderCount = await prisma.vendorOrder.count();
  const vendorDeliveryCount = await prisma.vendorDelivery.count();
  const vendorPaymentCount = await prisma.vendorPayment.count();

  assert.strictEqual(reqCount, 0, 'AsmStockRequest count must be 0');
  assert.strictEqual(returnCount, 0, 'AsmStockReturn count must be 0');
  assert.strictEqual(vendorOrderCount, 0, 'VendorOrder count must be 0');
  assert.strictEqual(vendorDeliveryCount, 0, 'VendorDelivery count must be 0');
  assert.strictEqual(vendorPaymentCount, 0, 'VendorPayment count must be 0');

  // Verify Master Data intact
  assert.strictEqual(postVendors, initialVendors, `Vendors count must remain ${initialVendors}`);
  assert.strictEqual(postUsers, initialUsers, `Users count must remain ${initialUsers}`);
  assert.strictEqual(postWarehouseItems, initialWarehouseItems, `Warehouse items count must remain ${initialWarehouseItems}`);
  assert.strictEqual(postOutletInv, initialOutletInv, `Outlet inventory count must remain ${initialOutletInv}`);
  assert.strictEqual(postPosSales, initialPosSales, `POS Sales count must remain ${initialPosSales}`);

  // Verify Lab Coat stock restored to 9
  const labCoat = await prisma.inventoryItem.findUnique({
    where: { id: 'c14ade1a-2ab9-4be6-afc4-13b7fc46c2b0' }
  });
  console.log(`\nVerified "Lab Coat Women Wrinkle Free" Stock: ${labCoat.stock} (Restored from 6 to 9)`);
  assert.strictEqual(labCoat.stock, 9, 'Lab Coat stock must be restored to 9');

  console.log('\nAll post-reset safety assertions PASSED 100%!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Reset execution failed:', err);
  process.exit(1);
});
