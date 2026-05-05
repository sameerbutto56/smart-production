const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding large dummy data...');

  // 2. Seed System Settings
  await prisma.systemSetting.upsert({
    where: { key: 'STAGE_DURATIONS' },
    update: {},
    create: {
      key: 'STAGE_DURATIONS',
      value: JSON.stringify({
        'STORE': 2,
        'CUTTING': 24,
        'STITCHING': 48,
        'QA': 4,
        'PRESSING_PACKING': 4,
        'NAME_LOGO': 8,
        'CUSTOM_LOGO': 12,
        'DISPATCH': 2,
        'FAISAL_APPROVAL': 2
      })
    }
  });

  // 3. Seed Inventory
  const categories = ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'COLOR'];
  const fabrics = ['Cotton Blend', 'Poly-Cotton', 'Spandex Flex', 'Premium Linen'];
  const colors = ['Royal Blue', 'Deep Emerald', 'Classic White', 'Charcoal Grey', 'Navy Blue', 'Wine Red'];

  console.log('📦 Seeding inventory...');
  for (let i = 0; i < 20; i++) {
    await prisma.inventoryItem.create({
      data: {
        name: `Product ${i + 1}`,
        category: categories[Math.floor(Math.random() * 5)],
        stock: Math.floor(Math.random() * 200),
        price: Math.floor(Math.random() * 50) + 10,
        fabric: fabrics[Math.floor(Math.random() * fabrics.length)],
        color: colors[Math.floor(Math.random() * colors.length)]
      }
    });
  }

  for (const f of fabrics) {
    await prisma.inventoryItem.create({
      data: { name: f, category: 'FABRIC', stock: 500 }
    });
  }

  for (const c of colors) {
    await prisma.inventoryItem.create({
      data: { name: c, category: 'COLOR', stock: 1000 }
    });
  }

  // 4. Seed Orders
  const customers = [
    'Dr. Sarah Johnson', 'City General Hospital', 'Ahmed Al-Farsi', 
    'Elite Medical Clinic', 'Zainab Qureshi', 'Metropolitan Health', 
    'St. Jude Medical', 'Omar Hassan', 'Blue Sky Pediatrics', 'Grace Wellness'
  ];

  const orderTypes = ['STANDARD', 'READY_LOGO', 'FULL_CUSTOM'];
  const stages = ['STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH'];

  console.log('📋 Seeding orders...');
  for (let i = 0; i < 30; i++) {
    const type = orderTypes[Math.floor(Math.random() * orderTypes.length)];
    const status = i < 5 ? 'COMPLETED' : i < 15 ? 'IN_PROGRESS' : 'PENDING';
    const currentStage = status === 'COMPLETED' ? 'DISPATCH' : stages[Math.floor(Math.random() * stages.length)];
    
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${700 + i}`,
        customerName: customers[Math.floor(Math.random() * customers.length)],
        type: type,
        urgent: Math.random() > 0.8,
        status: status,
        currentStage: currentStage,
        advancePaid: type === 'FULL_CUSTOM' || Math.random() > 0.5,
        paymentStatus: i < 10 ? 'FULL_PAID' : 'ADVANCE_PAID',
        productDetails: JSON.stringify({
          productType: 'Standard Scrub',
          fabricType: 'Cotton Blend',
          color: 'Royal Blue',
          size: 'M'
        }),
        createdAt: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000)
      }
    });

    const stageIndex = stages.indexOf(currentStage);
    for (let j = 0; j <= stageIndex; j++) {
      const isCurrent = j === stageIndex;
      const isWaiting = isCurrent && i % 3 === 0 && status !== 'COMPLETED';

      await prisma.orderStage.create({
        data: {
          orderId: order.id,
          stageName: stages[j],
          status: isWaiting ? 'WAITING_APPROVAL' : (j < stageIndex || status === 'COMPLETED') ? 'COMPLETED' : 'PENDING',
          requestNextStep: isWaiting,
          completedAt: (j < stageIndex || status === 'COMPLETED') ? new Date(order.createdAt.getTime() + (j + 1) * 3600000 * 24) : null,
          deadlineAt: new Date(Date.now() + 3600000 * 48),
          createdAt: new Date(order.createdAt.getTime() + j * 3600000 * 12)
        }
      });
    }
  }

  console.log('✅ Seeding completed!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
