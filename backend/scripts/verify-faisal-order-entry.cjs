/**
 * verify-faisal-order-entry.cjs
 * Test creating an order exactly as submitted by Faisal Order Entry,
 * verifying that it returns 201 without ReferenceError.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createOrder } = require('../src/controllers/order.controller');

async function main() {
  console.log('=== Verifying Faisal Order Entry createOrder Controller ===\n');

  // Find or use a test order number
  const testOrderNumber = 'TEST-ORDER-FAISAL-99999';
  const existingOrd = await prisma.order.findFirst({ where: { orderNumber: testOrderNumber } });
  if (existingOrd) {
    await prisma.orderStage.deleteMany({ where: { orderId: existingOrd.id } });
    await prisma.auditLog.deleteMany({ where: { orderId: existingOrd.id } });
    await prisma.routingHistory.deleteMany({ where: { orderId: existingOrd.id } });
    await prisma.order.delete({ where: { id: existingOrd.id } });
  }

  const realUser = await prisma.user.findFirst({ where: { role: 'FAISAL' } }) || await prisma.user.findFirst();

  const req = {
    user: { id: realUser.id, role: realUser.role, name: realUser.name },
    body: {
      orderNumber: testOrderNumber,
      customerName: 'Test Customer',
      customerPhone: '03001234567',
      address: 'Test Address',
      city: 'Lahore',
      type: 'STANDARD',
      urgent: false,
      priority: 'NORMAL',
      quantity: 1,
      shopifyOrderDate: '2026-09-19',
      items: [
        {
          productDetails: {
            productType: 'SCRUBS',
            color: 'Navy Blue',
            size: 'M',
            gender: 'Male'
          },
          gender: 'Male',
          quantity: 1
        }
      ]
    },
    app: {
      get: (key) => {
        if (key === 'io') return { emit: () => {} };
        return null;
      }
    }
  };

  let statusSent = null;
  let jsonSent = null;

  const res = {
    status: (code) => {
      statusSent = code;
      return res;
    },
    json: (data) => {
      jsonSent = data;
      return res;
    }
  };

  try {
    await createOrder(req, res);

    console.log(`Status Code: ${statusSent}`);
    if (statusSent === 201) {
      console.log('✓ PASS: Order created successfully with 201!');
      console.log('Created order details:', {
        id: jsonSent.id,
        orderNumber: jsonSent.orderNumber,
        currentStage: jsonSent.currentStage,
        productDetails: jsonSent.productDetails
      });
    } else {
      console.error('✗ FAIL: Order creation failed with response:', jsonSent);
      throw new Error(`Failed with status ${statusSent}: ${JSON.stringify(jsonSent)}`);
    }
  } finally {
    const ord = await prisma.order.findFirst({ where: { orderNumber: testOrderNumber } });
    if (ord) {
      await prisma.orderStage.deleteMany({ where: { orderId: ord.id } });
      await prisma.auditLog.deleteMany({ where: { orderId: ord.id } });
      await prisma.routingHistory.deleteMany({ where: { orderId: ord.id } });
      await prisma.order.delete({ where: { id: ord.id } });
    }
    console.log('Cleaned up test order and child records.');
  }

  console.log('\n✓ All Faisal Order Entry tests passed!');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
