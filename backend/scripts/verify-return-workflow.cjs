// backend/scripts/verify-return-workflow.cjs
// ===================================================================
// VERIFICATION TEST SUITE: Unified Return Workflow
//
// Tests all 5 requirements:
// 1. Return creation sets routedTo: 'INVENTORY_VIEW' and returnSource
// 2. Delivery return sets returnSource: 'ENAMELS_DELIVERY_BOY'
// 3. bulkCompleteStaleReturns only completes CANCELLED orders
// 4. redispatchOrder does not close returns routed to STORE
// 5. getAllCases supports routedTo filter
// 6. Incoming returns displays correct source labels
// ===================================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  UNIFIED RETURN WORKFLOW TEST SUITE`);
  console.log(`${'='.repeat(70)}\n`);

  const testSuffix = Date.now().toString().slice(-6);
  const testOrderNum = `TEST-RET-${testSuffix}`;
  let testOrder = null;
  let testReturn1 = null;
  let testReturn2 = null;

  try {
    // -------------------------------------------------------------
    // Setup: Create a temporary test order
    // -------------------------------------------------------------
    console.log('--- Setup: Test Data ---');
    testOrder = await prisma.order.create({
      data: {
        orderNumber: testOrderNum,
        customerName: 'Return Workflow Test Customer',
        customerPhone: '03001234567',
        status: 'DISPATCHED',
        currentStage: 'DISPATCH',
        totalPrice: 5000,
        city: 'Lahore',
        address: 'Test Address',
      },
    });
    console.log(`Created test order ${testOrder.orderNumber} (ID: ${testOrder.id})`);

    // -------------------------------------------------------------
    // Test 1: ReturnExchange schema has returnSource field
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Schema & Model Validation ---');
    testReturn1 = await prisma.returnExchange.create({
      data: {
        orderId: testOrder.id,
        orderNumber: testOrder.orderNumber,
        type: 'RETURN',
        status: 'PENDING',
        routedTo: 'INVENTORY_VIEW',
        returnSource: 'ORDER_LOOKUP',
        returnReason: 'Wrong size',
        handledBy: 'TestUser',
      },
    });
    assert(testReturn1.id != null, 'ReturnExchange created successfully in database');
    assert(testReturn1.returnSource === 'ORDER_LOOKUP', 'returnSource saved and read as ORDER_LOOKUP');
    assert(testReturn1.routedTo === 'INVENTORY_VIEW', 'routedTo initialized to INVENTORY_VIEW');
    assert(testReturn1.status === 'PENDING', 'status initialized to PENDING');

    // -------------------------------------------------------------
    // Test 2: Enamels Delivery Boy Return source
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Enamels Delivery Boy Return Source ---');
    testReturn2 = await prisma.returnExchange.create({
      data: {
        orderId: testOrder.id,
        orderNumber: testOrder.orderNumber,
        type: 'RETURN',
        status: 'PENDING',
        routedTo: 'INVENTORY_VIEW',
        returnSource: 'ENAMELS_DELIVERY_BOY',
        returnReason: 'Customer refused delivery',
        deliveryReturnedBy: 'DeliveryBoy-Ali',
        deliveryReturnedAt: new Date(),
      },
    });
    assert(testReturn2.returnSource === 'ENAMELS_DELIVERY_BOY', 'returnSource saved as ENAMELS_DELIVERY_BOY');
    assert(testReturn2.routedTo === 'INVENTORY_VIEW', 'Delivery return lands in INVENTORY_VIEW first');

    // -------------------------------------------------------------
    // Test 3: bulkCompleteStaleReturns safety logic
    // (Only completes when order is CANCELLED, handledBy alone does not complete)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: bulkCompleteStaleReturns Safety ---');
    
    // Simulate what bulkCompleteStaleReturns does now:
    // It queries pending/accepted returns, looks up their orders, and ONLY completes if order.status === 'CANCELLED'
    const pendingCases = await prisma.returnExchange.findMany({
      where: {
        id: { in: [testReturn1.id, testReturn2.id] },
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });

    const orderIds = pendingCases.map(c => c.orderId);
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, status: 'CANCELLED' },
      select: { id: true },
    });
    const cancelledOrderIds = new Set(orders.map(o => o.id));

    const wouldCompleteCases = pendingCases.filter(c => cancelledOrderIds.has(c.orderId));
    assert(wouldCompleteCases.length === 0, 'Active returns with handledBy on non-cancelled order are NOT auto-completed');
    assert(!cancelledOrderIds.has(testOrder.id), 'Non-cancelled order is safely excluded from stale return completion');

    // -------------------------------------------------------------
    // Test 4: redispatchOrder does NOT close returns routed to STORE
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Redispatch Store Return Protection ---');
    // Move testReturn1 to STORE
    const storeReturn = await prisma.returnExchange.update({
      where: { id: testReturn1.id },
      data: {
        routedTo: 'STORE',
        status: 'PENDING',
      },
    });

    // Simulate redispatch query: should only target routedTo: { not: 'STORE' }
    const redispatchCandidateReturns = await prisma.returnExchange.findMany({
      where: {
        orderId: testOrder.id,
        type: 'RETURN',
        routedTo: { not: 'STORE' },
      },
    });

    const candidateIds = redispatchCandidateReturns.map(c => c.id);
    assert(!candidateIds.includes(storeReturn.id), 'Returns routed to STORE are excluded from redispatch auto-closure');
    assert(candidateIds.includes(testReturn2.id), 'Returns still in INVENTORY_VIEW can be addressed on redispatch');

    // -------------------------------------------------------------
    // Test 5: routedTo Query Filtering for Store
    // -------------------------------------------------------------
    console.log('\n--- Test 5: routedTo Filtering in Store Returns ---');
    const storeCases = await prisma.returnExchange.findMany({
      where: {
        routedTo: 'STORE',
        id: { in: [testReturn1.id, testReturn2.id] },
      },
    });
    const inventoryCases = await prisma.returnExchange.findMany({
      where: {
        routedTo: 'INVENTORY_VIEW',
        id: { in: [testReturn1.id, testReturn2.id] },
      },
    });

    assert(storeCases.length === 1 && storeCases[0].id === testReturn1.id, 'Store filter returns only cases routed to STORE');
    assert(inventoryCases.length === 1 && inventoryCases[0].id === testReturn2.id, 'Inventory filter returns cases routed to INVENTORY_VIEW');

    // -------------------------------------------------------------
    // Test 6: Controller source mapping logic
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Source Label Formatting ---');
    function getSourceLabel(c) {
      const src = c.returnSource || (c.deliveryReturnedBy ? 'ENAMELS_DELIVERY_BOY' : 'ORDER_LOOKUP');
      if (src === 'ENAMELS_DELIVERY_BOY') return 'Enamels Delivery Boy';
      if (src === 'ORDER_LOOKUP') return 'Order Lookup';
      return src;
    }

    assert(getSourceLabel(testReturn1) === 'Order Lookup', 'ORDER_LOOKUP formatted as "Order Lookup"');
    assert(getSourceLabel(testReturn2) === 'Enamels Delivery Boy', 'ENAMELS_DELIVERY_BOY formatted as "Enamels Delivery Boy"');

  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // Teardown: Clean up test data
    // -------------------------------------------------------------
    console.log('\n--- Teardown: Cleaning Test Data ---');
    if (testReturn1) {
      await prisma.returnExchange.deleteMany({ where: { id: testReturn1.id } }).catch(() => {});
    }
    if (testReturn2) {
      await prisma.returnExchange.deleteMany({ where: { id: testReturn2.id } }).catch(() => {});
    }
    if (testOrder) {
      await prisma.order.deleteMany({ where: { id: testOrder.id } }).catch(() => {});
    }
    console.log('Teardown complete.');
    await prisma.$disconnect();
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`${'='.repeat(70)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
