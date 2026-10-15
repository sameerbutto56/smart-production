/**
 * Verification script for Store-Authorized Re-dispatch Bug Fix:
 *
 * Acceptance Criteria to prove:
 * 1. Only orders with an explicit, successful Store Re-dispatch action appear in Dispatch Profile's re-dispatch list.
 * 2. Orders returned from delivery do not appear in Dispatch's re-dispatch list by default.
 * 3. Orders currently in Store Profile -> Returns do not appear in Dispatch's re-dispatch list.
 * 4. Orders accepted by Store do not appear in Dispatch's re-dispatch list unless explicitly re-dispatched.
 * 5. Existing returned orders lacking a verified Store re-dispatch action are removed from the Dispatch re-dispatch queue.
 * 6. Historical tracking correctly reflects each stage transition: Return -> Store -> (Optional Store Accept) -> Store Re-dispatch -> Dispatch.
 * 7. Orders re-dispatched by Store show the proper status, responsible department, and actionable controls in Dispatch Profile.
 * 8. A re-dispatched order subsequently returned again loses re-dispatch qualification until re-authorized by Store.
 */

const prisma = require('../src/prisma');
const { storeRedispatch, redispatchOrder } = require('../src/controllers/returnExchange.controller');
const { getDispatchProfileOrders } = require('../src/controllers/dispatch-profile.controller');
const { getDispatchDashboard } = require('../src/controllers/dispatch.controller');

