const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/prisma');
const { getDeliveryAnalytics } = require('../src/controllers/delivery.controller');

async function runVerification() {
  console.log('=== ENAMELS DELIVERY FINANCIAL PARITY VERIFICATION ===\n');

  // Test 1: Formula verification on live DB for Today
  console.log('[Test 1] Testing getDeliveryAnalytics for Today...');
  const startToday = '2026-09-24T19:00:00.000Z';
  const endToday = '2026-09-25T18:59:59.999Z';
  
  let todayData = null;
  const mockReqToday = { query: { dateFrom: startToday, dateTo: endToday }, user: { id: 'admin', role: 'SUPER_ADMIN' } };
  const mockResToday = {
    json: (d) => { todayData = d; },
    status: (code) => ({ json: (err) => { throw new Error(`HTTP ${code}: ${JSON.stringify(err)}`); } })
  };
  await getDeliveryAnalytics(mockReqToday, mockResToday);

  assert(todayData, 'todayData should not be null');
  const s = todayData.stats;
  console.log('Today Stats:', {
    totalAssigned: s.totalAssigned,
    paidOrderCount: s.paidOrderCount,
    codOrderCount: s.codOrderCount,
    totalOrderValue: s.totalOrderValue,
    totalPaidAmount: s.totalPaidAmount,
    codExpectedAmount: s.codExpectedAmount,
    totalReceived: s.totalReceived,
    remainingCOD: s.remainingCOD
  });

  // Assertion: Paid Orders + COD Orders === Total Assigned
  assert.strictEqual(
    s.paidOrderCount + s.codOrderCount,
    s.totalAssigned,
    `Paid (${s.paidOrderCount}) + COD (${s.codOrderCount}) must equal Total Assigned (${s.totalAssigned})`
  );
  console.log('✓ Invariant 1 Passed: Paid Orders + COD Orders === Total Assigned');

  // Assertion: Total Paid Amount + COD Expected Amount === Total Order Value
  assert.strictEqual(
    s.totalPaidAmount + s.codExpectedAmount,
    s.totalOrderValue,
    `Paid in Advance (${s.totalPaidAmount}) + COD Expected (${s.codExpectedAmount}) must equal Total Order Value (${s.totalOrderValue})`
  );
  console.log('✓ Invariant 2 Passed: Paid in Advance + COD Expected Amount === Total Order Value');

  // Test 2: Yesterday's orders (the ones from the user screenshot)
  console.log('\n[Test 2] Testing getDeliveryAnalytics for Yesterday (User Screenshot Parity)...');
  const startYesterday = '2026-09-23T19:00:00.000Z';
  const endYesterday = '2026-09-24T18:59:59.999Z';

  let yesterdayData = null;
  const mockReqYesterday = { query: { dateFrom: startYesterday, dateTo: endYesterday }, user: { id: 'admin', role: 'SUPER_ADMIN' } };
  const mockResYesterday = {
    json: (d) => { yesterdayData = d; },
    status: (code) => ({ json: (err) => { throw new Error(`HTTP ${code}: ${JSON.stringify(err)}`); } })
  };
  await getDeliveryAnalytics(mockReqYesterday, mockResYesterday);

  assert(yesterdayData, 'yesterdayData should not be null');
  const ys = yesterdayData.stats;
  console.log('Yesterday Stats:', {
    totalAssigned: ys.totalAssigned,
    delivered: ys.delivered,
    paidOrderCount: ys.paidOrderCount,
    codOrderCount: ys.codOrderCount,
    totalOrderValue: ys.totalOrderValue,
    totalPaidAmount: ys.totalPaidAmount,
    codExpectedAmount: ys.codExpectedAmount,
    cashBeforeDeposits: ys.cashBeforeDeposits,
    onlineReceived: ys.onlineReceived,
    totalReceived: ys.totalReceived,
    remainingCOD: ys.remainingCOD
  });

  // Assertion: Total orders = Paid orders + COD orders
  assert.strictEqual(
    ys.paidOrderCount + ys.codOrderCount,
    ys.totalAssigned,
    `Yesterday: Paid (${ys.paidOrderCount}) + COD (${ys.codOrderCount}) must equal Total Assigned (${ys.totalAssigned})`
  );
  console.log('✓ Invariant 3 Passed: Yesterday Paid Orders + COD Orders === Total Assigned');

  // Assertion: Delivered orders collection is reflected in Cash / Online
  assert.strictEqual(ys.delivered, 6, 'Yesterday must have 6 delivered orders');
  assert.strictEqual(ys.cashBeforeDeposits, 7450, 'Yesterday Cash before deposits must be ₨7,450');
  assert.strictEqual(ys.onlineReceived, 7600, 'Yesterday Online received must be ₨7,600');
  assert.strictEqual(ys.totalReceived, 15050, 'Yesterday Total collected must be ₨15,050 (7,450 + 7,600)');
  console.log('✓ Invariant 4 Passed: Cash (₨7,450) + Online (₨7,600) = Total Collected (₨15,050) — No more Rs 0 bug!');

  // Assertion: Delivered COD orders did NOT get converted into Paid in Advance
  assert.strictEqual(ys.totalPaidAmount, 0, 'Yesterday advance paid must be 0 (all 6 delivered orders were COD collections)');
  console.log('✓ Invariant 5 Passed: Delivered COD orders remained COD and did not falsely inflate Paid in Advance');

  // Test 3: Frontend paymentUtils tests
  console.log('\n[Test 3] Verifying paymentUtils functions logic...');
  const { isPrepaidOrder, isCodOrder, getRemainingBalance } = require('../../frontend/src/utils/paymentUtils');

  // Fully paid order
  const prepaidOrder = { totalPrice: 5000, advanceAmount: 5000, deliveryPayments: [] };
  assert.strictEqual(isPrepaidOrder(prepaidOrder), true, '5000/5000 must be prepaid');
  assert.strictEqual(isCodOrder(prepaidOrder), false, '5000/5000 must not be COD');
  assert.strictEqual(getRemainingBalance(prepaidOrder), 0, 'Prepaid remaining must be 0');

  // Partial advance order
  const partialOrder = { totalPrice: 7000, advanceAmount: 2000, deliveryPayments: [] };
  assert.strictEqual(isPrepaidOrder(partialOrder), false, '7000/2000 must not be prepaid');
  assert.strictEqual(isCodOrder(partialOrder), true, '7000/2000 must be COD');
  assert.strictEqual(getRemainingBalance(partialOrder), 5000, '7000/2000 remaining must be 5000');

  // Full COD order
  const fullCodOrder = { totalPrice: 3500, advanceAmount: 0, deliveryPayments: [] };
  assert.strictEqual(isPrepaidOrder(fullCodOrder), false, '3500/0 must not be prepaid');
  assert.strictEqual(isCodOrder(fullCodOrder), true, '3500/0 must be COD');
  assert.strictEqual(getRemainingBalance(fullCodOrder), 3500, '3500/0 remaining must be 3500');

  // Delivered COD order with cash collection
  const deliveredCodOrder = {
    totalPrice: 3500,
    advanceAmount: 0,
    currentStage: 'DELIVERED',
    status: 'COMPLETED',
    paymentStatus: 'PAID', // set upon delivery
    deliveryPayments: [{ cashAmount: 3500, onlineAmount: 0 }]
  };
  assert.strictEqual(isPrepaidOrder(deliveredCodOrder), false, 'Delivered COD order is NOT prepaid');
  assert.strictEqual(isCodOrder(deliveredCodOrder), true, 'Delivered COD order is still a COD order');
  assert.strictEqual(getRemainingBalance(deliveredCodOrder), 0, 'Delivered COD order remaining is 0');
  console.log('✓ Invariant 6 Passed: paymentUtils correctly identifies prepaid vs COD and preserves COD category after delivery');

  console.log('\n=== ALL 6 FINANCIAL PARITY INVARIANTS PASSED (100%) ===');
}

runVerification()
  .catch(err => {
    console.error('FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
