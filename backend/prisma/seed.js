const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('enamels1212', 10);

  // Clear existing
  await prisma.stockRequest.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.orderStage.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.user.deleteMany({});

  // --- USERS ---
  const users = [
    { name: 'Admin', email: 'admin@enamels.com', role: 'SUPER_ADMIN' },
    { name: 'Manager', email: 'manager@enamels.com', role: 'ADMIN' },
    { name: 'Faisal', email: 'faisal@enamels.com', role: 'FAISAL' },
    { name: 'Store Keeper', email: 'store@enamels.com', role: 'STORE' },
    { name: 'Production', email: 'production@enamels.com', role: 'PRODUCTION' },
    { name: 'Logo Designer', email: 'logo@enamels.com', role: 'LOGO_DESIGN' },
    { name: 'Dispatch', email: 'dispatch@enamels.com', role: 'DISPATCH' },
    { name: 'Enamels Delivery', email: 'enamelsdilvery@enamels.com', role: 'DELIVERY_BOY' },
    { name: 'Johar Town', email: 'johartown@enamels.com', role: 'OUTLET' },
    { name: 'Jail Road', email: 'jailroad@enamels.com', role: 'OUTLET' },
    { name: 'Abbottabad', email: 'abbottabad@enamels.com', role: 'OUTLET' },
    { name: 'Big Screen', email: 'bigscreen@enamels.com', role: 'MAIN_EMPLOYEE' },
    { name: 'CEO', email: 'ceo@enamels.com', password: 'Enamels91.', role: 'CEO' },
  ];

  for (const u of users) {
    const pwd = u.password || hashedPassword;
    const { password: _, ...rest } = u;
    await prisma.user.create({
      data: { ...rest, password: bcrypt.hashSync(pwd, 10) }
    });
  }

  // --- INVENTORY ITEMS (grouped by product with variants) ---
  const products = [
    {
      name: 'Pro Scrub', category: 'SCRUBS', fabric: 'Premium Cotton',
      variants: [
        { color: 'Royal Blue', size: 'S', stock: 20, price: 2500 },
        { color: 'Royal Blue', size: 'M', stock: 40, price: 2500 },
        { color: 'Royal Blue', size: 'L', stock: 35, price: 2500 },
        { color: 'Royal Blue', size: 'XL', stock: 25, price: 2500 },
      ]
    },
    {
      name: 'Stretch Scrub', category: 'SCRUBS', fabric: 'Stretch Polyester',
      variants: [
        { color: 'Midnight Black', size: 'M', stock: 30, price: 2800 },
        { color: 'Midnight Black', size: 'L', stock: 35, price: 2800 },
        { color: 'Midnight Black', size: 'XL', stock: 30, price: 2800 },
      ]
    },
    {
      name: 'V-Neck Scrub Top', category: 'SCRUBS', fabric: 'Premium Cotton',
      variants: [
        { color: 'Royal Blue', size: 'S', stock: 30, price: 2200 },
        { color: 'Royal Blue', size: 'M', stock: 40, price: 2200 },
        { color: 'Royal Blue', size: 'L', stock: 30, price: 2200 },
        { color: 'Lavender', size: 'M', stock: 20, price: 2300 },
      ]
    },
    {
      name: 'Cargo Scrub Pants', category: 'SCRUBS', fabric: 'Stretch Polyester',
      variants: [
        { color: 'Charcoal Grey', size: 'M', stock: 35, price: 2600 },
        { color: 'Charcoal Grey', size: 'L', stock: 35, price: 2600 },
        { color: 'Charcoal Grey', size: 'XL', stock: 25, price: 2600 },
      ]
    },
    {
      name: 'Jogger Scrubs', category: 'SCRUBS', fabric: 'Cotton Blend',
      variants: [
        { color: 'Navy Blue', size: 'M', stock: 30, price: 3000 },
        { color: 'Navy Blue', size: 'L', stock: 30, price: 3000 },
      ]
    },
    {
      name: 'Teal Scrub Set', category: 'SCRUBS', fabric: 'Stretch Polyester',
      variants: [
        { color: 'Teal', size: 'M', stock: 25, price: 3200 },
        { color: 'Teal', size: 'L', stock: 25, price: 3200 },
      ]
    },
    // COATS
    {
      name: 'Classic Doctor Coat', category: 'COAT', fabric: 'Premium Cotton',
      variants: [
        { color: 'Pure White', size: 'M', stock: 15, price: 3500 },
        { color: 'Pure White', size: 'L', stock: 15, price: 3500 },
        { color: 'Pure White', size: 'XL', stock: 15, price: 3500 },
      ]
    },
    {
      name: 'Lab Coat (Long)', category: 'COAT', fabric: 'Polyester Blend',
      variants: [
        { color: 'Pure White', size: 'L', stock: 15, price: 3800 },
        { color: 'Pure White', size: 'XL', stock: 15, price: 3800 },
      ]
    },
    {
      name: 'Surgical Gown', category: 'COAT', fabric: 'Non-Woven',
      variants: [
        { color: 'Sky Blue', size: 'One Size', stock: 25, price: 1500 },
      ]
    },
    {
      name: 'Patient Gown', category: 'COAT', fabric: 'Cotton',
      variants: [
        { color: 'Light Blue', size: 'One Size', stock: 40, price: 1200 },
      ]
    },
    // CAPS
    {
      name: 'Surgical Cap (Bouffant)', category: 'CAPS', fabric: 'Non-Woven',
      variants: [
        { color: 'Sky Blue', size: 'One Size', stock: 250, price: 300 },
      ]
    },
    {
      name: 'Skull Cap', category: 'CAPS', fabric: 'Cotton',
      variants: [
        { color: 'White', size: 'One Size', stock: 180, price: 250 },
      ]
    },
    {
      name: 'Nurse Cap', category: 'CAPS', fabric: 'Cotton',
      variants: [
        { color: 'White', size: 'One Size', stock: 100, price: 350 },
      ]
    },
    // SHOES
    {
      name: 'White Clinic Shoes', category: 'SHOES', fabric: 'Leather',
      variants: [
        { color: 'White', size: 'M', stock: 30, price: 4500 },
        { color: 'White', size: 'L', stock: 30, price: 4500 },
      ]
    },
    {
      name: 'Surgical Clogs', category: 'SHOES', fabric: 'EVA',
      variants: [
        { color: 'Navy', size: 'L', stock: 40, price: 5500 },
      ]
    },
    {
      name: 'Orthopedic Sneakers', category: 'SHOES', fabric: 'Mesh',
      variants: [
        { color: 'Black', size: 'XL', stock: 35, price: 6000 },
      ]
    },
    // MASKS
    {
      name: 'Surgical Mask (N95)', category: 'MASK', fabric: 'Non-Woven',
      variants: [
        { color: 'White', size: 'One Size', stock: 500, price: 50 },
      ]
    },
    {
      name: 'Fabric Washable Mask', category: 'MASK', fabric: 'Cotton',
      variants: [
        { color: 'Multicolor', size: 'One Size', stock: 300, price: 80 },
      ]
    },
    {
      name: 'KN95 Mask', category: 'MASK', fabric: 'Non-Woven',
      variants: [
        { color: 'White', size: 'One Size', stock: 400, price: 60 },
      ]
    },
    // SOCKS
    {
      name: 'Compression Socks', category: 'SOCKS', fabric: 'Elastane',
      variants: [
        { color: 'White', size: 'L', stock: 150, price: 500 },
      ]
    },
    {
      name: 'Ankle Socks', category: 'SOCKS', fabric: 'Cotton',
      variants: [
        { color: 'White', size: 'M', stock: 200, price: 200 },
      ]
    },
  ];

  for (const item of products) {
    const totalStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
    await prisma.inventoryItem.create({
      data: {
        name: item.name,
        category: item.category,
        fabric: item.fabric,
        color: item.variants[0]?.color || null,
        size: item.variants[0]?.size || null,
        stock: totalStock,
        price: item.variants[0]?.price || 0,
        variants: item.variants,
      }
    });
  }

  console.log('✓ Seed completed successfully');
  console.log('');
  console.log('=== ALL ACCOUNTS (password: enamels1212) ===');
  console.log(' SUPER_ADMIN | admin@enamels.com           | Admin');
  console.log(' ADMIN       | manager@enamels.com         | Manager');
  console.log(' FAISAL      | faisal@enamels.com          | Faisal (Online Order)');
  console.log(' STORE       | store@enamels.com           | Store Keeper');
  console.log(' PRODUCTION  | production@enamels.com      | Production');
  console.log(' LOGO_DESIGN | logo@enamels.com            | Logo Designer');
  console.log(' DISPATCH    | dispatch@enamels.com        | Dispatch');
  console.log(' DELIVERY_BOY| enamelsdilvery@enamels.com  | Enamels Delivery');
  console.log(' OUTLET      | johartown@enamels.com       | Johar Town');
  console.log(' OUTLET      | jailroad@enamels.com        | Jail Road');
  console.log(' OUTLET      | abbottabad@enamels.com      | Abbottabad');
  console.log(' MAIN_EMPLOYEE| bigscreen@enamels.com      | Big Screen');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });