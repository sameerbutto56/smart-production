const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const items = await p.inventoryItem.findMany();
  console.log('Total InventoryItem:', items.length);
  for (const i of items) {
    console.log('---');
    console.log('id:', i.id);
    console.log('name:', i.name);
    console.log('category:', i.category);
    console.log('color:', i.color);
    console.log('size:', i.size);
    console.log('stock:', i.stock);
    console.log('price:', i.price);
    console.log('variants:', JSON.stringify(i.variants));
    console.log('metadata:', i.metadata);
  }
  await p.$disconnect();
})();
