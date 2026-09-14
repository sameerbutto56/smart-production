const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Standalone seed for the Office Supply Module (isolated from Warehouse/POS).
// Clears only OfficeSupply tables (never touches inventory/user data) and
// inserts sample products + stock at STORE and the three outlets.
//
// Run with: node backend/prisma/seed-office-supply.js

const LOCATIONS = [
  { name: 'STORE', type: 'STORE' },
  { name: 'Johar Town', type: 'OUTLET' },
  { name: 'Jail Road', type: 'OUTLET' },
  { name: 'Abbottabad', type: 'OUTLET' },
];

const PRODUCTS = [
  { name: 'A4 Paper (80gsm)', sku: 'OFF-A4-001', unit: 'Ream', description: 'Standard A4 copier paper', isActive: true },
  { name: 'Ballpoint Pen Blue', sku: 'OFF-PEN-001', unit: 'Box', description: 'Box of 12', isActive: true },
  { name: 'Ballpoint Pen Black', sku: 'OFF-PEN-002', unit: 'Box', description: 'Box of 12', isActive: true },
  { name: 'Permanent Marker Black', sku: 'OFF-MRK-001', unit: 'Pcs', description: 'Permanent marker', isActive: true },
  { name: 'Whiteboard Marker Blue', sku: 'OFF-MRK-002', unit: 'Pcs', description: 'Dry erase marker', isActive: true },
  { name: 'Heavy Duty Stapler', sku: 'OFF-STP-001', unit: 'Pcs', description: 'Metal desk stapler', isActive: true },
  { name: 'Staples 26/6', sku: 'OFF-STP-002', unit: 'Box', description: 'Box of 1000', isActive: true },
  { name: 'A4 Notebook (200 pg)', sku: 'OFF-NB-001', unit: 'Pcs', description: 'Hard cover notebook', isActive: true },
  { name: 'Envelope A5', sku: 'OFF-ENV-001', unit: 'Packet', description: 'Packet of 20', isActive: true },
  { name: 'Manila File', sku: 'OFF-FL-001', unit: 'Pcs', description: 'Folder file', isActive: true },
  { name: 'Glue Stick 20g', sku: 'OFF-GL-001', unit: 'Pcs', description: 'Washable glue stick', isActive: true },
  { name: 'Masking Tape (Roll)', sku: 'OFF-TP-001', unit: 'Roll', description: '1 inch width', isActive: true },
  { name: 'Paper Clips (Large)', sku: 'OFF-PC-001', unit: 'Box', description: 'Box of 100', isActive: true },
  { name: 'Correction Fluid', sku: 'OFF-CF-001', unit: 'Pcs', description: 'White correction fluid', isActive: true },
  { name: 'Sticky Notes (3x3)', sku: 'OFF-SN-001', unit: 'Packet', description: 'Packet of 6 pads', isActive: true },
  { name: 'Scissors', sku: 'OFF-SC-001', unit: 'Pcs', description: 'Office scissors', isActive: true },
  { name: 'Cutter Knife', sku: 'OFF-CT-001', unit: 'Pcs', description: 'Retractable blade cutter', isActive: true },
  { name: 'Highlighter Yellow', sku: 'OFF-HL-001', unit: 'Pcs', description: 'Fluorescent highlighter', isActive: true },
  { name: 'Daily Register (300 pg)', sku: 'OFF-RG-001', unit: 'Pcs', description: 'Attendance / daily register', isActive: true },
  { name: 'Binder Clips (Medium)', sku: 'OFF-BC-001', unit: 'Box', description: 'Box of 24', isActive: true },
  { name: 'Dustbin (Pedal)', sku: 'OFF-DB-001', unit: 'Pcs', description: 'Discontinued - kept for history', isActive: false },
  { name: 'Desk Organizer', sku: 'OFF-DO-001', unit: 'Pcs', description: 'Discontinued - kept for history', isActive: false },
];

