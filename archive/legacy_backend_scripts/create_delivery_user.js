// Script to create a Delivery Boy user in the database
// Run with: node create_delivery_user.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('delivery123', 10);
  
  const existing = await prisma.user.findUnique({ where: { email: 'delivery@enamels.com' } });
  if (existing) {
    console.log('✅ Delivery user already exists:', existing.email);
    console.log('   Role:', existing.role);
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: 'Delivery Boy',
      email: 'delivery@enamels.com',
      password,
      role: 'DELIVERY_BOY',
      employeeId: 'DLV-001'
    }
  });

  console.log('✅ Delivery Boy user created successfully!');
  console.log('   Email: delivery@enamels.com');
  console.log('   Password: delivery123');
  console.log('   Role:', user.role);
  console.log('   ID:', user.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
