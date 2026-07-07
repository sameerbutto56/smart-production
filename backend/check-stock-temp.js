const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.outletInventory.findMany({
    where: { name: { contains: 'Sprinter Cap' } },
    select: { id: true, name: true, color: true, size: true, stock: true, outletName: true }
  });
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
})();
