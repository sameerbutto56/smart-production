const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const products = await prisma.officeSupplyProduct.count();
  const active = await prisma.officeSupplyProduct.count({ where: { isActive: true } });
  const stockRows = await prisma.officeSupplyStock.count();
  const stockQty = await prisma.officeSupplyStock.aggregate({ _sum: { quantity: true } });
  const movements = await prisma.officeSupplyStockMovement.count();
  const demands = await prisma.officeSupplyDemand.count();
  const transfers = await prisma.officeSupplyTransfer.count();
  const seq = await prisma.officeSupplySequence.findMany({ orderBy: [{ prefix: 'asc' }] });
  const byLocation = await prisma.officeSupplyStock.groupBy({
    by: ['location'],
    _count: { _all: true },
    _sum: { quantity: true },
  });

  console.log('Products:', products, '(active ' + active + ')');
  console.log('Stock rows:', stockRows, '| total qty:', stockQty._sum.quantity);
  console.log('Movements:', movements, '| Demands:', demands, '| Transfers:', transfers);
  console.log('Sequences:', JSON.stringify(seq, null, 2));
  console.log('Stock by location:', JSON.stringify(byLocation, null, 2));

  const sample = await prisma.officeSupplyProduct.findFirst({
    where: { isActive: true },
    select: { name: true, sku: true },
  });
  console.log('Sample active product:', JSON.stringify(sample, null, 2));
  const inactive = await prisma.officeSupplyProduct.findMany({
    where: { isActive: false },
    select: { name: true, sku: true },
  });
  console.log('Inactive products:', JSON.stringify(inactive, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });