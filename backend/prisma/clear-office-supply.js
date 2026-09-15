const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Standalone cleanup for the Office Supply Module (isolated from Warehouse/POS).
// Deletes ONLY OfficeSupply tables (never touches inventory/user data) and does
// NOT re-seed — run the seed separately if demo data is needed again.
//
// Run with: node backend/prisma/clear-office-supply.js

async function main() {
  const modelNames = [
    'officeSupplyTransferItem',
    'officeSupplyTransfer',
    'officeSupplyDemandItem',
    'officeSupplyDemand',
    'officeSupplyStockMovement',
    'officeSupplyStock',
    'officeSupplyProduct',
    'officeSupplySequence',
  ];

  console.log('=== OFFICE SUPPLY CLEAR ===');
  for (const modelName of modelNames) {
    const count = await prisma[modelName].deleteMany({});
    console.log(` ${modelName}: ${count.count} row(s) deleted`);
  }

  console.log('');
  console.log('✓ Office Supply tables cleared (no re-seed performed).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });