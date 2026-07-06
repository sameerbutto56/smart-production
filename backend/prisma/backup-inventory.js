const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backup() {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const data = {
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

  const filePath = path.join(dir, `inventory-backup-${date}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('Backup saved:', filePath);

  // Count summary
  for (const [table, rows] of Object.entries(data)) {
    console.log(`  ${table}: ${rows.length} records`);
  }

  await prisma.$disconnect();
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
