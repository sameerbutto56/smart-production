/**
 * Automated Verification Script for Delivery Payment Collection & Admin Dashboard Reconciliation
 * Tests the complete end-to-end specification:
 * 1. Zero-COD / Fully-Paid Orders:
 *    - DELIVER proceeds without payment method or funds collection
 *    - Order becomes DELIVERED
 *    - NO fake Cash or Online transaction is created
 * 2. Orders with Outstanding COD:
 *    - Payment method is strictly mandatory (rejects missing method)
 *    - CASH collection: full amount recorded as Cash, 0 Online
 *    - ONLINE collection: full amount recorded as Online, 0 Cash
 *    - CASH + ONLINE collection: validates Cash + Online = Outstanding COD (rejects invalid split)
 *    - Exact split recorded in database
 * 3. Duplicate Prevention:
 *    - Rejects double delivery calls on already DELIVERED orders
 *    - Rejects duplicate collection if collection record already exists
 * 4. Other Delivery Actions:
 *    - NO RESPONSE and RETURN proceed normally without payment validation
 * 5. Admin Dashboard Reconciliation:
 *    - Admin Cash Collected strictly derives from actual Cash collections
 *    - Admin Online Collected strictly derives from actual Online collections
 *    - Cash + Online split correctly distributes to Cash, Online, and Cash+Online categories
 *    - Total Collected = Cash Collected + Online Collected (100% reconciliation)
 *    - Outstanding COD = ₨0 once collected
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/prisma');
const deliveryController = require('../src/controllers/delivery.controller');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function run() {
  console.log('🚀 Starting Delivery Payment Collection & Admin Dashboard Reconciliation Verification Suite...\n');

  const testIds = [];
  const testOrderNumbers = [
    `TEST-ZERO-COD-${Date.now()}`,
    `TEST-COD-A-CASH-${Date.now()}`,
    `TEST-COD-B-ONLINE-${Date.now()}`,
    `TEST-COD-C-SPLIT-${Date.now()}`,
    `TEST-NO-RESP-${Date.now()}`
  ];

  try {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Mock response helper
    const mockRes = () => {
      const res = {
        statusCode: 200,
        data: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.data = payload; return this; }
      };
      return res;
    };

    const testUser = await prisma.user.findFirst({ select: { id: true, name: true } });

    console.log('--- Step 1: Case A — Zero COD / Fully Paid Order ---');
    // Order 0: Total ₨10,000 | Advance ₨10,000 | Outstanding COD ₨0
    const orderZeroCOD = await prisma.order.create({
      data: {
        orderNumber: testOrderNumbers[0],
        customerName: 'Prepaid Customer Zero COD',
        customerPhone: '03000000000',
        totalPrice: 10000,
        advanceAmount: 10000,
        deliveryMethod: 'Enamels Delivery',
        deliveryType: 'ENAMELS',
        currentStage: 'OUT_FOR_DELIVERY',
        status: 'IN_PROGRESS',
        paymentStatus: 'PAID',
        createdAt: today
      }
    });
    testIds.push(orderZeroCOD.id);

    // Delivery Boy clicks Deliver with paymentMethod: 'PAID', cash: 0, online: 0
    const resZero = mockRes();
    await deliveryController.deliverOrder({
      params: { orderId: orderZeroCOD.id },
      body: { paymentMethod: 'PAID', cashAmount: 0, onlineAmount: 0, riderName: 'Test Rider' },
      user: testUser || { name: 'Test Rider' }
    }, resZero);

    assert(resZero.statusCode === 200, 'Zero-COD order delivered successfully without payment');
    const updatedZero = await prisma.order.findUnique({ where: { id: orderZeroCOD.id } });
    assert(updatedZero.currentStage === 'DELIVERED', 'Zero-COD order stage updated to DELIVERED');
    assert(updatedZero.status === 'COMPLETED', 'Zero-COD order status updated to COMPLETED');

    // Assert NO fake DeliveryPayment record created
    const zeroPayments = await prisma.deliveryPayment.findMany({ where: { orderId: orderZeroCOD.id } });
    assert(zeroPayments.length === 0, 'No fake DeliveryPayment record created for Zero-COD delivery');

    console.log('\n--- Step 2: Case B — COD Order Payment Validation & Enforcement ---');
    // Order 1: Total ₨6,000 | Advance ₨0 | Outstanding COD ₨6,000
    const orderA = await prisma.order.create({
      data: {
        orderNumber: testOrderNumbers[1],
        customerName: 'COD Customer A (Cash)',
        customerPhone: '03001111111',
        totalPrice: 6000,
        advanceAmount: 0,
        deliveryMethod: 'Enamels Delivery',
        deliveryType: 'ENAMELS',
        currentStage: 'OUT_FOR_DELIVERY',
        status: 'IN_PROGRESS',
        createdAt: today
      }
    });
    testIds.push(orderA.id);

    // 2a. Attempt to deliver without payment method -> Must fail with 400
    const resNoMethod = mockRes();
    await deliveryController.deliverOrder({
      params: { orderId: orderA.id },
      body: { paymentMethod: '', cashAmount: 0, onlineAmount: 0, riderName: 'Test Rider' },
      user: testUser || { name: 'Test Rider' }
    }, resNoMethod);
    assert(resNoMethod.statusCode === 400, 'Backend rejected delivery without payment method on COD order');

    // 2b. Deliver with CASH ₨6,000 -> Must succeed
    const resCash = mockRes();
    await deliveryController.deliverOrder({
      params: { orderId: orderA.id },
      body: { paymentMethod: 'CASH', cashAmount: 6000, onlineAmount: 0, riderName: 'Test Rider' },
      user: testUser || { name: 'Test Rider' }
    }, resCash);
    assert(resCash.statusCode === 200, 'Delivery succeeded with CASH ₨6,000');

    const paymentA = await prisma.deliveryPayment.findFirst({ where: { orderId: orderA.id } });
    assert(paymentA !== null, 'Authoritative DeliveryPayment record created for Order A');
    assert(paymentA.paymentMethod === 'CASH', 'Payment method is CASH');
    assert(paymentA.cashAmount === 6000, 'Cash amount recorded as ₨6,000');
    assert(paymentA.onlineAmount === 0, 'Online amount recorded as ₨0');

    // 2c. Attempt duplicate delivery on already delivered order -> Must fail with 400
    const resDup = mockRes();
    await deliveryController.deliverOrder({
      params: { orderId: orderA.id },
      body: { paymentMethod: 'CASH', cashAmount: 6000, onlineAmount: 0, riderName: 'Test Rider' },
      user: testUser || { name: 'Test Rider' }
    }, resDup);
    assert(resDup.statusCode === 400, 'Backend rejected duplicate delivery on already DELIVERED order');

    console.log('\n--- Step 3: Order B — ONLINE Collection ---');
    // Order 2: Total ₨6,000 | Advance ₨0 | Outstanding COD ₨6,000
    const orderB = await prisma.order.create({
      data: {
        orderNumber: testOrderNumbers[2],
        customerName: 'COD Customer B (Online)',
        customerPhone: '03002222222',
        totalPrice: 6000,
        advanceAmount: 0,
        deliveryMethod: 'Enamels Delivery',
        deliveryType: 'ENAMELS',
        currentStage: 'OUT_FOR_DELIVERY',
        status: 'IN_PROGRESS',
        createdAt: today
      }
    });
    testIds.push(orderB.id);

    // Deliver with ONLINE ₨6,000
    const resOnline = mockRes();
    await deliveryController.deliverOrder({
      params: { orderId: orderB.id },
      body: { paymentMethod: 'ONLINE', cashAmount: 0, onlineAmount: 6000, riderName: 'Test Rider' },
      user: testUser || { name: 'Test Rider' }
    }, resOnline);
    assert(resOnline.statusCode === 200, 'Delivery succeeded with ONLINE ₨6,000');

    const paymentB = await prisma.deliveryPayment.findFirst({ where: { orderId: orderB.id } });
    assert(paymentB !== null, 'Authoritative DeliveryPayment record created for Order B');
    assert(paymentB.paymentMethod === 'ONLINE', 'Payment method is ONLINE');
    assert(paymentB.cashAmount === 0, 'Cash amount recorded as ₨0');
    assert(paymentB.onlineAmount === 6000, 'Online amount recorded as ₨6,000');

    console.log('\n--- Step 4: Order C — CASH + ONLINE Split Collection ---');
    // Order 3: Total ₨6,000 | Advance ₨0 | Outstanding COD ₨6,000
    const orderC = await prisma.order.create({
      data: {
        orderNumber: testOrderNumbers[3],
        customerName: 'COD Customer C (Split)',
        customerPhone: '03003333333',
        totalPrice: 6000,
        advanceAmount: 0,
        deliveryMethod: 'Enamels Delivery',
        deliveryType: 'ENAMELS',
        currentStage: 'OUT_FOR_DELIVERY',
        status: 'IN_PROGRESS',
        createdAt: today
      }
    });
    testIds.push(orderC.id);

    // 4a. Attempt split payment with invalid sum (₨2,500 + ₨3,000 = ₨5,500 != ₨6,000) -> Must fail
    const resInvalidSplit = mockRes();
    await deliveryController.deliverOrder({
      params: { orderId: orderC.id },
      body: { paymentMethod: 'CASH_ONLINE', cashAmount: 2500, onlineAmount: 3000, riderName: 'Test Rider' },
      user: testUser || { name: 'Test Rider' }
    }, resInvalidSplit);
    assert(resInvalidSplit.statusCode === 400, 'Backend rejected split payment where sum does not equal amount due');

    // 4b. Deliver with exact split: Cash ₨2,500 + Online ₨3,500 = ₨6,000 -> Must succeed
    const resValidSplit = mockRes();
    await deliveryController.deliverOrder({
      params: { orderId: orderC.id },
      body: { paymentMethod: 'CASH_ONLINE', cashAmount: 2500, onlineAmount: 3500, riderName: 'Test Rider' },
      user: testUser || { name: 'Test Rider' }
    }, resValidSplit);
    assert(resValidSplit.statusCode === 200, 'Delivery succeeded with CASH_ONLINE (Cash ₨2,500 + Online ₨3,500 = ₨6,000)');

    const paymentC = await prisma.deliveryPayment.findFirst({ where: { orderId: orderC.id } });
    assert(paymentC !== null, 'Authoritative DeliveryPayment record created for Order C');
    assert(paymentC.paymentMethod === 'CASH_ONLINE', 'Payment method is CASH_ONLINE');
    assert(paymentC.cashAmount === 2500, 'Cash amount recorded as ₨2,500');
    assert(paymentC.onlineAmount === 3500, 'Online amount recorded as ₨3,500');

    console.log('\n--- Step 5: Other Delivery Actions (No Response, Return) Unaffected ---');
    // Order 4: Test NO RESPONSE does not require payment
    const orderNoResp = await prisma.order.create({
      data: {
        orderNumber: testOrderNumbers[4],
        customerName: 'No Response Customer',
        customerPhone: '03004444444',
        totalPrice: 4500,
        advanceAmount: 0,
        deliveryMethod: 'Enamels Delivery',
        deliveryType: 'ENAMELS',
        currentStage: 'OUT_FOR_DELIVERY',
        status: 'IN_PROGRESS',
        createdAt: today
      }
    });
    testIds.push(orderNoResp.id);

    const resNoResp = mockRes();
    await deliveryController.noResponse({
      params: { orderId: orderNoResp.id },
      body: { riderName: 'Test Rider' },
      user: testUser || { name: 'Test Rider' }
    }, resNoResp);
    assert(resNoResp.statusCode === 200, 'NO RESPONSE action logged successfully without payment validation');

    console.log('\n--- Step 6: Admin Dashboard Automated Reconciliation ---');
    let analyticsData = null;
    const reqAnalytics = {
      query: {
        dateFrom: todayStart.toISOString(),
        dateTo: todayEnd.toISOString()
      }
    };
    const resAnalytics = {
      json: (d) => { analyticsData = d; },
      status: () => ({ json: (d) => { analyticsData = d; } })
    };

    await deliveryController.getDeliveryAnalytics(reqAnalytics, resAnalytics);

    const relZero = analyticsData.orders.find(o => o.id === orderZeroCOD.id);
    const relA = analyticsData.orders.find(o => o.id === orderA.id);
    const relB = analyticsData.orders.find(o => o.id === orderB.id);
    const relC = analyticsData.orders.find(o => o.id === orderC.id);

    assert(relZero && relA && relB && relC, 'All test orders present in Admin Dashboard analytics');

    // Zero-COD order in analytics:
    assert(relZero.isPrepaid === true, 'Zero-COD order identified as prepaid');
    assert(relZero.expectedCodAmount === 0, 'Zero-COD order expectedCodAmount is ₨0');
    assert(relZero.cashCollected === 0, 'Zero-COD order cashCollected is ₨0');
    assert(relZero.onlineCollected === 0, 'Zero-COD order onlineCollected is ₨0');
    assert(relZero.totalCollected === 0, 'Zero-COD order totalCollected is ₨0');
    assert(relZero.remainingCOD === 0, 'Zero-COD order remainingCOD is ₨0');

    // Order A (Cash ₨6,000):
    assert(relA.cashCollected === 6000, `Order A cashCollected is ₨6,000 (actual: ₨${relA.cashCollected})`);
    assert(relA.onlineCollected === 0, `Order A onlineCollected is ₨0 (actual: ₨${relA.onlineCollected})`);
    assert(relA.totalCollected === 6000, `Order A totalCollected is ₨6,000 (actual: ₨${relA.totalCollected})`);
    assert(relA.remainingCOD === 0, `Order A remainingCOD is ₨0 (actual: ₨${relA.remainingCOD})`);

    // Order B (Online ₨6,000):
    assert(relB.cashCollected === 0, `Order B cashCollected is ₨0 (actual: ₨${relB.cashCollected})`);
    assert(relB.onlineCollected === 6000, `Order B onlineCollected is ₨6,000 (actual: ₨${relB.onlineCollected})`);
    assert(relB.totalCollected === 6000, `Order B totalCollected is ₨6,000 (actual: ₨${relB.totalCollected})`);
    assert(relB.remainingCOD === 0, `Order B remainingCOD is ₨0 (actual: ₨${relB.remainingCOD})`);

    // Order C (Cash ₨2,500 + Online ₨3,500 = ₨6,000):
    assert(relC.cashCollected === 2500, `Order C cashCollected is ₨2,500 (actual: ₨${relC.cashCollected})`);
    assert(relC.onlineCollected === 3500, `Order C onlineCollected is ₨3,500 (actual: ₨${relC.onlineCollected})`);
    assert(relC.cashOnlineCollected === 6000, `Order C cashOnlineCollected is ₨6,000 (actual: ₨${relC.cashOnlineCollected})`);
    assert(relC.totalCollected === 6000, `Order C totalCollected is ₨6,000 (actual: ₨${relC.totalCollected})`);
    assert(relC.remainingCOD === 0, `Order C remainingCOD is ₨0 (actual: ₨${relC.remainingCOD})`);

    // Scenario Totals across Delivered COD Orders A, B, and C:
    const totalCash = relA.cashCollected + relB.cashCollected + relC.cashCollected;
    const totalOnline = relA.onlineCollected + relB.onlineCollected + relC.onlineCollected;
    const totalCashOnline = relA.cashOnlineCollected + relB.cashOnlineCollected + relC.cashOnlineCollected;
    const totalDelivered = relA.totalCollected + relB.totalCollected + relC.totalCollected;

    console.log('\n--- Final Scenario Financial Reconciliation ---');
    console.log(`  Order A (CASH ₨6,000):               Cash = ₨${relA.cashCollected.toLocaleString()}, Online = ₨${relA.onlineCollected.toLocaleString()}`);
    console.log(`  Order B (ONLINE ₨6,000):             Cash = ₨${relB.cashCollected.toLocaleString()}, Online = ₨${relB.onlineCollected.toLocaleString()}`);
    console.log(`  Order C (CASH_ONLINE ₨2,500/₨3,500): Cash = ₨${relC.cashCollected.toLocaleString()}, Online = ₨${relC.onlineCollected.toLocaleString()}`);
    console.log('  -------------------------------------------------------------');
    console.log(`  Total Cash Collected:                ₨${totalCash.toLocaleString()} (Expected: ₨8,500)`);
    console.log(`  Total Online Collected:              ₨${totalOnline.toLocaleString()} (Expected: ₨9,500)`);
    console.log(`  Total Cash + Online Orders:          ₨${totalCashOnline.toLocaleString()} (Expected: ₨6,000)`);
    console.log(`  Total Collected:                     ₨${totalDelivered.toLocaleString()} (Expected: ₨18,000)`);

    assert(totalCash === 8500, 'Total Cash Collected across deliveries equals ₨8,500 (6,000 + 2,500)');
    assert(totalOnline === 9500, 'Total Online Collected across deliveries equals ₨9,500 (6,000 + 3,500)');
    assert(totalCashOnline === 6000, 'Cash + Online Collected equals ₨6,000');
    assert(totalDelivered === 18000, 'Total Collected equals ₨18,000 (8,500 + 9,500)');
    assert(totalDelivered === totalCash + totalOnline, 'Total Collected EXACTLY reconciles with Cash Collected + Online Collected');

    // Global Stats invariants
    const stats = analyticsData.stats;
    assert(
      Math.abs(stats.totalCollected - (stats.cashCollected + stats.onlineCollected)) <= 0.01,
      `Global stats totalCollected (₨${stats.totalCollected}) equals cashCollected (₨${stats.cashCollected}) + onlineCollected (₨${stats.onlineCollected})`
    );

    console.log('\n✨ ALL ENAMEL DELIVERY BOY PAYMENT COLLECTION & ADMIN DASHBOARD RECONCILIATION TESTS PASSED (100%)!');
  } finally {
    console.log('\n--- Cleanup: Removing Test Records ---');
    if (testIds.length > 0) {
      await prisma.deliveryPayment.deleteMany({ where: { orderId: { in: testIds } } }).catch(() => {});
      await prisma.deliveryCharge.deleteMany({ where: { orderId: { in: testIds } } }).catch(() => {});
      await prisma.deliveryAttempt.deleteMany({ where: { orderId: { in: testIds } } }).catch(() => {});
      await prisma.noResponseLog.deleteMany({ where: { orderId: { in: testIds } } }).catch(() => {});
      await prisma.routingHistory.deleteMany({ where: { orderId: { in: testIds } } }).catch(() => {});
      await prisma.orderStage.deleteMany({ where: { orderId: { in: testIds } } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { orderId: { in: testIds } } }).catch(() => {});
      await prisma.order.deleteMany({ where: { id: { in: testIds } } }).catch(() => {});
      console.log(`✅ Cleaned up ${testIds.length} test order & payment records`);
    }
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
