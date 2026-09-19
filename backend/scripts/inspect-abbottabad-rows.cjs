const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('--- Inspecting POS Book Session ---');
  const posBooks = await prisma.posBookSession.findMany({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(JSON.stringify(posBooks, null, 2));

  console.log('\n--- Inspecting Outlet Inventory ---');
  const outletInv = await prisma.outletInventory.findMany({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(JSON.stringify(outletInv, null, 2));

  console.log('\n--- Inspecting Abbottabad Demand ---');
  const demands = await prisma.outletDemandRequest.findMany({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(JSON.stringify(demands, null, 2));

  await prisma.$disconnect();
}

inspect().catch(console.error);
