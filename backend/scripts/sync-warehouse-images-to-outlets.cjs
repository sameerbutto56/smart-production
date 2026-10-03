const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- SYNCING WAREHOUSE PRODUCT IMAGES TO ALL OUTLETS ---');
  const warehouseItems = await prisma.inventoryItem.findMany();
  console.log(`Found ${warehouseItems.length} warehouse items to inspect.`);

  let syncedCount = 0;
  let outletsUpdated = 0;

  for (const item of warehouseItems) {
    let meta = {};
    if (item.metadata) {
      try { meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata; } catch(e) {}
    }
    const colorImages = { ...(meta?.colorImages || {}) };
    if (Array.isArray(item.variants)) {
      for (const v of item.variants) {
        if (v && v.color && v.imageUrl && !colorImages[v.color]) {
          colorImages[v.color] = v.imageUrl;
        }
      }
    }

    const hasImages = item.imageUrl || Object.keys(colorImages).length > 0;
    if (!hasImages) continue;

    syncedCount++;
    const trimmedName = (item.name || '').trim();
    const matchingOutlets = await prisma.outletInventory.findMany({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' }
      }
    });

    console.log(`[${syncedCount}] Product "${trimmedName}": ${Object.keys(colorImages).length} colors with images, matches ${matchingOutlets.length} outlet inventory rows.`);

    for (const oi of matchingOutlets) {
      let outletMeta = {};
      if (oi.metadata) {
        try { outletMeta = typeof oi.metadata === 'string' ? JSON.parse(oi.metadata) : { ...oi.metadata }; } catch(e) {}
      }
      outletMeta.colorImages = { ...(outletMeta.colorImages || {}), ...colorImages };

      let rawVariants = oi.variants;
      if (typeof rawVariants === 'string') {
        try { rawVariants = JSON.parse(rawVariants); } catch(e) {}
      }
      let updatedVariants = rawVariants;
      if (Array.isArray(rawVariants) && rawVariants.length > 0) {
        updatedVariants = rawVariants.map(v => {
          const vColor = (v.color || '').trim();
          let matchedImg = null;
          for (const [cName, cUrl] of Object.entries(colorImages)) {
            if (cName.trim().toLowerCase() === vColor.toLowerCase()) {
              matchedImg = cUrl;
              break;
            }
          }
          return {
            ...v,
            imageUrl: matchedImg || v.imageUrl || null
          };
        });
      }

      await prisma.outletInventory.update({
        where: { id: oi.id },
        data: {
          imageUrl: item.imageUrl || oi.imageUrl || null,
          metadata: JSON.stringify(outletMeta),
          variants: updatedVariants || undefined
        }
      });
      outletsUpdated++;
    }
  }

  // Clear cache
  try {
    const cache = require('../src/utils/cache');
    cache.delPattern('pos:');
    cache.delPattern('inventory:');
  } catch(e) {}

  console.log(`✅ Backfill complete. Synced ${syncedCount} warehouse products across ${outletsUpdated} outlet inventory records.`);
}

if (require.main === module) {
  main().catch(console.error).finally(() => prisma.$disconnect());
}

module.exports = { main };
