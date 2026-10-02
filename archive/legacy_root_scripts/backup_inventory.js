const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  console.log('📦 Creating inventory backup...');
  
  const items = await prisma.inventoryItem.findMany();
  const variants = await prisma.outletVariant.findMany();
  
  const backupData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    inventoryItems: items,
    outletVariants: variants
  };

  // Save to backend/backups/
  const backupDir = path.join(__dirname, '..', 'backend', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const filename = `inventory_backup_${Date.now()}.json`;
  const filepath = path.join(backupDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
  
  // Also save a copy to project root
  const rootCopy = path.join(__dirname, `inventory_backup_${new Date().toISOString().slice(0,10)}.json`);
  fs.writeFileSync(rootCopy, JSON.stringify(backupData, null, 2));
  
  console.log(`✅ Backup saved!`);
  console.log(`   Server: ${filepath}`);
  console.log(`   Local:  ${rootCopy}`);
  console.log(`   Products: ${items.length}`);
  console.log(`   Outlet Variants: ${variants.length}`);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
