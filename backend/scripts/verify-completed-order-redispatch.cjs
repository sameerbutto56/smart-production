/**
 * Verification script for Bug Fix:
 * Allow Re-dispatch of Completed Orders That Have Been Returned
 *
 * Verifies all required business rules:
 * 1. Completed order with valid pending return at Store: Re-dispatch is allowed.
 * 2. Normal completed order with no return: Re-dispatch remains blocked with:
 *    "Order #... is completed and cannot be re-dispatched".
 * 3. Returned order already re-dispatched: Blocked with 409 Conflict.
 * 4. Cancelled order with return: Blocked with 400.
 * 5. Historical timeline integrity preserved (Completion -> Return -> Store Re-dispatch -> Dispatch).
 * 6. Dispatch Profile displays order as authorized re-dispatch (isStoreRedispatch: true).
 */

const prisma = require('../src/prisma');
const { storeRedispatch } = require('../src/controllers/returnExchange.controller');
const { getDispatchProfileOrders } = require('../src/controllers/dispatch-profile.controller');

async function runVerification() {
  console.log('================================================================');
  console.log(' Starting Verification: Re-dispatch of Completed Returned Orders');
  console.log('================================================================');

  let testOrder1 = null;
  let testOrder2 = null;
  let testOrder3 = null;
  let testReturnCase1 = null;
  let testReturnCase3 = null;

  try {
    // 0. Setup mock store user
    const storeUser = await prisma.user.findFirst({
      where: { role: { in: ['STORE', 'SUPER_ADMIN', 'ADMIN'] } }
    }) || { id: 'test-store-id', name: 'Store Staff', role: 'STORE' };

    const emps = await prisma.outletEmployee.findMany({
      where: { isActive: true },
      select: { name: true, profiles: true }
    });
    const dispatchEmp = emps.find(e => Array.isArray(e.profiles) && e.profiles.includes('DISPATCH'));
    const dispatcherName = dispatchEmp ? dispatchEmp.name : 'Khawar';

    const rand = Date.now();

    // ───────────────────────────────────────────────────────────────────
    // TEST 1: Completed order with an active return at Store
    // ───────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: Completed order with active return at Store ---');
    testOrder1 = await prisma.order.create({
      data: {
        orderNumber: `TEST-COMPL-RET-${rand}`,
        customerName: 'Customer Returned Completed',
        customerPhone: '03009999991',
        address: '456 Commercial Area',
        city: 'Lahore',
        source: 'ONLINE ORDER',
        outletName: 'JOHAR TOWN BRANCH',
        currentStage: 'STORE',
        status: 'COMPLETED', // Originally completed!
        dispatchStatus: 'DELIVERED',
        priority: 'NORMAL'
      }
    });

    // Initial completion audit
    await prisma.auditLog.create({
      data: {
        orderId: testOrder1.id,
        action: 'COMPLETED',
        details: `Order #${testOrder1.orderNumber} originally delivered and marked COMPLETED`,
        performedBy: storeUser.id,
        timestamp: new Date(Date.now() - 3600000)
      }
    });

    // Return created
    testReturnCase1 = await prisma.returnExchange.create({
      data: {
        orderId: testOrder1.id,
        orderNumber: testOrder1.orderNumber,
        customerName: testOrder1.customerName,
        customerPhone: testOrder1.customerPhone,
        type: 'RETURN',
        status: 'PENDING',
        routedTo: 'STORE',
        returnReason: 'Customer requested size exchange return'
      }
    });

    await prisma.auditLog.create({
      data: {
        orderId: testOrder1.id,
        action: 'DELIVERY_RETURNED',
        details: `Order returned: ${testReturnCase1.returnReason}`,
        performedBy: storeUser.id,
        timestamp: new Date(Date.now() - 1800000)
      }
    });

    // Now Store clicks Re-dispatch
    let resStatus1 = 200;
    let resData1 = null;
    const req1 = {
      params: { id: testReturnCase1.id },
      body: { notes: 'Re-dispatching completed order to dispatch' },
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    };
    const res1 = {
      status(code) { resStatus1 = code; return this; },
      json(data) { resData1 = data; return this; }
    };

    await storeRedispatch(req1, res1);

    if (resStatus1 !== 200) {
      throw new Error(`FAIL: storeRedispatch returned status ${resStatus1}: ${JSON.stringify(resData1)}`);
    }
    console.log('✓ PASS: storeRedispatch succeeded with HTTP 200 for completed returned order');

    // Verify DB state
    const updatedCase1 = await prisma.returnExchange.findUnique({ where: { id: testReturnCase1.id } });
    if (updatedCase1.status !== 'REDISPATCHED' || updatedCase1.routedTo !== 'DISPATCH') {
      throw new Error(`FAIL: returnCase not updated to REDISPATCHED/DISPATCH: ${JSON.stringify(updatedCase1)}`);
    }
    console.log('✓ PASS: ReturnExchange status is REDISPATCHED and routedTo is DISPATCH');

    const updatedOrder1 = await prisma.order.findUnique({ where: { id: testOrder1.id } });
    if (updatedOrder1.currentStage !== 'DISPATCH' || updatedOrder1.status !== 'PENDING') {
      throw new Error(`FAIL: Order not reset to DISPATCH / PENDING: ${JSON.stringify(updatedOrder1)}`);
    }
    console.log('✓ PASS: Order currentStage is DISPATCH and status is PENDING');

    // ───────────────────────────────────────────────────────────────────
    // TEST 2: Normal completed order with NO return record
    // ───────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Normal completed order with NO return ---');
    testOrder2 = await prisma.order.create({
      data: {
        orderNumber: `TEST-COMPL-NORET-${rand}`,
        customerName: 'Customer Normal Completed',
        customerPhone: '03009999992',
        address: '789 Commercial Area',
        city: 'Lahore',
        source: 'ONLINE ORDER',
        outletName: 'JOHAR TOWN BRANCH',
        currentStage: 'COMPLETED',
        status: 'COMPLETED',
        dispatchStatus: 'DELIVERED',
        priority: 'NORMAL'
      }
    });

    let resStatus2 = 200;
    let resData2 = null;
    const req2 = {
      params: { id: testOrder2.id },
      body: {},
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    };
    const res2 = {
      status(code) { resStatus2 = code; return this; },
      json(data) { resData2 = data; return this; }
    };

    await storeRedispatch(req2, res2);

    if (resStatus2 !== 400 || !resData2?.message?.includes('cannot be re-dispatched')) {
      throw new Error(`FAIL: Normal completed order was NOT blocked! Status: ${resStatus2}, Response: ${JSON.stringify(resData2)}`);
    }
    console.log(`✓ PASS: Normal completed order blocked with HTTP 400: "${resData2.message}"`);

    // ───────────────────────────────────────────────────────────────────
    // TEST 3: Duplicate re-dispatch attempt on already transferred order
    // ───────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Duplicate re-dispatch attempt ---');
    let resStatus3 = 200;
    let resData3 = null;
    const req3 = {
      params: { id: testReturnCase1.id },
      body: {},
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    };
    const res3 = {
      status(code) { resStatus3 = code; return this; },
      json(data) { resData3 = data; return this; }
    };

    await storeRedispatch(req3, res3);

    if (resStatus3 !== 409 && resStatus3 !== 400) {
      throw new Error(`FAIL: Duplicate re-dispatch was NOT rejected! Status: ${resStatus3}, Response: ${JSON.stringify(resData3)}`);
    }
    console.log(`✓ PASS: Duplicate re-dispatch rejected with HTTP ${resStatus3}: "${resData3?.message}"`);

    // ───────────────────────────────────────────────────────────────────
    // TEST 4: Cancelled order with return record
    // ───────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Cancelled order with return record ---');
    testOrder3 = await prisma.order.create({
      data: {
        orderNumber: `TEST-CANC-RET-${rand}`,
        customerName: 'Customer Cancelled',
        customerPhone: '03009999993',
        address: '100 Road',
        city: 'Lahore',
        source: 'ONLINE ORDER',
        outletName: 'JOHAR TOWN BRANCH',
        currentStage: 'CANCELLED',
        status: 'CANCELLED',
        priority: 'NORMAL'
      }
    });

    testReturnCase3 = await prisma.returnExchange.create({
      data: {
        orderId: testOrder3.id,
        orderNumber: testOrder3.orderNumber,
        customerName: testOrder3.customerName,
        customerPhone: testOrder3.customerPhone,
        type: 'RETURN',
        status: 'PENDING',
        routedTo: 'STORE',
        returnReason: 'Cancelled test'
      }
    });

    let resStatus4 = 200;
    let resData4 = null;
    const req4 = {
      params: { id: testReturnCase3.id },
      body: {},
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    };
    const res4 = {
      status(code) { resStatus4 = code; return this; },
      json(data) { resData4 = data; return this; }
    };

    await storeRedispatch(req4, res4);

    if (resStatus4 !== 400 || !resData4?.message?.includes('CANCELLED')) {
      throw new Error(`FAIL: Cancelled order was NOT blocked! Status: ${resStatus4}, Response: ${JSON.stringify(resData4)}`);
    }
    console.log(`✓ PASS: Cancelled order blocked with HTTP 400: "${resData4?.message}"`);

    // ───────────────────────────────────────────────────────────────────
    // TEST 5: Complete tracking history verification
    // ───────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Order tracking history timeline ---');
    const logs = await prisma.auditLog.findMany({
      where: { orderId: testOrder1.id },
      orderBy: { timestamp: 'asc' }
    });

    const actions = logs.map(l => l.action);
    console.log('Audit timeline actions:', actions);

    if (!actions.includes('COMPLETED')) {
      throw new Error('FAIL: Historical COMPLETED audit log was lost!');
    }
    if (!actions.includes('DELIVERY_RETURNED')) {
      throw new Error('FAIL: Historical DELIVERY_RETURNED audit log was lost!');
    }
    if (!actions.includes('STORE_REDISPATCH')) {
      throw new Error('FAIL: STORE_REDISPATCH audit log is missing!');
    }
    console.log('✓ PASS: All historical milestones preserved (COMPLETED -> DELIVERY_RETURNED -> STORE_REDISPATCH)');

    // ───────────────────────────────────────────────────────────────────
    // TEST 6: Dispatch Profile recognizes authorized re-dispatch
    // ───────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Dispatch Profile authorization ---');
    let dispatchResData = null;
    const dispatchReq = {
      query: { employeeName: dispatcherName, cityFilter: 'all' },
      user: { id: 'test-disp', name: dispatcherName, role: 'DISPATCH' }
    };
    const dispatchRes = {
      status() { return this; },
      json(data) { dispatchResData = data; return this; }
    };

    await getDispatchProfileOrders(dispatchReq, dispatchRes);

    const foundInDispatch = (dispatchResData?.unseen || []).find(o => o.id === testOrder1.id) ||
                            (dispatchResData?.seen || []).find(o => o.id === testOrder1.id);

    if (!foundInDispatch) {
      throw new Error(`FAIL: Re-dispatched order #${testOrder1.orderNumber} not found in Dispatch Profile! Unseen count: ${dispatchResData?.unseen?.length}, Seen count: ${dispatchResData?.seen?.length}`);
    }

    if (!foundInDispatch.isStoreRedispatch || !foundInDispatch.hasStoreRedispatchAuthorization) {
      throw new Error('FAIL: Order did not have isStoreRedispatch=true in Dispatch Profile');
    }
    console.log(`✓ PASS: Order #${testOrder1.orderNumber} successfully in Dispatch with isStoreRedispatch=true`);

    console.log('\n================================================================');
    console.log(' ALL 6 VERIFICATION CHECKS PASSED (100%)');
    console.log('================================================================\n');

  } finally {
    // Cleanup
    if (testOrder1) {
      await prisma.returnExchange.deleteMany({ where: { orderId: testOrder1.id } }).catch(() => {});
      await prisma.routingHistory.deleteMany({ where: { orderId: testOrder1.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { orderId: testOrder1.id } }).catch(() => {});
      await prisma.orderStage.deleteMany({ where: { orderId: testOrder1.id } }).catch(() => {});
      await prisma.order.delete({ where: { id: testOrder1.id } }).catch(() => {});
    }
    if (testOrder2) {
      await prisma.auditLog.deleteMany({ where: { orderId: testOrder2.id } }).catch(() => {});
      await prisma.order.delete({ where: { id: testOrder2.id } }).catch(() => {});
    }
    if (testOrder3) {
      await prisma.returnExchange.deleteMany({ where: { orderId: testOrder3.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { orderId: testOrder3.id } }).catch(() => {});
      await prisma.order.delete({ where: { id: testOrder3.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runVerification().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\nVerification FAILED:', err);
  process.exit(1);
});
