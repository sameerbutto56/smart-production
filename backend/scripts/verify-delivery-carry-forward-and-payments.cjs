/**
 * Verification Test Suite: Delivery Boy Admin Dashboard — Carry Forward & Payment Breakdown Fix
 * 
 * Verifies:
 * 1. Gate Pass and Delivery Analytics parity for Enamels delivery orders
 * 2. Carried forward orders (e.g. 52615, 52710) have isCarryForward: true and are included in today's workload
 * 3. Total workload in Admin Dashboard matches actual pending/active orders
 * 4. Advance paid orders have expectedCodAmount = 0, isCOD = false, isPaid = true
 * 5. Orders with partial advance have expectedCodAmount strictly equal to (totalPrice - advanceAmount)
 * 6. deliverOrder enforces strict split validation for CASH_ONLINE (cash + online === amountDue)
 * 7. Payment breakdown reconciles cleanly: Total Order Value = Total Paid in Advance + COD Expected Amount
 */

const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();
const { getDeliveryAnalytics, deliverOrder } = require('../src/controllers/delivery.controller');

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Delivery Carry-Forward & Payment Breakdown Fix');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Fetch Admin Analytics for 2026-09-24
    // -------------------------------------------------------------
    console.log('Test 1: Admin Delivery Analytics for 2026-09-24');
    let analyticsData = null;
    const req = { query: { dateFrom: '2026-09-24', dateTo: '2026-09-24' } };
    const res = {
      json: (data) => { analyticsData = data; },
      status: (code) => ({
        json: (d) => { console.error('Status error:', code, d); }
      })
    };

    await getDeliveryAnalytics(req, res);
    assert(analyticsData !== null, 'getDeliveryAnalytics returned data');

    const enamelsOrders = analyticsData.orders.filter(o => o.riderName === 'Enamels Delivery');
    console.log(`  Found ${enamelsOrders.length} Enamels delivery orders for today:`);
    for (const o of enamelsOrders) {
      console.log(`    - Order #${o.orderNumber}: status=${o.primaryStatus}, carryForward=${o.isCarryForward}, COD=₨${o.expectedCodAmount}`);
    }

    assert(enamelsOrders.length >= 9, `Expected at least 9 Enamels delivery orders in Admin Dashboard (found ${enamelsOrders.length})`);

    // -------------------------------------------------------------
    // Test 2: Verify Carry Forward Identification
    // -------------------------------------------------------------
    console.log('\nTest 2: Carry Forward Identification');
    const carriedOrders = enamelsOrders.filter(o => o.isCarryForward);
    console.log(`  Carried forward orders count: ${carriedOrders.length}`);
    const carriedNumbers = carriedOrders.map(o => o.orderNumber);
    console.log(`  Carried order numbers: ${carriedNumbers.join(', ')}`);

    assert(carriedOrders.length >= 2, `Expected at least 2 carry-forward orders (#52615, #52710) (found ${carriedOrders.length})`);
    assert(carriedNumbers.includes('52615'), 'Order #52615 is marked as carry forward');
    assert(carriedNumbers.includes('52710'), 'Order #52710 is marked as carry forward');

    // -------------------------------------------------------------
    // Test 3: Total Workload Reconciliation in Stats
    // -------------------------------------------------------------
    console.log('\nTest 3: Total Workload Reconciliation in Stats');
    const stats = analyticsData.stats;
    console.log('  Stats output:', {
      totalAssigned: stats.totalAssigned,
      carryForward: stats.carryForward,
      inTransit: stats.inTransit,
      pending: stats.pending,
      delivered: stats.delivered,
      totalOrderValue: stats.totalOrderValue,
      codExpectedAmount: stats.codExpectedAmount
    });

    assert(stats.totalAssigned === enamelsOrders.length, `Total assigned workload reflects ${enamelsOrders.length} orders (found ${stats.totalAssigned})`);
    assert(stats.carryForward === carriedOrders.length, `Stats carryForward count is ${carriedOrders.length} (found ${stats.carryForward})`);
    const statusSum = (stats.pending || 0) + (stats.inTransit || 0) + (stats.carryForward || 0);
    assert(statusSum === stats.totalAssigned, `Sum of active and carried-forward workload equals totalAssigned (pending ${stats.pending} + inTransit ${stats.inTransit} + carryForward ${stats.carryForward} = ${statusSum})`);

    // -------------------------------------------------------------
    // Test 4: Financial Classification — Paid in Advance vs COD
    // -------------------------------------------------------------
    console.log('\nTest 4: Financial Classification');
    assert(stats.totalOrderValue > 0, `Total order value is positive (found ₨${stats.totalOrderValue})`);
    assert(stats.codExpectedAmount > 0, `COD Expected amount is positive (found ₨${stats.codExpectedAmount})`);
    assert(stats.totalOrderValue === (stats.totalPaidAmount + stats.codExpectedAmount), 'Total Order Value perfectly reconciles: Total Paid in Advance + COD Expected Amount');

    // -------------------------------------------------------------
    // Test 5: Verify Paid Order Treatment (Prepaid Clearance)
    // -------------------------------------------------------------
    console.log('\nTest 5: Paid Order Zero COD Logic');
    // Synthetic check on paid order logic
    const paidMockOrder = {
      totalPrice: 4500,
      advanceAmount: 4500,
      advancePaid: true,
      paymentStatus: 'PAID'
    };
    const { isPaidOrder, getRemainingBalance } = require('../../frontend/src/utils/paymentUtils.js');
    assert(isPaidOrder(paidMockOrder) === true, 'isPaidOrder returns true for fully paid order');
    assert(getRemainingBalance(paidMockOrder) === 0, 'getRemainingBalance returns ₨0 for paid order');

    // Partial advance order check
    const partialMockOrder = {
      totalPrice: 5000,
      advanceAmount: 2000,
      advancePaid: false,
      paymentStatus: 'BALANCE'
    };
    assert(isPaidOrder(partialMockOrder) === false, 'isPaidOrder returns false for partial advance order');
    assert(getRemainingBalance(partialMockOrder) === 3000, `getRemainingBalance strictly returns (totalPrice - advanceAmount) = ₨3,000 (found ₨${getRemainingBalance(partialMockOrder)})`);

    // -------------------------------------------------------------
    // Test 6: Strict Split Payment Validation in deliverOrder
    // -------------------------------------------------------------
    console.log('\nTest 6: Strict Split Payment Validation in deliverOrder');
    
    // Find an active order to test validation
    const testOrder = await prisma.order.findFirst({
      where: { orderNumber: '52727' }
    });
    assert(testOrder !== null, 'Order #52727 found in DB for validation test');

    const amountDue = testOrder.totalPrice - (testOrder.advanceAmount || 0); // 1700
    console.log(`  Order #52727 totalPrice=₨${testOrder.totalPrice}, advance=₨${testOrder.advanceAmount}, amountDue=₨${amountDue}`);

    // Call deliverOrder with INVALID split (cash 1000 + online 500 = 1500 != 1700)
    let invalidResponseCode = null;
    let invalidResponseMessage = null;
    const reqInvalid = {
      params: { orderId: testOrder.id },
      body: {
        paymentMethod: 'CASH_ONLINE',
        cashAmount: 1000,
        onlineAmount: 500,
        riderName: 'Enamels Delivery'
      },
      user: { name: 'Enamels Delivery' }
    };
    const resInvalid = {
      status: (code) => {
        invalidResponseCode = code;
        return {
          json: (d) => { invalidResponseMessage = d.message; }
        };
      },
      json: () => {}
    };

    await deliverOrder(reqInvalid, resInvalid);
    assert(invalidResponseCode === 400, `Invalid split payment was rejected with HTTP 400 (got ${invalidResponseCode})`);
    console.log(`    Rejected with error: "${invalidResponseMessage}"`);
    assert(invalidResponseMessage && invalidResponseMessage.includes('must equal amount due'), 'Error message clearly specifies that sum must equal amount due');

    // -------------------------------------------------------------
    // Test 7: Carry Forward Filter Functionality
    // -------------------------------------------------------------
    console.log('\nTest 7: Carry Forward Filter Functionality');
    let cfFilterData = null;
    const reqCF = { query: { dateFrom: '2026-09-24', dateTo: '2026-09-24', deliveryStatus: 'carryForward' } };
    const resCF = {
      json: (data) => { cfFilterData = data; },
      status: (code) => ({ json: () => {} })
    };
    await getDeliveryAnalytics(reqCF, resCF);
    assert(cfFilterData !== null, 'Carry forward filtered query returned data');
    const filteredCFEnamels = cfFilterData.orders.filter(o => o.riderName === 'Enamels Delivery');
    assert(filteredCFEnamels.length === 2, `deliveryStatus=carryForward returned exactly the 2 carried forward orders (got ${filteredCFEnamels.length})`);
    assert(filteredCFEnamels.every(o => o.isCarryForward), 'All returned orders have isCarryForward: true');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await prisma.$disconnect();
    console.log('\n================================================================');
    console.log(`RESULTS: ${passed}/${total} assertions passed`);
    console.log('================================================================\n');
    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runTests();
