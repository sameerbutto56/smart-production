const prisma = require('../src/prisma');
const { getNextPrNumber } = require('../src/controllers/order.controller');

async function runTests() {
  console.log('=== RUNNING TESTS FOR STORE RETURN RESTOCK & PR ORDER GENERATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // TEST 1: PR Order Number Generation format
  console.log('\n--- 1. Testing PR Number Generation ---');
  const prNum1 = await getNextPrNumber();
  console.log('Generated PR Number 1:', prNum1);
  const now = new Date();
  const pktDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(now).replace(/-/g, '');
  assert(prNum1.startsWith(`PR-${pktDateStr}-`), `PR Number starts with PR-${pktDateStr}-`);
  assert(/^PR-\d{8}-\d{5}$/.test(prNum1), 'PR Number matches pattern PR-YYYYMMDD-XXXXX');

  // TEST 2: PR Order Creation & Sequential Increment
  console.log('\n--- 2. Testing PR Order Creation & Persistence ---');
  // Create an order with prNum1
  const testOrder1 = await prisma.order.create({
    data: {
      orderNumber: prNum1,
      customerName: 'Test PR Customer',
      customerPhone: '03001234567',
      address: 'Test Street, Lahore',
      city: 'Lahore',
      type: 'STANDARD',
      priority: 'NORMAL',
      totalPrice: 2500,
      shopifyOrderDate: new Date(),
      isPrOrder: true,
      currentStage: 'ORDER_ENTRY',
      status: 'PENDING'
    }
  });
  assert(testOrder1.id && testOrder1.orderNumber === prNum1, `Order created with PR number ${prNum1}`);
  assert(testOrder1.isPrOrder === true, 'Order has isPrOrder === true');

  // TEST 3: Sequential Next Number after DB creation
  console.log('\n--- 3. Testing Sequential Next Number ---');
  const prNum2 = await getNextPrNumber();
  console.log('Generated PR Number 2:', prNum2);
  const num1Seq = parseInt(prNum1.split('-')[2], 10);
  const num2Seq = parseInt(prNum2.split('-')[2], 10);
  assert(num2Seq === num1Seq + 1, `Next PR number sequential increment: ${num1Seq} -> ${num2Seq}`);

  // TEST 4: Store Return - Restocking Accepted Return with routedTo: INVENTORY_VIEW
  console.log('\n--- 4. Testing Store Return Restocking & Completion ---');
  // Find or create a test InventoryItem to verify stock increment
  let testInv = await prisma.inventoryItem.findFirst({
    where: { name: 'Test PR Scrubs' }
  });
  if (!testInv) {
    testInv = await prisma.inventoryItem.create({
      data: {
        name: 'Test PR Scrubs',
        category: 'SCRUBS',
        stock: 10,
        variants: [
          { color: 'Navy', size: 'M', stock: 5, price: 2000 },
          { color: 'Navy', size: 'L', stock: 5, price: 2000 }
        ]
      }
    });
  }

  const initialStockM = testInv.variants.find(v => v.size === 'M').stock;

  // Create a ReturnExchange record simulating Inventory View acceptance
  const testReturn = await prisma.returnExchange.create({
    data: {
      orderId: testOrder1.id,
      orderNumber: testOrder1.orderNumber,
      customerName: 'Test Return Customer',
      customerPhone: '03001234567',
      type: 'RETURN',
      status: 'ACCEPTED',
      routedTo: 'INVENTORY_VIEW', // Simulates Inventory View route
      originalProducts: [
        {
          name: 'Test PR Scrubs',
          productDetails: { name: 'Test PR Scrubs', color: 'Navy', size: 'M' },
          quantity: 2
        }
      ]
    }
  });
  assert(testReturn.id && testReturn.status === 'ACCEPTED', 'Return case created in ACCEPTED status');

  // Simulate processByStore controller logic directly
  const { processByStore, completeReturn } = require('../src/controllers/returnExchange.controller');

  // Find real user for FK constraints
  const realUser = await prisma.user.findFirst();
  const validUserId = realUser ? realUser.id : 'SYSTEM';

  let mockReq = {
    params: { id: testReturn.id },
    body: { action: 'restock', notes: 'Testing restock' },
    user: { id: validUserId, name: 'Store Manager', role: 'STORE' },
    app: { get: () => null }
  };
  let mockRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  };

  await processByStore(mockReq, mockRes);
  assert(mockRes.statusCode === 200, `processByStore succeeded (code ${mockRes.statusCode}) without 'not with the store' error`);

  // Verify DB record after restock
  const restockedReturn = await prisma.returnExchange.findUnique({ where: { id: testReturn.id } });
  assert(restockedReturn.status === 'RESTOCKED', 'Return status changed to RESTOCKED');
  assert(restockedReturn.routedTo === 'STORE', 'routedTo healed to STORE');
  assert(restockedReturn.originalRestocked === true, 'originalRestocked marked true');

  // Verify inventory incremented
  const updatedInv = await prisma.inventoryItem.findUnique({ where: { id: testInv.id } });
  const updatedStockM = updatedInv.variants.find(v => v.size === 'M').stock;
  assert(updatedStockM === initialStockM + 2, `Inventory variant M stock incremented by 2: ${initialStockM} -> ${updatedStockM}`);

  // TEST 5: Double restock block
  console.log('\n--- 5. Testing Double Restock Prevention ---');
  let doubleRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  };
  await processByStore(mockReq, doubleRes);
  assert(doubleRes.statusCode === 400, 'Double restock is rejected with 400');

  // TEST 6: Complete Return
  console.log('\n--- 6. Testing Complete Return ---');
  let completeReq = {
    params: { id: testReturn.id },
    user: { id: validUserId, name: 'Store Manager', role: 'STORE' },
    app: { get: () => null }
  };
  let completeRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  };
  await completeReturn(completeReq, completeRes);
  console.log('completeRes:', completeRes.statusCode, completeRes.data);
  assert(completeRes.statusCode === 200, 'completeReturn succeeded with code 200');

  const completedReturn = await prisma.returnExchange.findUnique({ where: { id: testReturn.id } });
  console.log('completedReturn:', completedReturn?.status, completedReturn?.completedBy);
  assert(completedReturn.status === 'COMPLETED', 'Return status marked COMPLETED');
  assert(completedReturn.completedBy === 'Store Manager', 'completedBy recorded');

  // CLEANUP
  console.log('\n--- 7. Cleanup Test Records ---');
  await prisma.auditLog.deleteMany({ where: { orderId: testOrder1.id } });
  await prisma.returnExchange.delete({ where: { id: testReturn.id } });
  await prisma.order.delete({ where: { id: testOrder1.id } });
  await prisma.inventoryItem.delete({ where: { id: testInv.id } });
  console.log('Test records cleaned up.');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
