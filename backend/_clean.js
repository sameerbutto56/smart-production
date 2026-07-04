const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.posReturn.deleteMany({});
  await p.posSaleItem.deleteMany({});
  await p.posSale.deleteMany({});
  await p.outletTransferItem.deleteMany({});
  await p.outletTransfer.deleteMany({});
  await p.outletDemandRequest.deleteMany({});
  await p.outletVariant.deleteMany({});
  await p.inventoryItem.deleteMany({});
  console.log('All POS products deleted');
  await p.$disconnect();
})();