// Stock levels per product, per location. Keyed by product name so it stays
// readable; quantity lives on OfficeSupplyStock (productId + location unique).
const STOCK = {
  'A4 Paper (80gsm)': { 'STORE': 50, 'Johar Town': 20, 'Jail Road': 15, 'Abbottabad': 10 },
  'Ballpoint Pen Blue': { 'STORE': 30, 'Johar Town': 10, 'Jail Road': 8, 'Abbottabad': 5 },
  'Ballpoint Pen Black': { 'STORE': 30, 'Johar Town': 10, 'Jail Road': 8, 'Abbottabad': 5 },
  'Permanent Marker Black': { 'STORE': 60, 'Johar Town': 20, 'Jail Road': 15, 'Abbottabad': 10 },
  'Whiteboard Marker Blue': { 'STORE': 40, 'Johar Town': 15, 'Jail Road': 10, 'Abbottabad': 8 },
  'Heavy Duty Stapler': { 'STORE': 12, 'Johar Town': 4, 'Jail Road': 3, 'Abbottabad': 2 },
  'Staples 26/6': { 'STORE': 25, 'Johar Town': 8, 'Jail Road': 6, 'Abbottabad': 4 },
  'A4 Notebook (200 pg)': { 'STORE': 40, 'Johar Town': 15, 'Jail Road': 12, 'Abbottabad': 8 },
  'Envelope A5': { 'STORE': 35, 'Johar Town': 12, 'Jail Road': 10, 'Abbottabad': 6 },
  'Manila File': { 'STORE': 55, 'Johar Town': 20, 'Jail Road': 15, 'Abbottabad': 10 },
  'Glue Stick 20g': { 'STORE': 45, 'Johar Town': 15, 'Jail Road': 12, 'Abbottabad': 8 },
  'Masking Tape (Roll)': { 'STORE': 28, 'Johar Town': 10, 'Jail Road': 8, 'Abbottabad': 5 },
  'Paper Clips (Large)': { 'STORE': 22, 'Johar Town': 8, 'Jail Road': 6, 'Abbottabad': 4 },
  'Correction Fluid': { 'STORE': 32, 'Johar Town': 10, 'Jail Road': 8, 'Abbottabad': 5 },
  'Sticky Notes (3x3)': { 'STORE': 26, 'Johar Town': 9, 'Jail Road': 7, 'Abbottabad': 5 },
  'Scissors': { 'STORE': 18, 'Johar Town': 6, 'Jail Road': 4, 'Abbottabad': 3 },
  'Cutter Knife': { 'STORE': 20, 'Johar Town': 7, 'Jail Road': 5, 'Abbottabad': 3 },
  'Highlighter Yellow': { 'STORE': 38, 'Johar Town': 14, 'Jail Road': 10, 'Abbottabad': 6 },
  'Daily Register (300 pg)': { 'STORE': 16, 'Johar Town': 5, 'Jail Road': 4, 'Abbottabad': 3 },
  'Binder Clips (Medium)': { 'STORE': 24, 'Johar Town': 8, 'Jail Road': 6, 'Abbottabad': 4 },
  'Dustbin (Pedal)': { 'STORE': 0, 'Johar Town': 0, 'Jail Road': 0, 'Abbottabad': 0 },
  'Desk Organizer': { 'STORE': 0, 'Johar Town': 0, 'Jail Road': 0, 'Abbottabad': 0 },
};

async function main() {
  // Clear existing Office Supply data (no FKs into other modules).
  await prisma.officeSupplyTransferItem.deleteMany({});
  await prisma.officeSupplyTransfer.deleteMany({});
  await prisma.officeSupplyDemandItem.deleteMany({});
  await prisma.officeSupplyDemand.deleteMany({});
  await prisma.officeSupplyStockMovement.deleteMany({});
  await prisma.officeSupplyStock.deleteMany({});
  await prisma.officeSupplyProduct.deleteMany({});
  await prisma.officeSupplySequence.deleteMany({});

  // --- PRODUCTS ---
  const productRows = [];
  for (const p of PRODUCTS) {
    const row = await prisma.officeSupplyProduct.create({
      data: {
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        description: p.description || null,
        isActive: p.isActive,
      },
    });
    productRows.push({ ...row, name: p.name });
  }

  // --- STOCK rows (productId + location unique) ---
  let stockCount = 0;
  for (const row of productRows) {
    const perLocation = STOCK[row.name] || {};
    for (const location of LOCATIONS) {
      const quantity = perLocation[location.name] ?? 0;
      await prisma.officeSupplyStock.create({
        data: {
          productId: row.id,
          location: location.name,
          locationType: location.type,
          quantity,
        },
      });
      stockCount += 1;
    }
  }

  // --- SEQUENCES seeded for clean document numbering ---
  const currentYear = new Date().getFullYear();
  await prisma.officeSupplySequence.create({
    data: { prefix: 'OSTR', year: currentYear, nextValue: 1 },
  });
  await prisma.officeSupplySequence.create({
    data: { prefix: 'DEMOFF', year: currentYear, nextValue: 1 },
  });

  console.log(`✓ Office Supply seed completed (${productRows.length} products, ${stockCount} stock rows)`);
  console.log('');
  console.log('=== OFFICE SUPPLY SEED ===');
  console.log(` Products: ${productRows.length}`);
  console.log(` STOCK rows: ${stockCount} (${LOCATIONS.length} locations)`);
  console.log(` Sequences: OSTR/${currentYear}=1 next, DEMOFF/${currentYear}=1 next`);
  console.log(' Locations: STORE, Johar Town, Jail Road, Abbottabad');
  console.log(' Note: 2 products are isActive=false (kept for history).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });