const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Step 1: Backup inventory tables
  console.log('=== Backing up inventory tables ===');
  const invData = {
    InventoryItem: await prisma.inventoryItem.findMany(),
    OutletInventory: await prisma.outletInventory.findMany(),
    StockRequest: await prisma.stockRequest.findMany(),
    Allocation: await prisma.allocation.findMany(),
    AllocationCart: await prisma.allocationCart.findMany(),
    ProductionInventory: await prisma.productionInventory.findMany(),
    OutletDemandRequest: await prisma.outletDemandRequest.findMany(),
    OutletTransfer: await prisma.outletTransfer.findMany(),
    OutletTransferItem: await prisma.outletTransferItem.findMany(),
  };
  fs.writeFileSync(path.join(dir, `inventory-backup-${date}.json`), JSON.stringify(invData, null, 2));
  for (const [t, rows] of Object.entries(invData)) console.log(`  ${t}: ${rows.length} records`);

  // Step 2: Backup POS data (just in case)
  const posBackup = {
    PosSale: await prisma.posSale.findMany({ include: { items: true, returns: true } }),
  };
  fs.writeFileSync(path.join(dir, `pos-backup-${date}.json`), JSON.stringify(posBackup, null, 2));
  console.log(`\nPOS backup: ${posBackup.PosSale.length} sales`);

  // Step 3: Show current POS data per outlet
  const sales = await prisma.posSale.findMany({ include: { items: true, returns: true } });
  const byOutlet = {};
  for (const s of sales) {
    const o = s.outletName || 'Unknown';
    if (!byOutlet[o]) byOutlet[o] = { count: 0, total: 0, sales: [] };
    byOutlet[o].count++;
    byOutlet[o].total += s.grandTotal;
    byOutlet[o].sales.push(s);
  }
  console.log('\n=== Current POS data per outlet ===');
  for (const [outlet, data] of Object.entries(byOutlet)) {
    console.log(`  ${outlet}: ${data.count} sales, ₨${data.total}`);
  }

  // Step 4: Delete Johar Town and Jail Road POS data
  const targets = ['Johar Town', 'Jail Road'];
  console.log('\n=== Cleaning POS data ===');
  for (const outlet of targets) {
    const toDelete = sales.filter(s => s.outletName === outlet);
    console.log(`  ${outlet}: ${toDelete.length} sales to delete`);
    for (const sale of toDelete) {
      // Delete returns first (FK constraint)
      if (sale.returns.length > 0) {
        await prisma.posReturn.deleteMany({ where: { saleId: sale.id } });
      }
      // Delete items
      await prisma.posSaleItem.deleteMany({ where: { saleId: sale.id } });
      // Delete sale
      await prisma.posSale.delete({ where: { id: sale.id } });
    }
    console.log(`  ✓ ${outlet} cleaned`);
  }

  // Step 5: Verify
  const remaining = await prisma.posSale.findMany();
  const byOutlet2 = {};
  for (const s of remaining) {
    const o = s.outletName || 'Unknown';
    if (!byOutlet2[o]) byOutlet2[o] = { count: 0, total: 0 };
    byOutlet2[o].count++;
    byOutlet2[o].total += s.grandTotal;
  }
  console.log('\n=== Remaining POS data ===');
  for (const [outlet, data] of Object.entries(byOutlet2)) {
    console.log(`  ${outlet}: ${data.count} sales`);
  }
  if (Object.keys(byOutlet2).length === 0) console.log('  (empty)');

  await prisma.$disconnect();
  console.log('\nDone. Backups saved in backend/backups/');
}

main().catch(err => { console.error(err); process.exit(1); });
