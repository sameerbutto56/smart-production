const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const count = await p.inventoryItem.count();
  console.log('Current InventoryItems:', count);
  const items = await p.inventoryItem.findMany({ take: 30, select: { id: true, name: true, category: true } });
  for (const i of items) console.log('  -', i.name, '(' + i.category + ')');
  await p.$disconnect();
})();
