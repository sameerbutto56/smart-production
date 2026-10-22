/**
 * Automated Verification Script:
 * Production Out -> Store Receive -> Dispatch Workflow Performance & Stage Integrity
 */

const prisma = require('../src/prisma');
const { getDispatchDashboard, dispatchFromProfile, invalidateDispatchDashboardCache } = require('../src/controllers/dispatch-profile.controller');
const { bookCourier } = require('../src/controllers/dispatch.controller');

let testPassed = 0;
let testFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testFailed++;
  }
}

async function runTests() {
  console.log('=== TEST SUITE: Production Out to Dispatch Optimization & Stage Integrity ===\n');

  // Test 1: getDispatchDashboard performance and caching
  console.log('Test 1: Verify getDispatchDashboard performance and cache hit');
  invalidateDispatchDashboardCache();

  let dashboardData1 = null;
  const mockReq1 = { query: {} };
  const mockRes1 = {
    json: (data) => { dashboardData1 = data; return mockRes1; },
    status: (code) => mockRes1
  };

  const start1 = Date.now();
  await getDispatchDashboard(mockReq1, mockRes1);
  const duration1 = Date.now() - start1;

  assert(dashboardData1 !== null, 'Dashboard returned valid data payload');
  assert(dashboardData1.summary !== undefined, 'Dashboard contains summary');
  assert(dashboardData1.trackingData !== undefined, 'Dashboard contains trackingData');
  assert(duration1 < 6000, `Cold dashboard query finished in ${duration1}ms (< 6000ms)`);

  // Cache hit test
  const start2 = Date.now();
  let dashboardData2 = null;
  const mockRes2 = {
    json: (data) => { dashboardData2 = data; return mockRes2; },
    status: (code) => mockRes2
  };
  await getDispatchDashboard(mockReq1, mockRes2);
  const duration2 = Date.now() - start2;
  assert(duration2 < 50, `Cached dashboard response returned in ${duration2}ms (< 50ms)`);
  assert(dashboardData2 === dashboardData1, 'Cached dashboard payload is identical');

  // Test 2: Create a simulated order through Production Out -> Store Receive -> Dispatch
  console.log('\nTest 2: Simulate Production Out -> Store Receive -> Dispatch');
  const testOrderNumber = `TEST-${Date.now()}`;
  const testOrder = await prisma.order.create({
    data: {
      orderNumber: testOrderNumber,
      customerName: 'Test Production Out Customer',
      customerPhone: '03009999999',
      city: 'Lahore',
      currentStage: 'DISPATCH',
      status: 'PENDING',
      dispatchStatus: 'PENDING',
      dispatchOfficer: null, // As routed from Store Receive
      stages: {
        create: [
          { stageName: 'PRODUCTION', status: 'COMPLETED', completedAt: new Date() },
          { stageName: 'STORE_RECEIVE', status: 'COMPLETED', completedAt: new Date() },
          { stageName: 'DISPATCH', status: 'PENDING' }
        ]
      }
    },
    include: { stages: { orderBy: { createdAt: 'asc' } } }
  });

  assert(testOrder.id !== undefined, `Created test order #${testOrderNumber} at DISPATCH with dispatchOfficer = null`);
  const initialDispatchStage = testOrder.stages.find(s => s.stageName === 'DISPATCH');
  assert(initialDispatchStage && initialDispatchStage.status === 'PENDING', 'Initial DISPATCH stage is PENDING');

  // Test 3: Dispatch order directly from profile without prior explicit accept (testing dispatchOfficer { in: [null, employeeName] })
  console.log('\nTest 3: Dispatch unassigned order directly via dispatchFromProfile');
  const adminUser = await prisma.user.findFirst({ select: { id: true, name: true } });
  let dispatchResponse = null;
  let dispatchStatusCode = 200;
  const mockDispatchReq = {
    params: { orderId: testOrder.id },
    body: { employeeName: 'Faisal', dispatchMethod: 'TCS', trackingUrl: 'TCS123456789' },
    user: adminUser || { id: 'test-user', name: 'Faisal' }
  };
  const mockDispatchRes = {
    status: (code) => { dispatchStatusCode = code; return mockDispatchRes; },
    json: (data) => { dispatchResponse = data; return mockDispatchRes; }
  };

  const dispatchStart = Date.now();
  await dispatchFromProfile(mockDispatchReq, mockDispatchRes);
  const dispatchDuration = Date.now() - dispatchStart;

  assert(dispatchStatusCode === 200, `dispatchFromProfile returned status 200 (took ${dispatchDuration}ms)`);
  assert(dispatchResponse && dispatchResponse.message && dispatchResponse.message.includes('dispatched'), 'Received success message');

  // Verify order in database
  const updatedOrder = await prisma.order.findUnique({
    where: { id: testOrder.id },
    include: { stages: { orderBy: { createdAt: 'asc' } } }
  });

  assert(updatedOrder.currentStage === 'OUT_FOR_DELIVERY', 'Order advanced to OUT_FOR_DELIVERY');
  assert(updatedOrder.dispatchOfficer === 'Faisal', 'Order claimed and assigned to Faisal');
  assert(updatedOrder.trackingNumber === 'TCS123456789', 'Tracking number saved');
  assert(updatedOrder.deliveryType === 'TCS', 'Delivery type mapped to TCS');

  const dispatchStageAfter = updatedOrder.stages.find(s => s.stageName === 'DISPATCH');
  assert(dispatchStageAfter && dispatchStageAfter.status === 'COMPLETED', 'DISPATCH stage marked COMPLETED');

  const outForDeliveryStage = updatedOrder.stages.find(s => s.stageName === 'OUT_FOR_DELIVERY');
  assert(outForDeliveryStage && outForDeliveryStage.status === 'PENDING', 'OUT_FOR_DELIVERY stage created as PENDING');

  // Test 4: Duplicate dispatch protection
  console.log('\nTest 4: Duplicate dispatch attempt rejected with 409');
  let dupStatus = 200;
  let dupResponse = null;
  const mockDupRes = {
    status: (code) => { dupStatus = code; return mockDupRes; },
    json: (data) => { dupResponse = data; return mockDupRes; }
  };
  await dispatchFromProfile(mockDispatchReq, mockDupRes);
  assert(dupStatus === 400 || dupStatus === 409, `Duplicate dispatch rejected with status ${dupStatus}`);

  // Test 5: Verify bookCourier completes DISPATCH stage
  console.log('\nTest 5: bookCourier marks DISPATCH stage COMPLETED');
  const testOrder2 = await prisma.order.create({
    data: {
      orderNumber: `${testOrderNumber}-2`,
      customerName: 'Test Courier Book Customer',
      city: 'Karachi',
      currentStage: 'DISPATCH',
      status: 'PENDING',
      dispatchStatus: 'PENDING',
      stages: {
        create: [
          { stageName: 'STORE_RECEIVE', status: 'COMPLETED', completedAt: new Date() },
          { stageName: 'DISPATCH', status: 'IN_PROGRESS' }
        ]
      }
    }
  });

  let bookStatus = 200;
  const mockBookReq = {
    params: { orderId: testOrder2.id },
    body: { courierName: 'PostEx', trackingNumber: 'POSTEX-999' },
    user: adminUser || { id: 'test-admin', name: 'Admin User' }
  };
  const mockBookRes = {
    status: (code) => { bookStatus = code; return mockBookRes; },
    json: () => mockBookRes
  };
  await bookCourier(mockBookReq, mockBookRes);

  const order2After = await prisma.order.findUnique({
    where: { id: testOrder2.id },
    include: { stages: { orderBy: { createdAt: 'asc' } } }
  });

  assert(order2After.currentStage === 'OUT_FOR_DELIVERY', 'Order 2 moved to OUT_FOR_DELIVERY');
  const o2DispatchStage = order2After.stages.find(s => s.stageName === 'DISPATCH');
  assert(o2DispatchStage && o2DispatchStage.status === 'COMPLETED', 'Order 2 DISPATCH stage marked COMPLETED');

  // Cleanup test data
  await prisma.orderStage.deleteMany({ where: { orderId: { in: [testOrder.id, testOrder2.id] } } });
  await prisma.dispatchLog.deleteMany({ where: { orderId: { in: [testOrder.id, testOrder2.id] } } });
  await prisma.auditLog.deleteMany({ where: { orderId: { in: [testOrder.id, testOrder2.id] } } });
  await prisma.order.deleteMany({ where: { id: { in: [testOrder.id, testOrder2.id] } } });
  console.log('\nCleaned up test orders.');

  console.log(`\n=== RESULTS: ${testPassed} Passed, ${testFailed} Failed ===\n`);
  if (testFailed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
