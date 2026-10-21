const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/prisma');
const crypto = require('crypto');

function generateUniqueBarcode(existingSet) {
  let bc;
  let attempts = 0;
  do {
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
    bc = `POS${rand}`;
    attempts++;
    if (attempts > 1000) throw new Error('Failed to generate unique barcode after 1000 attempts');
  } while (existingSet.has(bc));
  existingSet.add(bc);
  return bc;
}

async function reconcile() {
  console.log('--- Starting Warehouse Master & Outlet Barcode Reconciliation ---');

  // Collect all known barcodes across the entire system
  const allMasterItems = await prisma.inventoryItem.findMany({
    select: { id: true, name: true, category: true, genderApplicable: true, variants: true, createdAt: true }
  });

  const allOutletRows = await prisma.outletInventory.findMany({
    select: { id: true, outletName: true, name: true, color: true, size: true, barcode: true, stock: true, isActive: true }
  });

  const globalBarcodes = new Set();
  for (const item of allMasterItems) {
    const vars = Array.isArray(item.variants) ? item.variants : [];
    for (const v of vars) {
      if (v.barcode) globalBarcodes.add(String(v.barcode).trim().toUpperCase());
    }
  }
  for (const row of allOutletRows) {
    if (row.barcode) globalBarcodes.add(String(row.barcode).trim().toUpperCase());
  }
  console.log(`Initial global unique barcodes registered: ${globalBarcodes.size}`);

  // 1. Audit duplicates in Master InventoryItems
  const barcodeToVariants = new Map();
  for (const item of allMasterItems) {
    const vars = Array.isArray(item.variants) ? item.variants : [];
    for (let idx = 0; idx < vars.length; idx++) {
      const v = vars[idx];
      if (!v.barcode) continue;
      const bc = String(v.barcode).trim().toUpperCase();
      if (!barcodeToVariants.has(bc)) barcodeToVariants.set(bc, []);
      barcodeToVariants.get(bc).push({
        item,
        variantIndex: idx,
        variant: v
      });
    }
  }

  let dupCount = 0;
  for (const [bc, list] of barcodeToVariants.entries()) {
    if (list.length > 1) {
      dupCount++;
      console.log(`\nDuplicate #${dupCount}: [${bc}] shared by ${list.length} master items:`);

      // Determine the primary owner:
      // Priority 1: Which master item already has active OutletInventory rows with stock or active POS presence for this barcode?
      // Priority 2: Which master item has warehouse stock for this variant?
      // Priority 3: Oldest createdAt timestamp.
      let primaryIdx = 0;
      let highestScore = -1;

      for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        let score = 0;
        const oRows = allOutletRows.filter(o => 
          o.barcode === bc && 
          o.name.trim().toLowerCase() === entry.item.name.trim().toLowerCase()
        );
        const hasOutletStock = oRows.some(o => o.stock > 0);
        if (hasOutletStock) score += 100;
        else if (oRows.length > 0) score += 50;

        if ((parseInt(entry.variant.stock, 10) || 0) > 0) score += 20;
        // tie-breaker: older creation date
        const ageScore = entry.item.createdAt ? (Date.now() - new Date(entry.item.createdAt).getTime()) / 1e10 : 0;
        score += ageScore;

        if (score > highestScore) {
          highestScore = score;
          primaryIdx = i;
        }
      }

      const primary = list[primaryIdx];
      console.log(`  -> Primary Owner chosen: [${primary.item.name}] Size: ${primary.variant.size} Color: ${primary.variant.color} (Score: ${highestScore.toFixed(2)})`);

      // Reassign fresh barcodes to the non-primary items
      for (let i = 0; i < list.length; i++) {
        if (i === primaryIdx) continue;
        const secondary = list[i];
        const newBc = generateUniqueBarcode(globalBarcodes);
        console.log(`  -> Reassigning duplicate from [${secondary.item.name}] (${secondary.variant.size} ${secondary.variant.color}) to new barcode: ${newBc}`);

        // Update in-memory item variants
        secondary.item.variants[secondary.variantIndex].barcode = newBc;

        // Check if secondary has any OutletInventory rows that currently hold the old duplicate or a suffixed barcode (e.g. _JR)
        const secondaryOutletRows = allOutletRows.filter(o =>
          o.name.trim().toLowerCase() === secondary.item.name.trim().toLowerCase() &&
          String(o.size || '').trim().toLowerCase() === String(secondary.variant.size || '').trim().toLowerCase() &&
          String(o.color || '').trim().toLowerCase() === String(secondary.variant.color || '').trim().toLowerCase()
        );

        for (const sor of secondaryOutletRows) {
          console.log(`     Updating OutletInventory [${sor.outletName}] row ${sor.id} from [${sor.barcode}] to [${newBc}]`);
          await prisma.outletInventory.update({
            where: { id: sor.id },
            data: { barcode: newBc }
          });
          sor.barcode = newBc;
        }
      }
    }
  }

  // 2. Persist updated variants in InventoryItem
  console.log('\nPersisting updated variants back to InventoryItem master records...');
  for (const item of allMasterItems) {
    if (Array.isArray(item.variants)) {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { variants: item.variants }
      });
    }
  }

  // 3. Fix any lingering suffixed barcodes (like _JR, _JT) in OutletInventory
  const lingeringSuffixed = await prisma.outletInventory.findMany({
    where: {
      OR: [
        { barcode: { contains: '_JR' } },
        { barcode: { contains: '_JT' } }
      ]
    }
  });

  console.log(`\nFixing ${lingeringSuffixed.length} lingering suffixed barcodes in OutletInventory...`);
  for (const row of lingeringSuffixed) {
    // Find matching master item variant to get canonical warehouse barcode
    const masterItem = allMasterItems.find(m => m.name.trim().toLowerCase() === row.name.trim().toLowerCase());
    let targetBarcode = null;
    if (masterItem && Array.isArray(masterItem.variants)) {
      const v = masterItem.variants.find(mv => 
        String(mv.size || '').trim().toLowerCase() === String(row.size || '').trim().toLowerCase() &&
        String(mv.color || '').trim().toLowerCase() === String(row.color || '').trim().toLowerCase()
      );
      if (v && v.barcode) targetBarcode = v.barcode;
    }
    if (!targetBarcode) {
      targetBarcode = generateUniqueBarcode(globalBarcodes);
    }

    // Ensure targetBarcode doesn't collide with another row in the same outlet
    const collision = await prisma.outletInventory.findFirst({
      where: { outletName: row.outletName, barcode: targetBarcode, id: { not: row.id } }
    });

    if (collision) {
      console.warn(`Collision on target barcode ${targetBarcode} at ${row.outletName} with row ${collision.name} (${collision.id}). Generating fresh unique.`);
      targetBarcode = generateUniqueBarcode(globalBarcodes);
    }

    console.log(`  Fixing [${row.outletName}] ${row.name} (${row.color} ${row.size}): ${row.barcode} -> ${targetBarcode}`);
    await prisma.outletInventory.update({
      where: { id: row.id },
      data: { barcode: targetBarcode }
    });
  }

  // 4. Verify that Sprinter Women New in Johar Town has all size variants with warehouse barcodes
  console.log('\nVerifying Sprinter Women New variants in Johar Town and Jail Road...');
  const sprinterWomenMaster = allMasterItems.find(m => m.name.trim() === 'Sprinter Women New');
  if (sprinterWomenMaster && Array.isArray(sprinterWomenMaster.variants)) {
    for (const outlet of ['Johar Town', 'Jail Road']) {
      for (const mv of sprinterWomenMaster.variants) {
        if (!mv.size || !mv.barcode) continue;
        const existingRow = await prisma.outletInventory.findFirst({
          where: {
            outletName: outlet,
            name: sprinterWomenMaster.name,
            size: mv.size,
            color: mv.color || null
          }
        });
        if (!existingRow) {
          console.log(`Creating missing variant for [${outlet}] ${sprinterWomenMaster.name} ${mv.size} ${mv.color} with barcode ${mv.barcode}`);
          await prisma.outletInventory.create({
            data: {
              outletName: outlet,
              name: sprinterWomenMaster.name,
              category: sprinterWomenMaster.category,
              genderApplicable: sprinterWomenMaster.genderApplicable,
              color: mv.color || null,
              size: mv.size,
              barcode: mv.barcode,
              price: mv.price || sprinterWomenMaster.price || 0,
              stock: 0,
              isActive: true
            }
          });
        } else if (existingRow.barcode !== mv.barcode) {
          console.log(`Updating variant barcode for [${outlet}] ${sprinterWomenMaster.name} ${mv.size}: ${existingRow.barcode} -> ${mv.barcode}`);
          await prisma.outletInventory.update({
            where: { id: existingRow.id },
            data: { barcode: mv.barcode }
          });
        }
      }
    }
  }

  console.log('\n--- Reconciliation Complete! ---');
  process.exit(0);
}

reconcile().catch(err => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});
