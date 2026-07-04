const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const count = await p.inventoryItem.count();
  console.log(`Current inventory count: ${count}`);
  const items = await p.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  items.forEach(i => console.log(`  "${i.name}" (${i.category})`));
  await p.$disconnect();
})();
