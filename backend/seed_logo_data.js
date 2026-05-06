const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addLogoDummyData() {
  const dummyOrders = [
    {
      orderNumber: 'LOGO-TEST-001',
      customerName: 'Premium Medical Center',
      type: 'READY_LOGO',
      logoName: 'PMC-HERO',
      logoDesign: 'Circular Emblem',
      productDetails: JSON.stringify({ productType: 'Scrub Set', fabricType: 'Cotton', color: 'Royal Blue' }),
      customization: JSON.stringify({ nameSpelling: 'Dr. John Doe', nameColor: 'Gold', logoPlacement: 'Left Pocket' }),
      currentStage: 'LOGO_DESIGN',
      status: 'IN_PROGRESS'
    },
    {
      orderNumber: 'LOGO-TEST-002',
      customerName: 'City Dental Clinic',
      type: 'FULL_CUSTOM',
      logoName: 'CDC-LOGO',
      logoDesign: 'Tooth Icon',
      productDetails: JSON.stringify({ productType: 'Lab Coat', fabricType: 'Linen', color: 'White' }),
      customization: JSON.stringify({ nameSpelling: 'Dr. Jane Smith', nameColor: 'Navy', logoPlacement: 'Sleeve' }),
      currentStage: 'LOGO_DESIGN',
      status: 'IN_PROGRESS'
    }
  ];

  try {
    for (const data of dummyOrders) {
      const order = await prisma.order.create({ data });
      
      // Add completed STORE stage
      await prisma.orderStage.create({
        data: {
          orderId: order.id,
          stageName: 'STORE',
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      // Add active LOGO_DESIGN stage
      await prisma.orderStage.create({
        data: {
          orderId: order.id,
          stageName: 'LOGO_DESIGN',
          status: 'PENDING',
          deadlineAt: new Date(Date.now() + 48 * 3600000)
        }
      });
    }
    console.log('✅ Added 2 dummy orders for Logo Design department');
  } catch (error) {
    console.error('❌ Error adding dummy data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addLogoDummyData();
