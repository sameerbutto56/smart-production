// Full database backup script — reads all data via Prisma
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(BACKUP_DIR, `backup-${timestamp}`);
  fs.mkdirSync(dir, { recursive: true });

  const models = [
    'user', 'order', 'orderStage', 'auditLog', 'dispatchLog',
    'deliveryAttempt', 'revenueRecord', 'inventoryItem', 'outletInventory',
    'stockRequest', 'allocation', 'allocationCart', 'orderEditRequest',
    'deletedOrder', 'systemSetting', 'productionRecord', 'productionInventory',
    'seenTask', 'routingHistory', 'outletDemandRequest', 'personalNote',
    'chatMessage', 'chatMessageReadReceipt', 'client', 'posSale',
    'posBalancePayment', 'posSaleItem', 'posReturn', 'outletTransfer',
    'outletTransferItem', 'posBookSession', 'outletEmployee', 'journalEntry',
    'deliveryPayment', 'noResponseLog', 'deliveryCharge',
    'deliveryChargePayment', 'cODCollection', 'orderAcceptance'
  ];

  let totalRecords = 0;

  for (const model of models) {
    try {
      const data = await prisma[model].findMany();
      const filePath = path.join(dir, `${model}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      totalRecords += data.length;
      console.log(`✓ ${model}: ${data.length} records`);
    } catch (err) {
      console.error(`✗ ${model}: ${err.message}`);
    }
  }

  // Create manifest
  const manifest = {
    timestamp: new Date().toISOString(),
    totalRecords,
    models: models.filter(m => fs.existsSync(path.join(dir, `${m}.json`)))
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n✅ Backup complete: ${dir}`);
  console.log(`   Total records: ${totalRecords}`);
  console.log(`   File size: ${(fs.statSync(path.join(dir, 'manifest.json')).size / 1024).toFixed(1)} KB + data files`);

  await prisma.$disconnect();
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
