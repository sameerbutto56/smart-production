const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const items = await p.outletInventory.findMany();
  console.log('Total OutletInventory:', items.length);
  const noBarcode = items.filter(i => !i.barcode);
  console.log('Missing barcode:', noBarcode.length);
  for (const i of items) {
    console.log(i.id, i.outletName, i.name, i.color, i.size, 'barcode:', i.barcode || '(none)');
  }
  await p.$disconnect();
})();
