const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('=== ABBOTTABAD DATABASE AUDIT ===\n');

  const models = [
    'abbottabadDemandFinancial',
    'abbottabadAmountAccount',
    'abbottabadAmountProposal',
    'abbottabadAmountLedger',
    'abbottabadCostPriceUpload',
    'abbottabadCostPriceItem',
  ];
  console.log('--- Dedicated Abbottabad Models ---');
  for (const m of models) {
    if (prisma[m]) {
      const count = await prisma[m].count();
      console.log(`${m}: ${count} rows`);
    }
  }

  // Account details
  const accounts = await prisma.abbottabadAmountAccount.findMany();
  console.log('\nAbbottabadAmountAccount rows:', JSON.stringify(accounts, null, 2));

  // Proposals
  const proposals = await prisma.abbottabadAmountProposal.findMany();
  console.log('AbbottabadAmountProposal count:', proposals.length);

  // Ledgers
  const ledgers = await prisma.abbottabadAmountLedger.findMany();
  console.log('AbbottabadAmountLedger count:', ledgers.length);

  // Demands
  console.log('\n--- Demands for Abbottabad ---');
  const atdDemands = await prisma.outletDemandRequest.findMany({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } },
    select: { id: true, transferNumber: true, status: true, outletName: true, createdAt: true }
  });
  console.log(`outletDemandRequest (Abbottabad): ${atdDemands.length} rows`);
  atdDemands.forEach(d => console.log(`  - [${d.status}] ${d.transferNumber || d.id} (${d.outletName}) ${d.createdAt}`));

  // Orders
  console.log('\n--- Orders for Abbottabad ---');
  const atdOrders = await prisma.order.count({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(`order (outletName ~ Abbottabad): ${atdOrders}`);

  // POS Sales
  console.log('\n--- POS Data for Abbottabad ---');
  const atdPosSales = await prisma.posSale.count({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(`posSale (outletName ~ Abbottabad): ${atdPosSales}`);

  // POS Return
  const atdPosReturns = await prisma.posReturn.count({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(`posReturn (outletName ~ Abbottabad): ${atdPosReturns}`);

  // POS Book Session
  const atdPosBooks = await prisma.posBookSession.count({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(`posBookSession (outletName ~ Abbottabad): ${atdPosBooks}`);

  // OutletInventory (stock at Abbottabad)
  const atdOutletInv = await prisma.outletInventory.count({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(`outletInventory (outletName ~ Abbottabad): ${atdOutletInv}`);

  // Transfers
  console.log('\n--- Transfers for Abbottabad ---');
  const atdTransfers = await prisma.outletTransfer.count({
    where: {
      OR: [
        { fromOutlet: { contains: 'Abbottabad', mode: 'insensitive' } },
        { toOutlet: { contains: 'Abbottabad', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`outletTransfer (from/to Abbottabad): ${atdTransfers}`);

  // StockRequests
  console.log('\n--- StockRequests for Abbottabad ---');
  const atdStockReq = await prisma.stockRequest.count({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(`stockRequest (outletName ~ Abbottabad): ${atdStockReq}`);

  // Alteration / Engraving
  const atdAlt = await prisma.alterationRequest.count({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(`alterationRequest (outletName ~ Abbottabad): ${atdAlt}`);

  const atdEng = await prisma.engravingRequest.count({
    where: { outletName: { contains: 'Abbottabad', mode: 'insensitive' } }
  });
  console.log(`engravingRequest (outletName ~ Abbottabad): ${atdEng}`);

  // Non-Abbottabad comparison counts to ensure zero accidental impact
  console.log('\n--- Non-Abbottabad Verification Counts ---');
  const jtDemands = await prisma.outletDemandRequest.count({
    where: { outletName: { contains: 'Johar Town', mode: 'insensitive' } }
  });
  const jrDemands = await prisma.outletDemandRequest.count({
    where: { outletName: { contains: 'Jail Road', mode: 'insensitive' } }
  });
  console.log(`Johar Town Demands: ${jtDemands}, Jail Road Demands: ${jrDemands}`);

  const jtSales = await prisma.posSale.count({
    where: { outletName: { contains: 'Johar Town', mode: 'insensitive' } }
  });
  const jrSales = await prisma.posSale.count({
    where: { outletName: { contains: 'Jail Road', mode: 'insensitive' } }
  });
  console.log(`Johar Town PosSales: ${jtSales}, Jail Road PosSales: ${jrSales}`);

  console.log('\n=== AUDIT COMPLETE ===');
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