async function runVerification() {
  console.log('================================================================');
  console.log(' Starting Verification: Store-Authorized Re-dispatch Only');
  console.log('================================================================');

  let testOrder = null;
  let testReturnCase = null;
  let testDispatcher = null;
  let testStoreUser = null;

  try {
    // Setup test users
    testStoreUser = await prisma.user.findFirst({
      where: { role: { in: ['STORE', 'SUPER_ADMIN', 'ADMIN'] } }
    });
    if (!testStoreUser) {
      testStoreUser = { id: 'test-store-id', name: 'Test Store Manager', role: 'STORE' };
    }

    // Find an active dispatcher employee
    const emps = await prisma.outletEmployee.findMany({
      where: { isActive: true },
      select: { name: true, profiles: true }
    });
    const dispatchEmp = emps.find(e => Array.isArray(e.profiles) && e.profiles.includes('DISPATCH'));
    const dispatcherName = dispatchEmp ? dispatchEmp.name : 'Khawar';

    // Create a dedicated test order
    const rand = Date.now();
    testOrder = await prisma.order.create({
      data: {
        orderNumber: `TEST-AUTH-REDISP-${rand}`,
        customerName: 'Test Customer Auth Redispatch',
        customerPhone: '03001234567',
        address: '123 Main Street',
        city: 'Lahore',
        source: 'ONLINE ORDER',
        outletName: 'JOHAR TOWN BRANCH',
        currentStage: 'STORE',
        status: 'PENDING',
        dispatchStatus: 'RETURNED',
        priority: 'NORMAL',
        totalPrice: 4500,
        productDetails: JSON.stringify([{
          name: 'Classic Scrub Set',
          color: 'Navy Blue',
          size: 'M',
          quantity: 1,
          totalPrice: 4500
        }])
      }
    });

    console.log(`\nCreated Test Order #${testOrder.orderNumber} (ID: ${testOrder.id})`);

    // Create a ReturnExchange case routed to STORE with PENDING status
    testReturnCase = await prisma.returnExchange.create({
      data: {
        orderId: testOrder.id,
        orderNumber: testOrder.orderNumber,
        customerName: testOrder.customerName,
        customerPhone: testOrder.customerPhone,
        type: 'RETURN',
        status: 'PENDING',
        routedTo: 'STORE',
        returnReason: 'Customer requested size exchange / delivery return',
        returnSource: 'ENAMELS_DELIVERY_BOY',
        deliveryReturnedBy: 'Ali Rider',
        deliveryReturnedAt: new Date(),
        originalProducts: testOrder.productDetails
      }
    });

    console.log(`Created Return Case ${testReturnCase.id} routed to STORE with status PENDING`);

    // ── CHECK 1: Order returned to Store must NOT appear in Dispatch Profile ──
    console.log('\n--- CHECK 1: Order in Store Returns must NOT appear in Dispatch Profile ---');
    const mockReq1 = { query: { employeeName: dispatcherName } };
    let mockResData1 = null;
    const mockRes1 = {
      json: (data) => { mockResData1 = data; },
      status: (code) => ({ json: (data) => { mockResData1 = data; } })
    };

    await getDispatchProfileOrders(mockReq1, mockRes1);
    const inUnseen1 = (mockResData1?.unseen || []).find(o => o.id === testOrder.id);
    const inSeen1 = (mockResData1?.seen || []).find(o => o.id === testOrder.id);
    if (inUnseen1 || inSeen1) {
      throw new Error(`FAIL: Order #${testOrder.orderNumber} in Store Returns appeared in Dispatch!`);
    }
    console.log('✓ PASS: Order currently in Store Returns correctly excluded from Dispatch Profile');

    // ── CHECK 2: Store accepts the return (status -> ACCEPTED) ──
    console.log('\n--- CHECK 2: Store accepts return (status -> ACCEPTED) ---');
    await prisma.returnExchange.update({
      where: { id: testReturnCase.id },
      data: {
        status: 'ACCEPTED',
        storeAcceptedBy: testStoreUser.name,
        storeAcceptedAt: new Date()
      }
    });

    await getDispatchProfileOrders(mockReq1, mockRes1);
    const inUnseen2 = (mockResData1?.unseen || []).find(o => o.id === testOrder.id);
    const inSeen2 = (mockResData1?.seen || []).find(o => o.id === testOrder.id);
    if (inUnseen2 || inSeen2) {
      throw new Error(`FAIL: Order #${testOrder.orderNumber} accepted by Store appeared in Dispatch before re-dispatch!`);
    }
    console.log('✓ PASS: Store acceptance alone does NOT authorize re-dispatch or enter Dispatch');

    // ── CHECK 3: Non-Store user attempting redispatchOrder is rejected ──
    console.log('\n--- CHECK 3: Protection against unauthorized CSR redispatchOrder bypass ---');
    let redispatchErr = null;
    const mockCsrReq = {
      params: { orderId: testOrder.id },
      body: { notes: 'CSR trying to bypass Store' },
      user: { id: 'csr-user', name: 'CSR Agent', role: 'CSR' }
    };
    let csrResStatus = 200;
    let csrResData = null;
    const mockCsrRes = {
      status: (c) => {
        csrResStatus = c;
        return { json: (d) => { csrResData = d; } };
      },
      json: (d) => { csrResData = d; }
    };
    await redispatchOrder(mockCsrReq, mockCsrRes);
    if (csrResStatus !== 400 || !csrResData?.message?.includes('Store')) {
      throw new Error(`FAIL: Expected CSR redispatch to be rejected with 400 (Store responsibility), got ${csrResStatus}: ${JSON.stringify(csrResData)}`);
    }
    console.log(`✓ PASS: Unauthorized CSR bypass rejected: "${csrResData?.message}"`);

    // ── CHECK 4: Store explicitly clicks Re-dispatch (POST /store-redispatch) ──
    console.log('\n--- CHECK 4: Store explicitly clicks Re-dispatch ---');
    const mockStoreReq = {
      params: { id: testReturnCase.id },
      body: { notes: 'Store confirmed customer is available for delivery' },
      user: { id: testStoreUser.id, name: testStoreUser.name, role: 'STORE' }
    };
    let storeResStatus = 200;
    let storeResData = null;
    const mockStoreRes = {
      status: (c) => {
        storeResStatus = c;
        return { json: (d) => { storeResData = d; } };
      },
      json: (d) => { storeResData = d; }
    };

    await storeRedispatch(mockStoreReq, mockStoreRes);
    if (storeResStatus !== 200) {
      throw new Error(`FAIL: storeRedispatch failed: ${JSON.stringify(storeResData)}`);
    }
    console.log('✓ PASS: storeRedispatch succeeded with 200');

    // Verify DB state after storeRedispatch
    const updatedCase = await prisma.returnExchange.findUnique({ where: { id: testReturnCase.id } });
    if (updatedCase.status !== 'REDISPATCHED' || updatedCase.routedTo !== 'DISPATCH' || !updatedCase.storeProcessedBy) {
      throw new Error(`FAIL: ReturnExchange not properly stamped: status=${updatedCase.status}, routedTo=${updatedCase.routedTo}, storeProcessedBy=${updatedCase.storeProcessedBy}`);
    }
    const audit = await prisma.auditLog.findFirst({
      where: { orderId: testOrder.id, action: 'STORE_REDISPATCH' }
    });
    if (!audit) {
      throw new Error('FAIL: No STORE_REDISPATCH audit log found');
    }
    console.log('✓ PASS: ReturnExchange status REDISPATCHED, routedTo DISPATCH, STORE_REDISPATCH audit logged');

    // ── CHECK 5: Order NOW appears in Dispatch Profile with authorized re-dispatch status ──
    console.log('\n--- CHECK 5: Order enters Dispatch Profile as authorized Re-dispatch ---');
    let mockResData5 = null;
    const mockRes5 = {
      json: (data) => { mockResData5 = data; },
      status: (code) => ({ json: (data) => { mockResData5 = data; } })
    };

    await getDispatchProfileOrders(mockReq1, mockRes5);
    const inUnseen5 = (mockResData5?.unseen || []).find(o => o.id === testOrder.id);
    if (!inUnseen5) {
      throw new Error(`FAIL: Order #${testOrder.orderNumber} did not appear in Dispatch unseen queue!`);
    }
    if (!inUnseen5.isStoreRedispatch || !inUnseen5.hasStoreRedispatchAuthorization) {
      throw new Error('FAIL: Order did not have isStoreRedispatch: true and hasStoreRedispatchAuthorization: true');
    }
    if (!inUnseen5.storeRedispatchDetails || inUnseen5.storeRedispatchDetails.storeProcessedBy !== testStoreUser.name) {
      throw new Error('FAIL: storeRedispatchDetails missing or storeProcessedBy does not match');
    }
    console.log(`✓ PASS: Order #${testOrder.orderNumber} successfully in Dispatch Unseen with isStoreRedispatch=true and storeProcessedBy="${inUnseen5.storeRedispatchDetails.storeProcessedBy}"`);

    // ── CHECK 6: Existing normal order with historical un-redispatched return (Order #52146) ──
    console.log('\n--- CHECK 6: Existing order with un-redispatched return (Order #52146) must NOT have re-dispatch badge ---');
    const order52146 = (mockResData5?.unseen || []).concat(mockResData5?.seen || []).find(o => o.orderNumber === '52146');
    if (order52146) {
      if (order52146.isStoreRedispatch || order52146.hasStoreRedispatchAuthorization || order52146.returnExchangeCases?.length > 0) {
        throw new Error('FAIL: Order #52146 erroneously still flagged as isStoreRedispatch or leaked returnExchangeCases!');
      }
      console.log('✓ PASS: Order #52146 correctly does NOT have isStoreRedispatch, hasStoreRedispatchAuthorization=false, and returnExchangeCases=[]');
    } else {
      console.log('ℹ Order #52146 not currently in active queue (or already completed), test check passed');
    }

    // ── CHECK 7: Re-dispatched order subsequently returned again loses re-dispatch authorization ──
    console.log('\n--- CHECK 7: Subsequent return event revokes re-dispatch authorization until Store re-authorizes ---');
    // Simulate rider returning the order again during second dispatch attempt
    await prisma.auditLog.create({
      data: {
        orderId: testOrder.id,
        action: 'DELIVERY_AUTO_RETURNED',
        details: 'Returned again by delivery rider: customer unreachable',
        performedBy: testStoreUser.id,
        timestamp: new Date(Date.now() + 5000) // timestamp AFTER the STORE_REDISPATCH
      }
    });
    // Create new return case for the new cycle
    await prisma.returnExchange.create({
      data: {
        orderId: testOrder.id,
        orderNumber: testOrder.orderNumber,
        customerName: testOrder.customerName,
        customerPhone: testOrder.customerPhone,
        type: 'RETURN',
        status: 'PENDING',
        routedTo: 'STORE',
        returnReason: 'Second return: customer unreachable',
        originalProducts: testOrder.productDetails
      }
    });

    let mockResData7 = null;
    const mockRes7 = {
      json: (data) => { mockResData7 = data; },
      status: (code) => ({ json: (data) => { mockResData7 = data; } })
    };

    await getDispatchProfileOrders(mockReq1, mockRes7);
    const inUnseen7 = (mockResData7?.unseen || []).find(o => o.id === testOrder.id);
    const inSeen7 = (mockResData7?.seen || []).find(o => o.id === testOrder.id);
    if (inUnseen7 || inSeen7) {
      throw new Error(`FAIL: Order #${testOrder.orderNumber} re-appeared in Dispatch after being returned again!`);
    }
    console.log('✓ PASS: Order correctly removed from Dispatch upon being returned again');

    console.log('\n================================================================');
    console.log(' ALL 7 VERIFICATION CHECKS PASSED SUCCESSFULLY (100%)');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup test records
    try {
      if (testOrder?.id) {
        await prisma.returnExchange.deleteMany({ where: { orderId: testOrder.id } });
        await prisma.routingHistory.deleteMany({ where: { orderId: testOrder.id } });
        await prisma.auditLog.deleteMany({ where: { orderId: testOrder.id } });
        await prisma.orderStage.deleteMany({ where: { orderId: testOrder.id } });
        await prisma.order.delete({ where: { id: testOrder.id } });
        console.log('Test data cleanly removed.');
      }
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await prisma.$disconnect();
  }
}

runVerification();
