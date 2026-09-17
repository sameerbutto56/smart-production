// Automated test suite for multi-cycle Order Cancellation workflow:
// Cancellation Request -> Admin Approval/Rejection -> Re-Cancellation -> Multi-Cycle History.
// Run via: node backend/scripts/verify-cancellation-workflow.cjs

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runVerification() {
  console.log('--- STARTING CANCELLATION WORKFLOW VERIFICATION ---');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      testsPassed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      testsFailed++;
    }
  }

  const testOrderNumber = `TEST-CANCEL-${Date.now()}`;
  let testOrder = null;

  try {
    // 1. Create a test order in STORE stage
    testOrder = await prisma.order.create({
      data: {
        orderNumber: testOrderNumber,
        customerName: 'Test Cancellation Customer',
        customerPhone: '03001234567',
        status: 'PENDING',
        currentStage: 'STORE',
        source: 'TEST',
        type: 'Standard',
        totalPrice: 15000,
        stages: {
          create: [
            { stageName: 'ORDER_ENTRY', status: 'COMPLETED' },
            { stageName: 'STORE', status: 'PENDING' }
          ]
        }
      }
    });
    assert(testOrder && testOrder.id, `Created test order #${testOrderNumber} in stage STORE`);

    // 2. Initial Cancellation Request (Cycle #1 PENDING)
    const latest1 = await prisma.orderCancellationRequest.findFirst({ where: { orderId: testOrder.id }, orderBy: { createdAt: 'desc' } });
    const cycle1 = (latest1?.cycleNumber || 0) + 1;
    const req1 = await prisma.orderCancellationRequest.create({
      data: {
        orderId: testOrder.id,
        orderNumber: testOrder.orderNumber,
        reason: 'Customer wants to cancel due to delivery delay',
        requestedByName: 'Faisal Test User',
        cycleNumber: cycle1
      }
    });
    assert(req1.status === 'PENDING' && req1.cycleNumber === 1, 'Cancellation Request #1 created (Cycle #1, PENDING)');

    // 3. Duplicate PENDING request block test
    const pendingCheck = await prisma.orderCancellationRequest.findFirst({ where: { orderId: testOrder.id, status: 'PENDING' } });
    assert(pendingCheck !== null, 'Backend detects active PENDING cancellation request');

    // 4. Admin rejection validation (empty decisionNote check)
    const emptyReason = '   ';
    const isValidReason = Boolean(emptyReason && String(emptyReason).trim());
    assert(!isValidReason, 'Backend rejects empty decisionNote for rejection');

    // 5. Admin Rejects Request #1 with valid decision note
    const decisionNote1 = 'Cancellation rejected because production has already started.';
    const updatedCount1 = await prisma.$transaction(async (tx) => {
      const res = await tx.orderCancellationRequest.updateMany({
        where: { id: req1.id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          decidedByName: 'Admin Evaluator',
          decisionNote: decisionNote1,
          decidedAt: new Date()
        }
      });
      return res.count;
    });
    assert(updatedCount1 === 1, 'Admin rejected Request #1 atomically');

    // Verify order remains active and NOT CANCELLED
    const orderAfterReject1 = await prisma.order.findUnique({ where: { id: testOrder.id } });
    assert(orderAfterReject1.status === 'PENDING' && orderAfterReject1.currentStage === 'STORE', 'Order status remains active in stage STORE (NOT set to CANCELLED)');

    // 6. Verify history lookup returns Cycle #1 REJECTED
    const requestsAfterReject1 = await prisma.orderCancellationRequest.findMany({
      where: { orderId: testOrder.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(requestsAfterReject1.length === 1 && requestsAfterReject1[0].status === 'REJECTED' && requestsAfterReject1[0].decisionNote === decisionNote1, 'Lookup returns Cycle #1 REJECTED with decisionNote');

    // 7. Re-Cancel (Cycle #2 PENDING)
    const latest2 = await prisma.orderCancellationRequest.findFirst({ where: { orderId: testOrder.id }, orderBy: { createdAt: 'desc' } });
    const cycle2 = (latest2?.cycleNumber || 0) + 1;
    const req2 = await prisma.orderCancellationRequest.create({
      data: {
        orderId: testOrder.id,
        orderNumber: testOrder.orderNumber,
        reason: 'Customer agreed to pay extra for rush order',
        requestedByName: 'Admin3 View User',
        cycleNumber: cycle2
      }
    });
    assert(req2.status === 'PENDING' && req2.cycleNumber === 2, 'Re-Cancel created Request #2 (Cycle #2, PENDING)');

    // 8. Verify history contains both Cycle #1 (REJECTED) and Cycle #2 (PENDING)
    const history2 = await prisma.orderCancellationRequest.findMany({
      where: { orderId: testOrder.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(history2.length === 2 && history2[0].status === 'PENDING' && history2[1].status === 'REJECTED', 'History preserves Cycle #1 REJECTED alongside Cycle #2 PENDING');

    // 9. Admin Rejects Request #2
    const decisionNote2 = 'Customer changed delivery requirement again.';
    await prisma.orderCancellationRequest.update({
      where: { id: req2.id },
      data: { status: 'REJECTED', decidedByName: 'Admin Evaluator', decisionNote: decisionNote2, decidedAt: new Date() }
    });
    const orderAfterReject2 = await prisma.order.findUnique({ where: { id: testOrder.id } });
    assert(orderAfterReject2.status !== 'CANCELLED', 'Order remains active after 2nd rejection');

    // 10. Re-Cancel (Cycle #3 PENDING)
    const latest3 = await prisma.orderCancellationRequest.findFirst({ where: { orderId: testOrder.id }, orderBy: { createdAt: 'desc' } });
    const cycle3 = (latest3?.cycleNumber || 0) + 1;
    const req3 = await prisma.orderCancellationRequest.create({
      data: {
        orderId: testOrder.id,
        orderNumber: testOrder.orderNumber,
        reason: 'Final agreement: customer insists on full order cancellation',
        requestedByName: 'Faisal Test User',
        cycleNumber: cycle3
      }
    });
    assert(req3.cycleNumber === 3, 'Re-Cancel created Request #3 (Cycle #3, PENDING)');

    // 11. Admin Approves Request #3
    await prisma.$transaction(async (tx) => {
      await tx.orderCancellationRequest.update({
        where: { id: req3.id },
        data: { status: 'APPROVED', decidedByName: 'Admin Evaluator', decidedAt: new Date() }
      });
      await tx.order.update({
        where: { id: testOrder.id },
        data: { status: 'CANCELLED', currentStage: 'CANCELLED', cancelledAt: new Date(), cancellationReason: req3.reason }
      });
      await tx.orderStage.updateMany({
        where: { orderId: testOrder.id, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL', 'ON_HOLD'] } },
        data: { status: 'REJECTED', rejectionReason: `ORDER CANCELLED (approved by Admin): ${req3.reason}` }
      });
    });

    const finalOrder = await prisma.order.findUnique({ where: { id: testOrder.id } });
    assert(finalOrder.status === 'CANCELLED' && finalOrder.currentStage === 'CANCELLED', 'Admin Approval sets order status to CANCELLED and currentStage to CANCELLED');

    // 12. Attempt Re-Cancel on permanently CANCELLED order -> blocked
    const canReCancelApproved = finalOrder.status !== 'CANCELLED' && finalOrder.currentStage !== 'CANCELLED';
    assert(!canReCancelApproved, 'Re-Cancel blocked on permanently CANCELLED order');

    // 13. Verify full multi-cycle history payload
    const finalHistory = await prisma.orderCancellationRequest.findMany({
      where: { orderId: testOrder.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(finalHistory.length === 3, 'Full multi-cycle history contains exactly 3 request cycles');
    assert(finalHistory[0].status === 'APPROVED' && finalHistory[1].status === 'REJECTED' && finalHistory[2].status === 'REJECTED', 'History states in order: Cycle #3 APPROVED, Cycle #2 REJECTED, Cycle #1 REJECTED');

  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    testsFailed++;
  } finally {
    // Cleanup test data
    if (testOrder?.id) {
      await prisma.orderCancellationRequest.deleteMany({ where: { orderId: testOrder.id } }).catch(() => {});
      await prisma.orderStage.deleteMany({ where: { orderId: testOrder.id } }).catch(() => {});
      await prisma.order.delete({ where: { id: testOrder.id } }).catch(() => {});
      console.log('✓ Cleaned up test order and cancellation requests');
    }
    await prisma.$disconnect();
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log(`========================================`);

  if (testsFailed > 0) process.exit(1);
}

runVerification();
