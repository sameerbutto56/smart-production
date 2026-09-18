/**
 * sync-category-configs.cjs
 * 
 * Synchronizes ProductCategoryConfig table and updates genderApplicable
 * on all InventoryItem and OutletInventory records in the database.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORY_CONFIGS = [
  { category: 'SCRUBS', genderApplicable: true, hasSizes: true },
  { category: 'LABCOAT', genderApplicable: true, hasSizes: true },
  { category: 'INNER TEES', genderApplicable: true, hasSizes: true },
  { category: 'CAPS', genderApplicable: false, hasSizes: false },
  { category: 'BOTTLE', genderApplicable: false, hasSizes: false },
  { category: 'SLEEVES', genderApplicable: false, hasSizes: false },
  { category: 'UNSTICH', genderApplicable: false, hasSizes: false },
  { category: 'BAG', genderApplicable: false, hasSizes: false },
  { category: 'SOCKS', genderApplicable: false, hasSizes: false },
  { category: 'SHOES', genderApplicable: false, hasSizes: true },
  { category: 'CLOGS', genderApplicable: false, hasSizes: true },
  { category: 'LOGO', genderApplicable: false, hasSizes: false },
  { category: 'FABRIC', genderApplicable: false, hasSizes: false },
  { category: 'PRODUCTION', genderApplicable: false, hasSizes: true },
];

async function main() {
  console.log('=== SYNCING PRODUCT CATEGORY CONFIGURATIONS ===\n');

  // 1. Upsert category configs
  for (const cfg of CATEGORY_CONFIGS) {
    await prisma.productCategoryConfig.upsert({
      where: { category: cfg.category },
      create: cfg,
      update: { genderApplicable: cfg.genderApplicable, hasSizes: cfg.hasSizes },
    });
  }
  console.log(`✓ Synchronized ${CATEGORY_CONFIGS.length} category configurations in DB`);

  // 2. Batch update InventoryItem genderApplicable by category
  for (const cfg of CATEGORY_CONFIGS) {
    const res = await prisma.inventoryItem.updateMany({
      where: { category: { equals: cfg.category, mode: 'insensitive' } },
      data: { genderApplicable: cfg.genderApplicable },
    });
    console.log(`  InventoryItem [${cfg.category}]: ${res.count} items set to genderApplicable=${cfg.genderApplicable}`);
  }

  // 3. Batch update OutletInventory genderApplicable by category
  for (const cfg of CATEGORY_CONFIGS) {
    const res = await prisma.outletInventory.updateMany({
      where: { category: { equals: cfg.category, mode: 'insensitive' } },
      data: { genderApplicable: cfg.genderApplicable },
    });
    console.log(`  OutletInventory [${cfg.category}]: ${res.count} items set to genderApplicable=${cfg.genderApplicable}`);
  }

  console.log('\n✅ Category configuration sync completed successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
