const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Clear existing for a fresh seed
  await prisma.user.deleteMany({});
  await prisma.inventoryItem.deleteMany({});

  // --- USERS / EMPLOYEES ---
  const users = [
    { name: 'Admin Boss', email: 'admin@smartpro.com', role: 'ADMIN' },
    { name: 'Order Entry', email: 'order@smartpro.com', role: 'ORDER_EMPLOYEE' },
    { name: 'Store Keeper', email: 'store@smartpro.com', role: 'STORE_EMPLOYEE' },
    { name: 'Master Cutter', email: 'cutting@smartpro.com', role: 'CUTTING_EMPLOYEE' },
    { name: 'Lead Tailor', email: 'stitching@smartpro.com', role: 'STITCHING_EMPLOYEE' },
    { name: 'Quality Inspector', email: 'qc@smartpro.com', role: 'QUALITY_CHECK_EMPLOYEE' },
    { name: 'Press Specialist', email: 'pressing@smartpro.com', role: 'PRESSING_EMPLOYEE' },
    { name: 'Packager Pro', email: 'packaging@smartpro.com', role: 'PACKAGING_EMPLOYEE' },
    { name: 'Dispatch Manager', email: 'dispatch@smartpro.com', role: 'MAIN_EMPLOYEE' },
  ];

  for (const u of users) {
    await prisma.user.create({
      data: { ...u, password: hashedPassword }
    });
  }

  // --- MEGA INVENTORY SEED ---
  const products = [
    { name: 'Pro Scrub (Blue Cotton)', category: 'SCRUBS', stock: 120, color: 'Royal Blue', fabric: 'Premium Cotton' },
    { name: 'Stretch Scrub (Black)', category: 'SCRUBS', stock: 95, color: 'Midnight Black', fabric: 'Stretch Polyester' },
    { name: 'V-Neck Scrub Top', category: 'SCRUBS', stock: 120 },
    { name: 'Cargo Scrub Pants', category: 'SCRUBS', stock: 95 },
    { name: 'Jogger Scrubs', category: 'SCRUBS', stock: 60 },
    { name: 'Classic Doctor Coat', category: 'COAT', stock: 45, color: 'Pure White', fabric: 'Premium Cotton' },
    { name: 'Lab Apron', category: 'COAT', stock: 30 },
    { name: 'Surgical Mask (N95)', category: 'MASK', stock: 500, color: 'Sky Blue' },
    { name: 'Fabric Washable Mask', category: 'MASK', stock: 300 },
    { name: 'Bouffant Cap', category: 'CAPS', stock: 250 },
    { name: 'Skull Cap', category: 'CAPS', stock: 180 },
    { name: 'Compression Socks', category: 'SOCKS', stock: 150 },
    { name: 'Ankle Socks', category: 'SOCKS', stock: 200 },
  ];

  const fabrics = [
    { name: 'Premium Cotton', category: 'FABRIC', stock: 500 },
    { name: 'Stretch Polyester', category: 'FABRIC', stock: 400 },
    { name: 'Denim', category: 'FABRIC', stock: 100 },
    { name: 'Linen', category: 'FABRIC', stock: 150 },
  ];

  const colors = [
    { name: 'Royal Blue', category: 'COLOR', stock: 1000 },
    { name: 'Emerald Green', category: 'COLOR', stock: 1000 },
    { name: 'Midnight Black', category: 'COLOR', stock: 1000 },
    { name: 'Wine Red', category: 'COLOR', stock: 1000 },
    { name: 'Sky Blue', category: 'COLOR', stock: 1000 },
    { name: 'Lavender', category: 'COLOR', stock: 1000 },
    { name: 'Charcoal Grey', category: 'COLOR', stock: 1000 },
    { name: 'Pure White', category: 'COLOR', stock: 1000 },
  ];

  const allItems = [...products, ...fabrics, ...colors];

  for (const item of allItems) {
    await prisma.inventoryItem.create({ data: item });
  }

  console.log('Seed completed: All Employees and Mega Inventory Initialized.');
  console.log('Use "password123" for all accounts.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
