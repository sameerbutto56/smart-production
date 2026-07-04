const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Correct prices based on product name patterns
// These are derived from the correctly-priced products already in the system
const PRICE_MAP = {
  // ─── CLOGS ₨4,500 ───
  'Clogs Flufftail': 4500,
  'Clogs MonoStarlings': 4500,
  'Clogs Muffle Bird Sole': 4500,
  'Clogs Snug Blockies': 4500,
  'Clogs Tumble Jays': 4500,
  'Clogs Work Duo': 4500,

  // ─── SPRINTER ₨2,800 ───
  'Sprinter E Print Men': 2800,
  'Sprinter E Print Women': 2800,
  'Sprinter Nova Women': 2800,
  'Sprinter Joggers Women': 3000,

  // ─── LAB COATS ₨3,500 ───
  'Lab-Coat Women Helium': 3500,
  'Lab Coat': 3500,
  'LabCoat Wrinkle Free': 3500,

  // ─── WHITE COATS ₨3,500 ───
  'Suiting White Coat Men': 3500,
  'Suiting White Coat Women': 3500,
  'Wrinkle Free White Coat Men': 3500,
  'Wrinkle Free White Coat Women': 3500,
  'Designer White Coat Women': 3500,

  // ─── TRENDER ₨2,800 ───
  'Trender Men': 2800,
  'Trender Women': 2800,
  'Trender Jack-Set Men': 3500,
  'Trender Jack-Set Women': 3500,
  'Trender Jack-Set 3pcs Men': 4500,
  'Trender Jack-Set 3pcs Women': 4500,
  'Trender Jacket Men': 3000,
  'Trender Jacket Women': 3000,

  // ─── CROWN ₨2,800 ───
  'Crown Men': 2800,
  'Crown Women': 2800,

  // ─── GALAXY/NOVA ₨2,800 ───
  'Galaxy Ocean Men': 2800,
  'nova': 2800,

  // ─── VELORA ₨2,800 ───
  'Velora Men': 2800,
  'Velora Women': 2800,

  // ─── SUMMIT ₨2,800 ───
  'Summit Executive Women': 2800,

  // ─── COTTON ₨2,800 ───
  'COTTON': 2800,
  'New Article': 2800,
  'Flex Stretch': 2800,

  // ─── AEROS SHOES ₨3,500 ───
  'Aeros Shoes': 3500,

  // ─── UNDER SCRUBS ₨1,800 ───
  'Under Scrubs Unisex': 1800,
  'Inner T': 800,

  // ─── ACCESSORIES ───
  'Buckle': 300,
  'Ajrak scrub': 2800,
  'FlexFit Unisex': 500,
  'Flex Fit Unisex': 500,
  'Temperature Bottle': 1500,
  'Tote Bag': 1500,
  'Makeup Bag': 1200,
  'Grafitti Bag': 1500,

  // ─── CUSTOMIZED ITEMS ₨2,500 (correct as-is) ───
  // Customised Design variants stay at 2500
  // Customised Logo variants stay at 2500

  // ─── ENGRAVING / PRINTING ───
  'Name Engraving': 500,
  'Name Printing': 300,
  'Logo': 500,
};

async function main() {
  console.log('💰 Updating product prices...\n');

  const items = await prisma.inventoryItem.findMany();
  let updated = 0;

  for (const item of items) {
    const correctPrice = PRICE_MAP[item.name];
    if (correctPrice !== undefined && item.price !== correctPrice) {
      // Also update variant prices if they exist
      let updatedVariants = item.variants;
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        updatedVariants = item.variants.map(v => ({
          ...v,
          price: v.price === item.price || !v.price || v.price === 2500 ? correctPrice : v.price
        }));
      }

      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { 
          price: correctPrice,
          variants: updatedVariants
        }
      });

      // Also update OutletVariant prices
      await prisma.outletVariant.updateMany({
        where: { 
          inventoryItemId: item.id,
          OR: [
            { price: item.price },
            { price: 2500 },
            { price: 0 },
            { price: null }
          ]
        },
        data: { price: correctPrice }
      });

      console.log(`  ✅ ${item.name.padEnd(40)} ₨${item.price} → ₨${correctPrice}`);
      updated++;
    }
  }

  console.log(`\n📊 Updated ${updated} products out of ${items.length} total.`);
  
  // Print final price list
  const final = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  console.log('\n--- FINAL PRICE LIST ---');
  final.forEach(i => console.log(`  ${i.name.padEnd(45)} ₨${i.price.toLocaleString()}`));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
