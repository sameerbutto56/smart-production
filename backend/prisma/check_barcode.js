const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const items = await p.inventoryItem.findMany({ include: { variants: true } });
  console.log('InventoryItem:', items.length);
  const missing = items.filter(i => !i.barcode);
  console.log('Missing barcode:', missing.length);

  const allVariants = [];
  for (const i of items) allVariants.push(...(i.variants || []));
  console.log('Total variants:', allVariants.length);
  const missVar = allVariants.filter(v => !v.barcode);
  console.log('Variants missing barcode:', missVar.length);

  for (const v of allVariants) {
    console.log('  Variant:', v.id, v.name, v.color, v.size, 'barcode:', v.barcode || '(none)');
  }
  await p.$disconnect();
})();
