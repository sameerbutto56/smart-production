const prisma = require('../src/prisma');
const cache = require('../src/utils/cache');
const { recordInventoryMovement } = require('../src/utils/inventoryMovement');

async function reconcileSleeves() {
  console.log('--- Starting Sleeves Demand Reconciliation ---');

  const blackActive = await prisma.outletInventory.findUnique({
    where: { id: 'a6b45ddf-3ad3-42b3-9623-20daa6ab0cbf' }
  });
  const blackCanonical = await prisma.outletInventory.findUnique({
    where: { id: 'b08e2fc4-cae6-4b4b-a181-bab0af11e430' }
  });
  const navyActive = await prisma.outletInventory.findUnique({
    where: { id: '608f1099-8adc-480a-8a67-24e9e5c59102' }
  });
  const navyCanonical = await prisma.outletInventory.findUnique({
    where: { id: '3ecd22a7-8448-499e-af77-faf74d03af1e' }
  });

  console.log('Initial State:');
  console.log('Black Active (a6b45ddf):', blackActive ? { stock: blackActive.stock, barcode: blackActive.barcode, isActive: blackActive.isActive } : 'NOT FOUND');
  console.log('Black Canonical (b08e2fc4):', blackCanonical ? { stock: blackCanonical.stock, barcode: blackCanonical.barcode, isActive: blackCanonical.isActive } : 'NOT FOUND');
  console.log('Navy Active (608f1099):', navyActive ? { stock: navyActive.stock, barcode: navyActive.barcode, isActive: navyActive.isActive } : 'NOT FOUND');
  console.log('Navy Canonical (3ecd22a7):', navyCanonical ? { stock: navyCanonical.stock, barcode: navyCanonical.barcode, isActive: navyCanonical.isActive } : 'NOT FOUND');

  const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const adminId = adminUser?.id;

  await prisma.$transaction(async (tx) => {
    // 1. Reconcile Black Sleeves
    if (blackActive && blackCanonical) {
      console.log('Consolidating Black Sleeves into b08e2fc4 (barcode POS1KACSH5)...');
      // Remap PosSaleItem
      const salesRemapped = await tx.posSaleItem.updateMany({
        where: { outletVariantId: blackActive.id },
        data: { outletVariantId: blackCanonical.id }
      });
      console.log(`Remapped ${salesRemapped.count} sales from duplicate to canonical.`);

      // Remap InventoryMovementLog
      await tx.inventoryMovementLog.updateMany({
        where: { productId: blackActive.id },
        data: { productId: blackCanonical.id }
      });

      // Delete duplicate
      await tx.outletInventory.delete({
        where: { id: blackActive.id }
      });
      console.log('Deleted duplicate a6b45ddf.');

      // Reactivate canonical and ensure stock = 20
      await tx.outletInventory.update({
        where: { id: blackCanonical.id },
        data: {
          isActive: true,
          deletedAt: null,
          stock: 20,
          price: 750,
          barcode: 'POS1KACSH5'
        }
      });
      console.log('Reactivated canonical b08e2fc4 with stock = 20, barcode = POS1KACSH5.');

      await recordInventoryMovement({
        movementType: 'RECONCILIATION',
        location: 'Johar Town',
        productId: blackCanonical.id,
        productName: 'Sleeves',
        color: 'Black',
        size: 'Standard',
        barcode: 'POS1KACSH5',
        previousQty: 0,
        newQty: 20,
        difference: 20,
        referenceId: 'TRF-20261017-00003',
        notes: 'Reconciled missing sleeve stock from demand TRF-20261017-00003. Reactivated canonical record POS1KACSH5.',
        performedBy: 'System Reconciliation',
        tx
      });
    }

    // 2. Reconcile Navy Sleeves
    if (navyActive && navyCanonical) {
      console.log('Consolidating Navy Sleeves into 3ecd22a7 (barcode POS17085CA)...');
      // Remap PosSaleItem
      const salesRemapped = await tx.posSaleItem.updateMany({
        where: { outletVariantId: navyActive.id },
        data: { outletVariantId: navyCanonical.id }
      });
      console.log(`Remapped ${salesRemapped.count} sales from duplicate to canonical.`);

      // Remap InventoryMovementLog
      await tx.inventoryMovementLog.updateMany({
        where: { productId: navyActive.id },
        data: { productId: navyCanonical.id }
      });

      // Stock consolidation: canonical had 10 from demand, active had 1 existing -> 11 total
      const totalNavyStock = (navyCanonical.stock || 10) + (navyActive.stock || 0);

      // Delete duplicate
      await tx.outletInventory.delete({
        where: { id: navyActive.id }
      });
      console.log('Deleted duplicate 608f1099.');

      // Reactivate canonical with consolidated stock
      await tx.outletInventory.update({
        where: { id: navyCanonical.id },
        data: {
          isActive: true,
          deletedAt: null,
          stock: totalNavyStock,
          price: 750,
          barcode: 'POS17085CA'
        }
      });
      console.log(`Reactivated canonical 3ecd22a7 with stock = ${totalNavyStock}, barcode = POS17085CA.`);

      await recordInventoryMovement({
        movementType: 'RECONCILIATION',
        location: 'Johar Town',
        productId: navyCanonical.id,
        productName: 'Sleeves',
        color: 'Navy',
        size: 'Standard',
        barcode: 'POS17085CA',
        previousQty: 1,
        newQty: totalNavyStock,
        difference: 10,
        referenceId: 'TRF-20261017-00003',
        notes: 'Reconciled missing sleeve stock from demand TRF-20261017-00003. Consolidated POS17085C9 into canonical record POS17085CA.',
        performedBy: 'System Reconciliation',
        tx
      });
    }

    // 3. Record AuditLog entry if adminId exists
    if (adminId) {
      await tx.auditLog.create({
        data: {
          orderId: null,
          action: 'INVENTORY_RECONCILIATION',
          details: 'Reconciled missing sleeves inventory for Johar Town from demand TRF-20261017-00003 (Black Standard: 20 units restored, Navy Standard: 10 units restored to 11 total). Reactivated canonical records and eliminated duplicates.',
          performedBy: adminId
        }
      });
    }
  });

  // Clear all caches
  try {
    cache.delPattern('pos:');
    cache.delPattern('warehouse:');
    cache.delPattern('products:');
    cache.delPattern('product-data:');
  } catch (err) {
    console.warn('Cache clear warning:', err.message);
  }

  console.log('--- Sleeves Reconciliation Complete ---');
}

reconcileSleeves()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Reconciliation error:', err);
    prisma.$disconnect();
    process.exit(1);
  });
