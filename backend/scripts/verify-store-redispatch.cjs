/**
 * Verification script for Store Profile -> Returns: Re-dispatch to Dispatch Profile.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/prisma');

async function runVerification() {
  console.log('--- Starting Store Returns Re-dispatch Verification ---');

  // Find a store employee or admin user for testing
  let storeUser = await prisma.user.findFirst({
    where: { role: { in: ['STORE', 'SUPER_ADMIN', 'ADMIN'] } }
  });
  if (!storeUser) {
    throw new Error('No Store/Admin user found');
  }
  console.log(`Using Store User: ${storeUser.name} (${storeUser.role})`);

  // Find a dispatch employee
  const employees = await prisma.outletEmployee.findMany({
    where: { isActive: true },
    select: { name: true, profiles: true }
  });
  const dispatchEmp = employees.find(e => Array.isArray(e.profiles) && e.profiles.includes('DISPATCH'));
  console.log(`Using Active Dispatcher: ${dispatchEmp?.name || 'Khawar'}`);

  // Create a test order and returned case
  const testOrderNumber = `TEST-RET-${Date.now()}`;
  const testOrder = await prisma.order.create({
    data: {
      orderNumber: testOrderNumber,
      customerName: 'Test Customer Return',
      customerPhone: '03001234567',
      address: '123 Test Street',
      city: 'Lahore',
      source: 'ONLINE ORDER',
      totalPrice: 4500,
      currentStage: 'STORE',
      status: 'PENDING',
      dispatchStatus: 'RETURNED',
      productDetails: [{ name: 'Scrub Set', color: 'Navy Blue', size: 'M', quantity: 1, totalPrice: 4500 }]
    }
  });
  console.log(`Created test order #${testOrder.orderNumber} (ID: ${testOrder.id})`);

  // Create initial Store stage
  await prisma.orderStage.create({
    data: {
      orderId: testOrder.id,
      stageName: 'STORE',
      status: 'PENDING',
      deadlineAt: new Date(Date.now() + 86400000)
    }
  });

  // Create ReturnExchange record routed to STORE
  const testCase = await prisma.returnExchange.create({
    data: {
      orderId: testOrder.id,
      orderNumber: testOrder.orderNumber,
      customerName: testOrder.customerName,
      customerPhone: testOrder.customerPhone,
      type: 'RETURN',
      status: 'PENDING',
      routedTo: 'STORE',
      returnReason: 'Customer requested size exchange or reconsideration',
      returnSource: 'ENAMELS_DELIVERY_BOY',
      deliveryReturnedBy: 'Ali Rider',
      deliveryReturnedAt: new Date(),
      originalProducts: testOrder.productDetails
    }
  });
  console.log(`Created test ReturnExchange case #${testCase.id} (Status: PENDING, RoutedTo: STORE)`);

  // Test 1: Invoke storeRedispatch controller function
  const { storeRedispatch } = require('../src/controllers/returnExchange.controller');
  const req = {
    params: { id: testCase.id },
    body: { notes: 'Re-dispatch requested by Store: Customer confirmed ready to receive' },
    user: storeUser,
    app: { get: () => null }
  };
  let responseData = null;
  let responseStatus = 200;
  const res = {
    status: (s) => {
      responseStatus = s;
      return { json: (d) => { responseData = d; } };
    },
    json: (d) => { responseData = d; }
  };

  await storeRedispatch(req, res);
  console.log(`storeRedispatch status: ${responseStatus}`, responseData);
  if (responseStatus !== 200 || !responseData?.success) {
    throw new Error(`storeRedispatch failed: ${JSON.stringify(responseData)}`);
  }
  console.log('✓ Check 1 Passed: storeRedispatch returned success 200');

  // Test 2: Verify database records
  const updatedCase = await prisma.returnExchange.findUnique({ where: { id: testCase.id } });
  if (updatedCase.status !== 'REDISPATCHED' || updatedCase.routedTo !== 'DISPATCH') {
    throw new Error(`Expected ReturnExchange status REDISPATCHED and routedTo DISPATCH, got ${updatedCase.status}, ${updatedCase.routedTo}`);
  }
  console.log('✓ Check 2 Passed: ReturnExchange record status is REDISPATCHED and routedTo is DISPATCH');

  const updatedOrder = await prisma.order.findUnique({
    where: { id: testOrder.id },
    include: { stages: { orderBy: { createdAt: 'desc' } } }
  });
  if (updatedOrder.currentStage !== 'DISPATCH' || updatedOrder.status !== 'PENDING' || updatedOrder.dispatchOfficer !== null) {
    throw new Error(`Order state invalid: stage=${updatedOrder.currentStage}, status=${updatedOrder.status}, officer=${updatedOrder.dispatchOfficer}`);
  }
  console.log('✓ Check 3 Passed: Order currentStage is DISPATCH, status is PENDING, dispatchOfficer is null');

  const activeDispatchStage = updatedOrder.stages.find(s => s.stageName === 'DISPATCH' && s.status === 'PENDING');
  if (!activeDispatchStage) {
    throw new Error('No active PENDING DISPATCH stage found');
  }
  console.log(`✓ Check 4 Passed: Active DISPATCH stage created with deadline: ${activeDispatchStage.deadlineAt}`);

  // Test 3: Verify AuditLog and RoutingHistory
  const audit = await prisma.auditLog.findFirst({
    where: { orderId: testOrder.id, action: 'STORE_REDISPATCH' },
    orderBy: { timestamp: 'desc' }
  });
  if (!audit) throw new Error('No STORE_REDISPATCH audit log found');
  console.log(`✓ Check 5 Passed: Audit log recorded: "${audit.details}"`);

  const route = await prisma.routingHistory.findFirst({
    where: { orderId: testOrder.id, sentToStage: 'DISPATCH' },
    orderBy: { createdAt: 'desc' }
  });
  if (!route || route.previousStage !== 'STORE') throw new Error('No STORE -> DISPATCH routing history found');
  console.log(`✓ Check 6 Passed: Routing history recorded: previous=${route.previousStage}, new=${route.newStage}, remarks="${route.remarks}"`);

  // Test 4: Concurrency / double-dispatch prevention
  let secondCallStatus = 200;
  let secondCallData = null;
  const res2 = {
    status: (s) => {
      secondCallStatus = s;
      return { json: (d) => { secondCallData = d; } };
    },
    json: (d) => { secondCallData = d; }
  };
  await storeRedispatch(req, res2);
  if (secondCallStatus !== 400 && secondCallStatus !== 409) {
    throw new Error(`Expected duplicate re-dispatch to be rejected with 400 or 409, got ${secondCallStatus}`);
  }
  console.log(`✓ Check 7 Passed: Duplicate re-dispatch properly rejected (${secondCallStatus}: ${secondCallData?.message})`);

  // Test 5: Verify Dispatch Profile query
  const { getDispatchProfileOrders, acceptDispatchOrder } = require('../src/controllers/dispatch-profile.controller');
  const dReq = {
    query: { employeeName: dispatchEmp?.name || 'Khawar' },
    user: { id: 'test-disp', name: dispatchEmp?.name || 'Khawar', role: 'DISPATCH' }
  };
  let dData = null;
  const dRes = {
    status: (s) => ({ json: (d) => { dData = d; } }),
    json: (d) => { dData = d; }
  };
  await getDispatchProfileOrders(dReq, dRes);
  const unseenOrder = dData?.unseen?.find(o => o.id === testOrder.id);
  if (!unseenOrder) {
    throw new Error(`Test order #${testOrder.orderNumber} not found in Dispatch unseen queue!`);
  }
  if (!unseenOrder.returnExchangeCases || unseenOrder.returnExchangeCases.length === 0) {
    throw new Error('unseenOrder missing returnExchangeCases metadata');
  }
  console.log(`✓ Check 8 Passed: Order appears in Dispatch Unseen queue with return info: "${unseenOrder.returnExchangeCases[0].returnReason}"`);

  // Test 6: Verify Dispatcher can accept the re-dispatched order
  const acceptReq = {
    params: { orderId: testOrder.id },
    body: { employeeName: dispatchEmp?.name || 'Khawar' },
    user: { id: 'test-disp', name: dispatchEmp?.name || 'Khawar', role: 'DISPATCH' },
    app: { get: () => null }
  };
  let acceptData = null;
  const acceptRes = {
    status: (s) => ({ json: (d) => { acceptData = d; } }),
    json: (d) => { acceptData = d; }
  };
  await acceptDispatchOrder(acceptReq, acceptRes);
  const acceptedOrder = await prisma.order.findUnique({
    where: { id: testOrder.id },
    include: { stages: { where: { stageName: 'DISPATCH' } } }
  });
  if (acceptedOrder.dispatchOfficer !== (dispatchEmp?.name || 'Khawar') || acceptedOrder.stages[0].status !== 'IN_PROGRESS') {
    throw new Error(`Accept failed: officer=${acceptedOrder.dispatchOfficer}, stageStatus=${acceptedOrder.stages[0]?.status}`);
  }
  console.log(`✓ Check 9 Passed: Dispatcher ${acceptedOrder.dispatchOfficer} accepted order, DISPATCH stage transitioned to IN_PROGRESS`);

  // Cleanup test order
  await prisma.auditLog.deleteMany({ where: { orderId: testOrder.id } });
  await prisma.routingHistory.deleteMany({ where: { orderId: testOrder.id } });
  await prisma.orderStage.deleteMany({ where: { orderId: testOrder.id } });
  await prisma.returnExchange.deleteMany({ where: { orderId: testOrder.id } });
  await prisma.order.delete({ where: { id: testOrder.id } });
  console.log('✓ Cleaned up test data');

  console.log('\n=== ALL 9 VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
}

runVerification()
  .catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
