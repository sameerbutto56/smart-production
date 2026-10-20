/**
 * reconcile-demand-pos-inventory.cjs
 *
 * Reconciles historical Demand-to-POS cross-contamination and missing variants
 * across Johar Town and Jail Road as mandated by Section 9 of the specification.
 *
 * Safety & Invariants:
 * 1. Idempotent: checks current state before applying each adjustment.
 * 2. Does NOT double-count inventory movements.
 * 3. Records clear ADJUSTMENT / TRANSFER_IN movement logs referencing the original demand.
 * 4. Preserves warehouse barcodes and restores correct Men's / Women's category & gender isolation.
 */

const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('===============================================================');
  console.log('STARTING HISTORICAL DEMAND-TO-POS INVENTORY RECONCILIATION');
  console.log('===============================================================\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // REPAIR 1: Johar Town - Sprinter Women New vs Sprinter Navy Collar-Men
  // TRF-20261020-00001 dispatched Sprinter Navy Collar-Men (S: 1, M: 6, L: 6)
  // which falsely incremented Sprinter Women New. Men's rows were later manually added.
  // We reclaim the overcounted 1 S, 6 M, 6 L from Sprinter Women New in Johar Town.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- [1/5] Reconciling Johar Town Sprinter Women New ---');
  const swnRows = await prisma.outletInventory.findMany({
    where: { outletName: 'Johar Town', name: 'Sprinter Women New' }
  });

  for (const row of swnRows) {
    let excess = 0;
    if (row.size === 'S' && row.stock >= 3) excess = 1;
    else if (row.size === 'M' && row.stock >= 10) excess = 6;
    else if (row.size === 'L' && row.stock >= 10) excess = 6;

    if (excess > 0) {
      const prev = row.stock;
      const next = prev - excess;
      await prisma.outletInventory.update({
        where: { id: row.id },
        data: { stock: next }
      });
      await prisma.inventoryMovementLog.create({
        data: {
          movementType: 'ADJUSTMENT',
          location: 'Johar Town',
          productId: row.id,
          productName: row.name,
          color: row.color,
          size: row.size,
          barcode: row.barcode,
          previousQty: prev,
          newQty: next,
          difference: -excess,
          referenceId: 'TRF-20261020-00001',
          notes: `Reconciliation: Reclaimed ${excess} units falsely allocated from Men's article (Sprinter Navy Collar-Men) via TRF-20261020-00001`,
          performedBy: 'System Reconciliation'
        }
      });
      console.log(`  ✓ Sprinter Women New size ${row.size}: stock corrected ${prev} -> ${next} (-${excess})`);
    } else {
      console.log(`  - Sprinter Women New size ${row.size}: current stock ${row.stock} (already reconciled)`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPAIR 2: Jail Road - Sprinter Navy Collar-Men vs Sprinter Women New
  // TRF-20261017-00004 dispatched Sprinter Women New (XS: 1, S: 3, M: 6, L: 6, XL: 2, XXL: 1)
  // which falsely incremented Sprinter Navy Collar-Men. Sprinter Women New was never created!
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [2/5] Reconciling Jail Road Sprinter Navy Collar-Men & Restoring Sprinter Women New ---');
  const jailMenRows = await prisma.outletInventory.findMany({
    where: { outletName: 'Jail Road', name: 'Sprinter Navy Collar-Men' }
  });

  // Authoritative warehouse barcodes for Sprinter Navy Collar-Men
  const menWarehouseBarcodes = {
    XS: 'POSRLTSZU',
    S: 'POS1IXMCVB',
    M: 'POS25XRTV3',
    L: 'POS20GKF68',
    XL: 'POS1M3DCAG',
    XXL: 'POSDWDV7D'
  };

  const menExcessMap = {
    XS: 1,
    S: 3,
    M: 6,
    L: 6,
    XL: 2,
    XXL: 1
  };

  for (const row of jailMenRows) {
    const excess = menExcessMap[row.size] || 0;
    const authoritativeBc = menWarehouseBarcodes[row.size] || row.barcode;
    const shouldReclaim = excess > 0 && (
      (row.size === 'XS' && row.stock >= 3) ||
      (row.size === 'S' && row.stock >= 6) ||
      (row.size === 'M' && row.stock >= 11) ||
      (row.size === 'L' && row.stock >= 11) ||
      (row.size === 'XL' && row.stock >= 5) ||
      (row.size === 'XXL' && row.stock >= 2)
    );

    const prev = row.stock;
    const next = shouldReclaim ? prev - excess : prev;

    // First, check if authoritativeBc is held by another row to avoid collision
    const existingHolder = await prisma.outletInventory.findFirst({
      where: { outletName: 'Jail Road', barcode: authoritativeBc, id: { not: row.id } }
    });
    if (existingHolder) {
      await prisma.outletInventory.update({
        where: { id: existingHolder.id },
        data: { barcode: `${authoritativeBc}_archived_${Date.now()}` }
      });
    }

    await prisma.outletInventory.update({
      where: { id: row.id },
      data: {
        stock: next,
        barcode: authoritativeBc
      }
    });

    if (shouldReclaim) {
      await prisma.inventoryMovementLog.create({
        data: {
          movementType: 'ADJUSTMENT',
          location: 'Jail Road',
          productId: row.id,
          productName: row.name,
          color: row.color,
          size: row.size,
          barcode: authoritativeBc,
          previousQty: prev,
          newQty: next,
          difference: -excess,
          referenceId: 'TRF-20261017-00004',
          notes: `Reconciliation: Reclaimed ${excess} units falsely allocated from Women's article (Sprinter Women New) via TRF-20261017-00004`,
          performedBy: 'System Reconciliation'
        }
      });
      console.log(`  ✓ Sprinter Navy Collar-Men size ${row.size}: stock corrected ${prev} -> ${next} (-${excess}), barcode -> ${authoritativeBc}`);
    } else {
      console.log(`  - Sprinter Navy Collar-Men size ${row.size}: stock ${row.stock}, barcode -> ${authoritativeBc}`);
    }
  }

  // Create or update Sprinter Women New in Jail Road with its authoritative stock and barcodes
  const womenVariantsJail = [
    { size: 'XS', stock: 1, barcode: 'POSRLTSZU' },
    { size: 'S', stock: 3, barcode: 'POS7KV2F2' },
    { size: 'M', stock: 6, barcode: 'POSUL0JEW' },
    { size: 'L', stock: 6, barcode: 'POSP3T4Q1' },
    { size: 'XL', stock: 2, barcode: 'POSAQM1U7' },
    { size: 'XXL', stock: 1, barcode: 'POSDWDV7D' },
    { size: 'C', stock: 50, barcode: 'POSN1WWKX' }
  ];

  const warehouseWomenMaster = await prisma.inventoryItem.findFirst({
    where: { name: 'Sprinter Women New' }
  });

  for (const wv of womenVariantsJail) {
    const existing = await prisma.outletInventory.findFirst({
      where: { outletName: 'Jail Road', name: 'Sprinter Women New', size: wv.size }
    });

    if (!existing) {
      // Free barcode if held by archived record
      const bcHolder = await prisma.outletInventory.findFirst({
        where: { outletName: 'Jail Road', barcode: wv.barcode }
      });
      let targetBc = wv.barcode;
      if (bcHolder) {
        if (bcHolder.isActive === false || bcHolder.deletedAt !== null) {
          await prisma.outletInventory.update({
            where: { id: bcHolder.id },
            data: { barcode: `${wv.barcode}_archived_${Date.now()}` }
          });
        } else {
          // If active holder belongs to different article, append suffix
          targetBc = `${wv.barcode}_JR`;
        }
      }

      const created = await prisma.outletInventory.create({
        data: {
          outletName: 'Jail Road',
          name: 'Sprinter Women New',
          category: 'SCRUBS',
          genderApplicable: true,
          color: 'Navy',
          size: wv.size,
          fabric: warehouseWomenMaster?.fabric || null,
          barcode: targetBc,
          stock: wv.stock,
          price: 5150,
          metadata: JSON.stringify({
            sourceStoreItemId: warehouseWomenMaster?.id || null,
            reconciledFromDemand: 'TRF-20261017-00004'
          }),
          isActive: true,
          deletedAt: null
        }
      });

      await prisma.inventoryMovementLog.create({
        data: {
          movementType: 'TRANSFER_IN',
          location: 'Jail Road',
          productId: created.id,
          productName: created.name,
          color: created.color,
          size: created.size,
          barcode: targetBc,
          previousQty: 0,
          newQty: wv.stock,
          difference: wv.stock,
          referenceId: 'TRF-20261017-00004',
          notes: `Reconciliation: Restored ${wv.stock} units of Sprinter Women New delivered via TRF-20261017-00004`,
          performedBy: 'System Reconciliation'
        }
      });
      console.log(`  ✓ Created Sprinter Women New size ${wv.size} in Jail Road: stock ${wv.stock}, barcode ${targetBc}`);
    } else {
      console.log(`  - Sprinter Women New size ${wv.size} already exists in Jail Road (stock ${existing.stock})`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPAIR 3: Johar Town - Summit Executive Women (TRF-20261020-00003)
  // Ensure all missing size variants (XS, S, M, XL, XXL) exist with stock 0 and warehouse barcodes
  // Clean up dummy null/null variant
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [3/5] Reconciling Johar Town Summit Executive Women ---');
  const summitWarehouse = await prisma.inventoryItem.findFirst({
    where: { name: 'Summit Executive Women' }
  });

  if (summitWarehouse && Array.isArray(summitWarehouse.variants)) {
    for (const v of summitWarehouse.variants) {
      const existing = await prisma.outletInventory.findFirst({
        where: { outletName: 'Johar Town', name: 'Summit Executive Women', size: v.size }
      });

      if (!existing) {
        // Free barcode if held by archived record
        let targetBc = v.barcode;
        const bcHolder = await prisma.outletInventory.findFirst({
          where: { outletName: 'Johar Town', barcode: targetBc }
        });
        if (bcHolder) {
          if (bcHolder.isActive === false || bcHolder.deletedAt !== null) {
            await prisma.outletInventory.update({
              where: { id: bcHolder.id },
              data: { barcode: `${targetBc}_archived_${Date.now()}` }
            });
          } else {
            targetBc = `${targetBc}_JT`;
          }
        }

        await prisma.outletInventory.create({
          data: {
            outletName: 'Johar Town',
            name: 'Summit Executive Women',
            category: 'SCRUBS',
            genderApplicable: true,
            color: v.color || 'Zinc',
            size: v.size,
            fabric: summitWarehouse.fabric || null,
            barcode: targetBc,
            stock: 0,
            price: v.price || 5650,
            metadata: JSON.stringify({
              sourceStoreItemId: summitWarehouse.id,
              autoCreated: true
            }),
            isActive: true,
            deletedAt: null
          }
        });
        console.log(`  ✓ Created missing variant for Summit Executive Women: size ${v.size}, stock 0, barcode ${targetBc}`);
      } else {
        console.log(`  - Summit Executive Women size ${v.size} exists: stock ${existing.stock}, barcode ${existing.barcode}`);
      }
    }
  }

  // Clean up null/null dummy variant
  const dummySummit = await prisma.outletInventory.findFirst({
    where: { outletName: 'Johar Town', name: 'Summit Executive Women', size: null, color: null }
  });
  if (dummySummit) {
    await prisma.outletInventory.update({
      where: { id: dummySummit.id },
      data: { isActive: false, deletedAt: new Date() }
    });
    console.log(`  ✓ Soft-deleted dummy null/null variant (${dummySummit.id}) for Summit Executive Women`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPAIR 4: Johar Town - Sprinter Women Influential Pink Nova
  // Ensure all canonical variants exist with color 'Pink Nova' and warehouse barcodes
  // Soft-delete duplicate 'Influential Pink Nova' rows that have 0 stock
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [4/5] Reconciling Johar Town Sprinter Women Influential Pink Nova ---');
  const pinkNovaWarehouse = await prisma.inventoryItem.findFirst({
    where: { name: 'Sprinter Women Influential Pink Nova' }
  });

  if (pinkNovaWarehouse && Array.isArray(pinkNovaWarehouse.variants)) {
    for (const v of pinkNovaWarehouse.variants) {
      const existing = await prisma.outletInventory.findFirst({
        where: {
          outletName: 'Johar Town',
          name: 'Sprinter Women Influential Pink Nova',
          color: 'Pink Nova',
          size: v.size
        }
      });

      if (!existing) {
        let targetBc = v.barcode;
        const bcHolder = await prisma.outletInventory.findFirst({
          where: { outletName: 'Johar Town', barcode: targetBc }
        });
        if (bcHolder) {
          if (bcHolder.isActive === false || bcHolder.deletedAt !== null) {
            await prisma.outletInventory.update({
              where: { id: bcHolder.id },
              data: { barcode: `${targetBc}_archived_${Date.now()}` }
            });
          } else {
            targetBc = `${targetBc}_JT`;
          }
        }

        const stockVal = v.size === 'C' ? 50 : 0;
        await prisma.outletInventory.create({
          data: {
            outletName: 'Johar Town',
            name: 'Sprinter Women Influential Pink Nova',
            category: 'SCRUBS',
            genderApplicable: true,
            color: 'Pink Nova',
            size: v.size,
            fabric: pinkNovaWarehouse.fabric || null,
            barcode: targetBc,
            stock: stockVal,
            price: v.price || 5750,
            metadata: JSON.stringify({
              sourceStoreItemId: pinkNovaWarehouse.id,
              autoCreated: true
            }),
            isActive: true,
            deletedAt: null
          }
        });
        console.log(`  ✓ Created canonical variant for Sprinter Women Influential Pink Nova: size ${v.size}, color 'Pink Nova', stock ${stockVal}, barcode ${targetBc}`);
      } else {
        console.log(`  - Canonical variant size ${v.size} exists (stock ${existing.stock})`);
      }
    }
  }

  // Soft-delete duplicate 'Influential Pink Nova' rows
  const dupPinkRows = await prisma.outletInventory.findMany({
    where: {
      outletName: 'Johar Town',
      name: 'Sprinter Women Influential Pink Nova',
      OR: [
        { color: 'Influential Pink Nova' },
        { size: null, color: null }
      ],
      isActive: true
    }
  });

  for (const dup of dupPinkRows) {
    await prisma.outletInventory.update({
      where: { id: dup.id },
      data: { isActive: false, deletedAt: new Date(), barcode: `${dup.barcode}_archived_${Date.now()}` }
    });
    console.log(`  ✓ Soft-deleted duplicate variant ${dup.id} (${dup.color} ${dup.size || 'null'})`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPAIR 5: Jail Road - Sprinter Sea Green-Men vs Sprinter SeaGreen-Women
  // TRF-20261009-00003 dispatched Sprinter Sea Green-Men (XS: 1, S: 4, M: 5, L: 5, XL: 3, XXL: 2)
  // which falsely incremented Sprinter SeaGreen-Women. Sprinter Sea Green-Men was never created!
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [5/5] Reconciling Jail Road Sprinter Sea Green-Men & Sprinter SeaGreen-Women ---');
  const jailSeaWomenRows = await prisma.outletInventory.findMany({
    where: { outletName: 'Jail Road', name: 'Sprinter SeaGreen-Women' }
  });

  const seaMenExcessMap = {
    XS: 1,
    S: 4,
    M: 5,
    L: 5,
    XL: 3,
    XXL: 2
  };

  for (const row of jailSeaWomenRows) {
    const excess = seaMenExcessMap[row.size] || 0;
    const shouldReclaim = excess > 0 && (
      (row.size === 'XS' && row.stock >= 2) ||
      (row.size === 'S' && row.stock >= 7) ||
      (row.size === 'M' && row.stock >= 10) ||
      (row.size === 'L' && row.stock >= 9) ||
      (row.size === 'XL' && row.stock >= 5) ||
      (row.size === 'XXL' && row.stock >= 3)
    );

    if (shouldReclaim) {
      const prev = row.stock;
      const next = prev - excess;
      await prisma.outletInventory.update({
        where: { id: row.id },
        data: { stock: next }
      });
      await prisma.inventoryMovementLog.create({
        data: {
          movementType: 'ADJUSTMENT',
          location: 'Jail Road',
          productId: row.id,
          productName: row.name,
          color: row.color,
          size: row.size,
          barcode: row.barcode,
          previousQty: prev,
          newQty: next,
          difference: -excess,
          referenceId: 'TRF-20261009-00003',
          notes: `Reconciliation: Reclaimed ${excess} units falsely allocated from Men's article (Sprinter Sea Green-Men) via TRF-20261009-00003`,
          performedBy: 'System Reconciliation'
        }
      });
      console.log(`  ✓ Sprinter SeaGreen-Women size ${row.size}: stock corrected ${prev} -> ${next} (-${excess})`);
    } else {
      console.log(`  - Sprinter SeaGreen-Women size ${row.size}: current stock ${row.stock} (already reconciled)`);
    }
  }

  // Create or update Sprinter Sea Green-Men in Jail Road with its authoritative warehouse variants & stock
  const seaMenWarehouse = await prisma.inventoryItem.findFirst({
    where: { name: 'Sprinter Sea Green-Men' }
  });

  if (seaMenWarehouse && Array.isArray(seaMenWarehouse.variants)) {
    for (const v of seaMenWarehouse.variants) {
      const receivedQty = seaMenExcessMap[v.size] || (v.size === 'C' ? 50 : 0);
      const existing = await prisma.outletInventory.findFirst({
        where: { outletName: 'Jail Road', name: 'Sprinter Sea Green-Men', size: v.size }
      });

      if (!existing) {
        let targetBc = v.barcode;
        const bcHolder = await prisma.outletInventory.findFirst({
          where: { outletName: 'Jail Road', barcode: targetBc }
        });
        if (bcHolder) {
          if (bcHolder.isActive === false || bcHolder.deletedAt !== null) {
            await prisma.outletInventory.update({
              where: { id: bcHolder.id },
              data: { barcode: `${targetBc}_archived_${Date.now()}` }
            });
          } else {
            targetBc = `${targetBc}_JR`;
          }
        }

        const created = await prisma.outletInventory.create({
          data: {
            outletName: 'Jail Road',
            name: 'Sprinter Sea Green-Men',
            category: 'SCRUBS',
            genderApplicable: true,
            color: v.color || 'Sea Green',
            size: v.size,
            fabric: seaMenWarehouse.fabric || null,
            barcode: targetBc,
            stock: receivedQty,
            price: v.price || 5150,
            metadata: JSON.stringify({
              sourceStoreItemId: seaMenWarehouse.id,
              reconciledFromDemand: 'TRF-20261009-00003'
            }),
            isActive: true,
            deletedAt: null
          }
        });

        if (receivedQty > 0) {
          await prisma.inventoryMovementLog.create({
            data: {
              movementType: 'TRANSFER_IN',
              location: 'Jail Road',
              productId: created.id,
              productName: created.name,
              color: created.color,
              size: created.size,
              barcode: targetBc,
              previousQty: 0,
              newQty: receivedQty,
              difference: receivedQty,
              referenceId: 'TRF-20261009-00003',
              notes: `Reconciliation: Restored ${receivedQty} units of Sprinter Sea Green-Men delivered via TRF-20261009-00003`,
              performedBy: 'System Reconciliation'
            }
          });
        }
        console.log(`  ✓ Created Sprinter Sea Green-Men size ${v.size} in Jail Road: stock ${receivedQty}, barcode ${targetBc}`);
      } else if (existing.stock === 0 && receivedQty > 0) {
        await prisma.outletInventory.update({
          where: { id: existing.id },
          data: { stock: receivedQty }
        });
        console.log(`  ✓ Updated Sprinter Sea Green-Men size ${v.size} in Jail Road: stock 0 -> ${receivedQty}`);
      } else {
        console.log(`  - Sprinter Sea Green-Men size ${v.size} exists in Jail Road (stock ${existing.stock})`);
      }
    }
  }

  console.log('\n===============================================================');
  console.log('RECONCILIATION COMPLETED SUCCESSFULLY');
  console.log('===============================================================');
}

main()
  .catch(err => {
    console.error('Reconciliation error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
