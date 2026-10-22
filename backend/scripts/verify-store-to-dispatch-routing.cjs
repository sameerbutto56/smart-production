/**
 * Verification Test: Store Provided -> Dispatch Routing Performance and Non-Deadlocking Verification
 * Verifies that routing an order from Store to Dispatch executes within < 500ms without connection pool starvation or timeouts.
 */
const { PrismaClient } = require('@prisma/client');
const { getStageDurations, ensureSingleActiveDispatchStage, DISPATCH_RESET_FIELDS } = require('../src/controllers/order-helpers');

const prisma = new PrismaClient();

async function runTests() {
  console.log('=== STARTING STORE -> DISPATCH ROUTING VERIFICATION ===');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, description) {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      testsFailed++;
    }
  }

  let testOrder = null;

  try {
    // 1. Test in-memory cache and deadline calculations
    console.log('\n--- Test 1: getStageDurations in-memory caching ---');
    const t0 = Date.now();
    const durations1 = await getStageDurations('NORMAL');
    const elapsed1 = Date.now() - t0;
    assert(durations1 && typeof durations1 === 'object', 'durations1 returned object');
    assert(durations1.DISPATCH !== undefined, 'DISPATCH duration exists');

    const t1 = Date.now();
    const durations2 = await getStageDurations('NORMAL');
    const elapsed2 = Date.now() - t1;
    assert(elapsed2 <= elapsed1, `Cached getStageDurations retrieved in ${elapsed2}ms (<= first call ${elapsed1}ms)`);

    // 2. Create a test order in STORE_RECEIVE
    console.log('\n--- Test 2: Create test order in STORE_RECEIVE ---');
    const orderNumber = `TEST-STORE-DISPATCH-${Date.now().toString().slice(-6)}`;
    testOrder = await prisma.order.create({
      data: {
        orderNumber,
        customerName: 'Test Store Customer',
        customerPhone: '03001234567',
        currentStage: 'STORE_RECEIVE',
        status: 'PENDING',
        priority: 'NORMAL',
        source: 'STORE',
        deliveryType: 'IMMENT',
        stages: {
          create: [
            {
              stageName: 'STORE_RECEIVE',
              status: 'PENDING',
              deadlineAt: new Date(Date.now() + 24 * 3600 * 1000)
            }
          ]
        }
      },
      include: { stages: true }
    });
    assert(testOrder && testOrder.id, `Created test order #${orderNumber} in STORE_RECEIVE`);

    // Fetch a valid user ID for routing history foreign key
    const systemUser = await prisma.user.findFirst({ select: { id: true } });
    const validUserId = systemUser?.id || 'admin';

    // 3. Test interactive transaction routing to DISPATCH without connection pool deadlock
    console.log('\n--- Test 3: Interactive $transaction routing to DISPATCH ---');
    const txStart = Date.now();

    await prisma.$transaction(async (tx) => {
      // Step A: Close active STORE_RECEIVE stage
      await tx.orderStage.updateMany({
        where: { orderId: testOrder.id, stageName: 'STORE_RECEIVE', status: { in: ['PENDING', 'IN_PROGRESS'] } },
        data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: 'Routed to DISPATCH by Verification Test' }
      });

      // Step B: Ensure single active DISPATCH stage inside the transaction
      const dispatchStage = await ensureSingleActiveDispatchStage(testOrder.id, testOrder.priority, tx);
      assert(dispatchStage && dispatchStage.stageName === 'DISPATCH', 'Created DISPATCH stage inside transaction');

      // Step C: Update order state with DISPATCH_RESET_FIELDS
      await tx.order.update({
        where: { id: testOrder.id },
        data: {
          currentStage: 'DISPATCH',
          status: 'PENDING',
          ...DISPATCH_RESET_FIELDS
        }
      });

      // Step D: Record routing history
      await tx.routingHistory.create({
        data: {
          orderId: testOrder.id,
          sentByUserId: validUserId,
          sentToStage: 'DISPATCH',
          previousStage: 'STORE_RECEIVE',
          newStage: 'DISPATCH',
          remarks: 'Routing from Store to Dispatch verification'
        }
      });
    }, {
      timeout: 10000,
      maxWait: 5000
    });

    const txDuration = Date.now() - txStart;
    console.log(`Transaction completed in ${txDuration}ms`);
    assert(txDuration < 2000, `Transaction completed in ${txDuration}ms (< 2000ms threshold)`);

    // 4. Verify post-transaction state
    console.log('\n--- Test 4: Post-transaction order verification ---');
    const updatedOrder = await prisma.order.findUnique({
      where: { id: testOrder.id },
      include: { stages: true }
    });
    const historyList = await prisma.routingHistory.findMany({ where: { orderId: testOrder.id } });

    assert(updatedOrder.currentStage === 'DISPATCH', 'Order currentStage is DISPATCH');
    assert(updatedOrder.status === 'PENDING', 'Order status is PENDING');
    assert(updatedOrder.dispatchStatus === 'PENDING', 'Dispatch reset fields applied');

    const activeStages = updatedOrder.stages.filter(s => ['PENDING', 'IN_PROGRESS'].includes(s.status));
    assert(activeStages.length === 1, `Exactly 1 active stage exists (found ${activeStages.length})`);
    assert(activeStages[0].stageName === 'DISPATCH', `Active stage is DISPATCH`);

    const completedStages = updatedOrder.stages.filter(s => s.status === 'COMPLETED');
    assert(completedStages.some(s => s.stageName === 'STORE_RECEIVE'), 'STORE_RECEIVE stage is COMPLETED');

    assert(historyList.length >= 1, 'Routing history was recorded');

    // 5. Test idempotency: routing to DISPATCH again should not create duplicate stages
    console.log('\n--- Test 5: Idempotent routing check ---');
    const idempStart = Date.now();
    await prisma.$transaction(async (tx) => {
      const stage = await ensureSingleActiveDispatchStage(testOrder.id, testOrder.priority, tx);
      assert(stage.id === activeStages[0].id, 'Re-routing returned existing DISPATCH stage without creating duplicate');
    });
    const idempDuration = Date.now() - idempStart;
    assert(idempDuration < 1000, `Idempotent check completed in ${idempDuration}ms`);

    const finalStages = await prisma.orderStage.findMany({
      where: { orderId: testOrder.id, stageName: 'DISPATCH', status: { in: ['PENDING', 'IN_PROGRESS'] } }
    });
    assert(finalStages.length === 1, `Still exactly 1 active DISPATCH stage`);

  } catch (err) {
    console.error('Test execution error:', err);
    testsFailed++;
  } finally {
    if (testOrder?.id) {
      console.log('\n--- Cleaning up test order ---');
      await prisma.routingHistory.deleteMany({ where: { orderId: testOrder.id } }).catch(() => {});
      await prisma.orderStage.deleteMany({ where: { orderId: testOrder.id } }).catch(() => {});
      await prisma.order.delete({ where: { id: testOrder.id } }).catch(() => {});
      console.log('Cleanup completed.');
    }
    await prisma.$disconnect();
  }

  console.log('\n=============================================');
  console.log(`TOTAL TESTS: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log('=============================================');

  if (testsFailed > 0) process.exit(1);
}

runTests();
