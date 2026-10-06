/**
 * Consolidate Product Master & Outlet POS Inventory (High-Speed Batch Edition)
 * 
 * 1. Establishes single central Product Master across Warehouse and Outlets.
 * 2. Unifies Barcode, SKU, Name, Price, Category, and Color/Size across Warehouse and all Outlets.
 * 3. Consolidates duplicate records in OutletInventory location-by-location without losing any stock.
 * 4. Remaps historical transactions (PosSaleItem, PosReturn, OutletTransferItem) to canonical records.
 * 5. Strictly isolates location stock: Warehouse stock != Johar Town stock != Jail Road stock.
 */

const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

const cleanStr = (s) => {
  if (!s || typeof s !== 'string') return '';
  return s.trim().replace(/\s+/g, ' ');
};

const normKey = (name, color, size) => [
  cleanStr(name).toLowerCase(),
  cleanStr(color).toLowerCase(),
  cleanStr(size).toLowerCase()
].join('|||');

const djb2 = (s) => {
  if (!s) return 0;
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const generateBarcode = (name, size, color) => {
  const prefix = 'POS';
  const raw = djb2(cleanStr(name)).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  const variantStr = `${cleanStr(size)}|${cleanStr(color)}`;
  const vHash = djb2(variantStr).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  return `${prefix}${raw}${vHash}`;
};

const makeSku = (name, color, size) => {
  const slug = (str) => cleanStr(str).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'DEF';
  return `ENM-${slug(name)}-${slug(color)}-${slug(size)}`;
};

async function main() {
  console.log('🚀 Starting Fast Product Master & Outlet POS Inventory Synchronization...\n');

  // Step 1: Fetch all warehouse items and outlet items
  const whItems = await prisma.inventoryItem.findMany();
  const outletItems = await prisma.outletInventory.findMany();
  console.log(`📦 Loaded ${whItems.length} Warehouse items and ${outletItems.length} Outlet items.`);

  // Step 2: Build Canonical Master Variant Map
  const masterMap = new Map();

  for (const wh of whItems) {
    const cName = cleanStr(wh.name);
    const cCat = cleanStr(wh.category) || 'SCRUBS';
    const cPrice = parseFloat(wh.price) || 0;
    const cImg = wh.imageUrl || null;

    let vars = wh.variants;
    if (typeof vars === 'string') {
      try { vars = JSON.parse(vars); } catch(e) { vars = null; }
    }

    if (Array.isArray(vars) && vars.length > 0) {
      for (const v of vars) {
        const cColor = cleanStr(v.color);
        const cSize = cleanStr(v.size);
        const vk = normKey(cName, cColor, cSize);
        if (!masterMap.has(vk)) {
          masterMap.set(vk, {
            name: cName,
            category: cCat,
            color: cColor || null,
            size: cSize || null,
            price: parseFloat(v.price) || cPrice,
            imageUrl: v.imageUrl || cImg,
            barcode: v.barcode || null,
            whItemId: wh.id,
            fabric: wh.fabric || null
          });
        }
      }
    } else {
      const cColor = cleanStr(wh.color);
      const cSize = cleanStr(wh.size);
      const vk = normKey(cName, cColor, cSize);
      if (!masterMap.has(vk)) {
        masterMap.set(vk, {
          name: cName,
          category: cCat,
          color: cColor || null,
          size: cSize || null,
          price: cPrice,
          imageUrl: cImg,
          barcode: null,
          whItemId: wh.id,
          fabric: wh.fabric || null
        });
      }
    }
  }

  // Seed / enrich with outlet items
  const sortedOutletItems = [...outletItems].sort((a, b) => {
    if (a.outletName === 'Johar Town') return -1;
    if (b.outletName === 'Johar Town') return 1;
    return 0;
  });

  for (const oi of sortedOutletItems) {
    const cName = cleanStr(oi.name);
    const cColor = cleanStr(oi.color);
    const cSize = cleanStr(oi.size);
    const cCat = cleanStr(oi.category) || 'SCRUBS';
    const cPrice = parseFloat(oi.price) || 0;
    const cImg = oi.imageUrl || null;
    const vk = normKey(cName, cColor, cSize);

    if (!masterMap.has(vk)) {
      masterMap.set(vk, {
        name: cName,
        category: cCat,
        color: cColor || null,
        size: cSize || null,
        price: cPrice,
        imageUrl: cImg,
        barcode: oi.barcode || null,
        whItemId: null,
        fabric: oi.fabric || null
      });
    } else {
      const entry = masterMap.get(vk);
      if (!entry.barcode && oi.barcode) {
        entry.barcode = oi.barcode;
      }
      if (!entry.price && cPrice > 0) {
        entry.price = cPrice;
      }
      if (!entry.imageUrl && cImg) {
        entry.imageUrl = cImg;
      }
    }
  }

  // Ensure unique canonical barcodes
  const usedBarcodes = new Set();
  for (const [vk, entry] of masterMap.entries()) {
    if (entry.barcode && !usedBarcodes.has(entry.barcode.toUpperCase())) {
      entry.barcode = entry.barcode.toUpperCase();
      usedBarcodes.add(entry.barcode);
    } else {
      let candidate = generateBarcode(entry.name, entry.size, entry.color);
      let attempt = 0;
      while (usedBarcodes.has(candidate.toUpperCase())) {
        attempt++;
        candidate = `${generateBarcode(entry.name, entry.size, entry.color)}${attempt}`;
      }
      entry.barcode = candidate.toUpperCase();
      usedBarcodes.add(entry.barcode);
    }
    entry.sku = makeSku(entry.name, entry.color, entry.size);
  }
  console.log(`✅ ${masterMap.size} unique variants mapped with canonical barcodes.`);

  // Step 3: Synchronize Warehouse Master Items
  console.log('\n🏢 Verifying Warehouse Master Items...');
  const whByName = new Map();
  for (const wh of whItems) {
    whByName.set(cleanStr(wh.name).toLowerCase(), wh);
  }

  const variantsByProduct = new Map();
  for (const [vk, entry] of masterMap.entries()) {
    const pKey = cleanStr(entry.name).toLowerCase();
    if (!variantsByProduct.has(pKey)) variantsByProduct.set(pKey, []);
    variantsByProduct.get(pKey).push(entry);
  }

  for (const [pKey, varList] of variantsByProduct.entries()) {
    const sample = varList[0];
    let wh = whByName.get(pKey);

    const formattedVariants = varList.map(v => {
      let existingWhStock = 0;
      if (wh && wh.variants) {
        const parsed = typeof wh.variants === 'string' ? JSON.parse(wh.variants) : wh.variants;
        if (Array.isArray(parsed)) {
          const match = parsed.find(pv => cleanStr(pv.color).toLowerCase() === cleanStr(v.color).toLowerCase() && cleanStr(pv.size).toLowerCase() === cleanStr(v.size).toLowerCase());
          if (match) existingWhStock = parseInt(match.stock) || 0;
        }
      }
      return {
        sku: v.sku,
        color: v.color || '',
        size: v.size || '',
        price: v.price || 0,
        stock: existingWhStock,
        barcode: v.barcode,
        imageUrl: v.imageUrl || null
      };
    });

    const totalWhStock = formattedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
    const topPrice = formattedVariants.find(v => v.price > 0)?.price || sample.price || 0;

    if (!wh) {
      wh = await prisma.inventoryItem.create({
        data: {
          name: sample.name,
          category: sample.category || 'SCRUBS',
          fabric: sample.fabric || null,
          price: topPrice,
          stock: totalWhStock,
          imageUrl: sample.imageUrl || null,
          variants: formattedVariants
        }
      });
      whByName.set(pKey, wh);
    } else {
      await prisma.inventoryItem.update({
        where: { id: wh.id },
        data: {
          name: sample.name,
          category: sample.category || wh.category,
          price: topPrice || wh.price || 0,
          stock: totalWhStock,
          variants: formattedVariants
        }
      });
    }
  }
  console.log(`✅ Warehouse Master items synchronized.`);

  // Step 4: Consolidate OutletInventory Duplicates location-by-location
  console.log('\n🏪 Consolidating OutletInventory duplicates location-by-location...');

  // Refetch fresh outlet items
  const freshOutletItems = await prisma.outletInventory.findMany();
  const outletGroups = new Map();
  for (const item of freshOutletItems) {
    const k = [item.outletName, normKey(item.name, item.color, item.size)].join(':::');
    if (!outletGroups.has(k)) outletGroups.set(k, []);
    outletGroups.get(k).push(item);
  }

  // Filter groups into duplicate groups vs single groups
  const duplicateGroups = [];
  const singleRecordsToUpdate = [];

  for (const [groupKey, records] of outletGroups.entries()) {
    const [outletName, vk] = groupKey.split(':::');
    const masterInfo = masterMap.get(vk);
    const targetBarcode = masterInfo ? masterInfo.barcode : records[0].barcode;
    const targetPrice = masterInfo?.price || records[0].price || 0;
    const targetName = masterInfo?.name || cleanStr(records[0].name);
    const targetColor = masterInfo?.color || (records[0].color ? cleanStr(records[0].color) : null);
    const targetSize = masterInfo?.size || (records[0].size ? cleanStr(records[0].size) : null);
    const targetCat = masterInfo?.category || cleanStr(records[0].category) || 'SCRUBS';
    const targetImg = masterInfo?.imageUrl || records[0].imageUrl || null;

    if (records.length > 1) {
      duplicateGroups.push({ groupKey, records, targetBarcode, targetPrice, targetName, targetColor, targetSize, targetCat, targetImg });
    } else {
      const single = records[0];
      const needsUpdate = (
        single.name !== targetName ||
        single.category !== targetCat ||
        single.color !== targetColor ||
        single.size !== targetSize ||
        (targetPrice > 0 && single.price !== targetPrice) ||
        (targetBarcode && single.barcode !== targetBarcode) ||
        (targetImg && single.imageUrl !== targetImg)
      );
      if (needsUpdate) {
        singleRecordsToUpdate.push({ id: single.id, targetName, targetCat, targetColor, targetSize, targetPrice, targetBarcode, targetImg });
      }
    }
  }

  console.log(`⚡ Found ${duplicateGroups.length} duplicate groups to consolidate and ${singleRecordsToUpdate.length} single records needing field alignment.`);

  // Process duplicate groups
  let totalDupsRemoved = 0;
  let totalStockConsolidated = 0;

  for (const group of duplicateGroups) {
    const { records, targetBarcode, targetPrice, targetName, targetColor, targetSize, targetCat, targetImg } = group;

    const withTx = await Promise.all(records.map(async (r) => {
      const [sales, returns, transfers1, transfers2] = await Promise.all([
        prisma.posSaleItem.count({ where: { outletVariantId: r.id } }),
        prisma.posReturn.count({ where: { outletVariantId: r.id } }),
        prisma.outletTransferItem.count({ where: { outletVariantId: r.id } }),
        prisma.outletTransferItem.count({ where: { outletInventoryId: r.id } })
      ]);
      const txCount = sales + returns + transfers1 + transfers2;
      const isBarcodeMatch = (r.barcode && r.barcode.toUpperCase() === targetBarcode.toUpperCase()) ? 1 : 0;
      return { record: r, txCount, isBarcodeMatch };
    }));

    withTx.sort((a, b) => {
      if (b.isBarcodeMatch !== a.isBarcodeMatch) return b.isBarcodeMatch - a.isBarcodeMatch;
      if (b.txCount !== a.txCount) return b.txCount - a.txCount;
      return new Date(a.record.createdAt) - new Date(b.record.createdAt);
    });

    const canonical = withTx[0].record;
    const dups = withTx.slice(1).map(w => w.record);
    let addedStock = 0;

    for (const dup of dups) {
      addedStock += (dup.stock || 0);

      await prisma.posSaleItem.updateMany({
        where: { outletVariantId: dup.id },
        data: { outletVariantId: canonical.id }
      });
      await prisma.posReturn.updateMany({
        where: { outletVariantId: dup.id },
        data: { outletVariantId: canonical.id }
      });
      await prisma.outletTransferItem.updateMany({
        where: { outletVariantId: dup.id },
        data: { outletVariantId: canonical.id }
      });
      await prisma.outletTransferItem.updateMany({
        where: { outletInventoryId: dup.id },
        data: { outletInventoryId: canonical.id }
      });

      await prisma.outletInventory.delete({ where: { id: dup.id } });
      totalDupsRemoved++;
    }

    totalStockConsolidated += addedStock;

    await prisma.outletInventory.update({
      where: { id: canonical.id },
      data: {
        stock: (canonical.stock || 0) + addedStock,
        barcode: targetBarcode,
        name: targetName,
        category: targetCat,
        color: targetColor,
        size: targetSize,
        price: targetPrice,
        imageUrl: targetImg
      }
    });
  }

  console.log(`✅ Duplicates merged: ${totalDupsRemoved} removed, ${totalStockConsolidated} stock consolidated into canonicals.`);

  // Process single records in batches of 40
  console.log(`\n🚀 Updating ${singleRecordsToUpdate.length} single records in batches of 40...`);
  const BATCH_SIZE = 40;
  for (let i = 0; i < singleRecordsToUpdate.length; i += BATCH_SIZE) {
    const chunk = singleRecordsToUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(c => 
      prisma.outletInventory.update({
        where: { id: c.id },
        data: {
          name: c.targetName,
          category: c.targetCat,
          color: c.targetColor,
          size: c.targetSize,
          price: c.targetPrice,
          barcode: c.targetBarcode,
          imageUrl: c.targetImg
        }
      })
    ));
    process.stdout.write(`\r   Progress: ${Math.min(i + BATCH_SIZE, singleRecordsToUpdate.length)} / ${singleRecordsToUpdate.length}`);
  }
  console.log('\n✅ All single records aligned with Master.');

  // Final check
  const finalOutletItems = await prisma.outletInventory.findMany();
  console.log(`\n📊 Final Outlet Inventory records: ${finalOutletItems.length}`);

  // Invalidate cache
  const cache = require('../src/utils/cache');
  cache.delPattern('pos:');
  cache.delPattern('inventory:');
  console.log('🧹 Purged POS and Inventory caches.');

  console.log('\n✨ Synchronization & Consolidation completed successfully!');
}

main().catch(err => {
  console.error('❌ Error during synchronization:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
