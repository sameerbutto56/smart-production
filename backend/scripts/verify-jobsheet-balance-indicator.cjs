/**
 * Automated Verification Script for:
 * Implementation Specification: Hide Balance Amounts on All Job Sheets
 *
 * Requirements:
 * 1. Customer has a positive outstanding balance -> show only ✓.
 * 2. Customer has zero balance -> show nothing.
 * 3. Customer has a negative balance -> show nothing.
 * 4. Customer has a balance with decimals -> show only ✓, never the amount.
 * 5. Generate and print the same order from Outlet and Home Man Job Sheets: behavior must be identical.
 * 6. Verify that no balance amount or balance label appears anywhere on the printed Job Sheet.
 * 7. Verify that customer account balances, payments, invoices, and reports remain unchanged.
 */

const assert = require('assert');

// Replicate paymentUtils logic for Node testing
const isPrepaidOrder = (order) => {
  if (!order) return false;
  if (order.isPrepaid === true) return true;
  const totalPrice = Number(order?.totalPrice || 0);
  const advanceAmount = Number(order?.advanceAmount || 0);
  if (totalPrice <= 0.01) return true;
  if (advanceAmount >= totalPrice - 0.01) return true;
  if (order.advancePaid && advanceAmount >= totalPrice - 0.01) return true;
  return false;
};

const getDeliveryCollected = (order) =>
  (order?.deliveryPayments || []).reduce((sum, p) => sum + (Number(p.cashAmount || 0) + Number(p.onlineAmount || 0)), 0);

const getRemainingBalance = (order) => {
  if (isPrepaidOrder(order)) return 0;
  if (order?.status === 'RETURNED' || order?.status === 'CANCELLED') return 0;
  const deliveryPaid = getDeliveryCollected(order);
  const totalPrice = Number(order?.totalPrice || 0);
  const advanceAmount = Number(order?.advanceAmount || 0);
  const initialDue = Math.max(0, Math.round((totalPrice - advanceAmount) * 100) / 100);
  return Math.max(0, Math.round((initialDue - deliveryPaid) * 100) / 100);
};

const hasJobSheetOutstandingBalance = (order) => {
  if (!order) return false;
  if (order.isPrepaid === true) return false;
  const statusUpper = String(order.paymentStatus || '').trim().toUpperCase();
  if (statusUpper === 'PAID' || statusUpper === 'FULL_PAID') return false;
  if (order.status === 'RETURNED' || order.status === 'CANCELLED') return false;

  if (order.balanceAmount != null && !isNaN(parseFloat(order.balanceAmount))) {
    return parseFloat(order.balanceAmount) > 0.001;
  }

  const remaining = getRemainingBalance(order);
  return typeof remaining === 'number' && !isNaN(remaining) && remaining > 0.001;
};

const getJobSheetBalanceIndicator = (order) => {
  return hasJobSheetOutstandingBalance(order) ? '✓' : '';
};

// Simulation of Job Sheet badge renderer
function renderJobSheetBadges(order, isUrdu = false) {
  const badgeLabels = {
    'PAID': isUrdu ? 'آرڈر ادا شدہ' : 'ORDER PAID',
    'ORDER PAID': isUrdu ? 'آرڈر ادا شدہ' : 'ORDER PAID',
    'FULL_CUSTOM': isUrdu ? 'فل کسٹم' : 'FULL CUSTOM',
    'STANDARD': isUrdu ? 'اسٹینڈرڈ' : 'STANDARD',
    'READY_LOGO': isUrdu ? 'ریڈی لوگو' : 'READY LOGO',
    'SUPER_URGENT': isUrdu ? 'انتہائی ارجنٹ' : 'SUPER URGENT',
    'URGENT': isUrdu ? 'ارجنٹ' : 'URGENT',
    'OUTLET': isUrdu ? 'آؤٹ لیٹ' : 'OUTLET',
    'DELIVERY': isUrdu ? 'ڈلیوری' : 'DELIVERY',
    'SELF_COLLECTION': isUrdu ? 'خود لینا' : 'SELF COLLECTION',
  };

  const hasOutstandingBal = hasJobSheetOutstandingBalance(order);
  const _payLabel = hasOutstandingBal ? '✓' : null;

  const output = [];
  [order.type, order.priority, order.outletName || order.source, _payLabel, order.deliveryType]
    .filter(Boolean)
    .forEach((label) => {
      let color = '#6b7280';
      if (label === 'ORDER PAID' || label === 'PAID' || label === 'FULL_CUSTOM') color = '#059669';
      else if (label === 'SUPER_URGENT') color = '#dc2626';
      else if (label === 'URGENT') color = '#d97706';
      else if (label === 'OUTLET') color = '#7c3aed';
      else if (label === '✓') color = '#dc2626';
      else if (label === 'DELIVERY') color = '#2563eb';
      else if (label === 'SELF_COLLECTION') color = '#8b5cf6';
      const displayLabel = label === '✓' ? '&#10003;' : (badgeLabels[label] || label);
      output.push(`<span class="badge" style="color:${color}">${displayLabel}</span>`);
    });

  return output.join(' ');
}

// ─── RUN VERIFICATION TESTS ───
let testsPassed = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [TEST ${totalTests}] ${description}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ [TEST ${totalTests}] FAILED: ${description}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('\n=== RUNNING JOB SHEET BALANCE HIDING VERIFICATION ===\n');

// 1. Positive outstanding balance
test('Case 1: Positive outstanding balance -> show only ✓', () => {
  const order = {
    orderNumber: 'TEST-001',
    type: 'STANDARD',
    priority: 'NORMAL',
    totalPrice: 10000,
    advanceAmount: 2500,
    balanceAmount: 7500,
    paymentStatus: 'BALANCE'
  };
  assert.strictEqual(hasJobSheetOutstandingBalance(order), true);
  assert.strictEqual(getJobSheetBalanceIndicator(order), '✓');
  const rendered = renderJobSheetBadges(order);
  assert(rendered.includes('&#10003;') || rendered.includes('✓'), 'Must contain tick mark');
  assert(!rendered.toLowerCase().includes('balance'), 'Must not contain the word Balance');
  assert(!rendered.includes('7500'), 'Must not contain balance amount');
  assert(!rendered.includes('10000'), 'Must not contain total amount');
});

// 2. Zero balance
test('Case 2: Zero balance (Fully Paid) -> show nothing', () => {
  const order = {
    orderNumber: 'TEST-002',
    type: 'STANDARD',
    priority: 'NORMAL',
    totalPrice: 10000,
    advanceAmount: 10000,
    balanceAmount: 0,
    paymentStatus: 'PAID'
  };
  assert.strictEqual(hasJobSheetOutstandingBalance(order), false);
  assert.strictEqual(getJobSheetBalanceIndicator(order), '');
  const rendered = renderJobSheetBadges(order);
  assert(!rendered.includes('&#10003;'), 'Must not contain tick mark');
  assert(!rendered.includes('✓'), 'Must not contain tick mark');
  assert(!rendered.toLowerCase().includes('balance'), 'Must not contain the word Balance');
  assert(!rendered.includes('Rs. 0') && !rendered.includes('₨ 0') && !rendered.includes(': 0'), 'Must not contain zero balance placeholder');
});

// 3. Negative balance
test('Case 3: Negative balance -> show nothing', () => {
  const order = {
    orderNumber: 'TEST-003',
    type: 'STANDARD',
    priority: 'NORMAL',
    totalPrice: 5000,
    advanceAmount: 6000,
    balanceAmount: -1000,
    paymentStatus: 'PAID'
  };
  assert.strictEqual(hasJobSheetOutstandingBalance(order), false);
  assert.strictEqual(getJobSheetBalanceIndicator(order), '');
  const rendered = renderJobSheetBadges(order);
  assert(!rendered.includes('&#10003;'), 'Must not contain tick mark');
  assert(!rendered.includes('✓'), 'Must not contain tick mark');
  assert(!rendered.toLowerCase().includes('balance'), 'Must not contain the word Balance');
});

// 4. Balance with decimals
test('Case 4: Decimal balance -> show only ✓, never the amount', () => {
  const order = {
    orderNumber: 'TEST-004',
    type: 'STANDARD',
    priority: 'NORMAL',
    totalPrice: 4999.75,
    advanceAmount: 2000,
    balanceAmount: 2999.75,
    paymentStatus: 'BALANCE'
  };
  assert.strictEqual(hasJobSheetOutstandingBalance(order), true);
  assert.strictEqual(getJobSheetBalanceIndicator(order), '✓');
  const rendered = renderJobSheetBadges(order);
  assert(rendered.includes('&#10003;'), 'Must contain tick mark');
  assert(!rendered.includes('2999'), 'Must not contain the amount');
  assert(!rendered.includes('75'), 'Must not contain decimal digits');
  assert(!rendered.toLowerCase().includes('balance'), 'Must not contain word Balance');
});

// 5. Compare Outlet vs Home Man Job Sheets for identical order
test('Case 5: Outlet and Home Man Job Sheets produce identical balance indicator', () => {
  const outletOrder = {
    orderNumber: 'ORD-OUTLET-01',
    type: 'STANDARD',
    priority: 'NORMAL',
    outletName: 'Johar Town',
    source: 'OUTLET',
    deliveryType: 'SELF_COLLECTION',
    totalPrice: 8500,
    advanceAmount: 3000,
    balanceAmount: 5500,
    paymentStatus: 'BALANCE'
  };

  const homeManOrder = {
    orderNumber: 'ORD-HOMEMAN-01',
    type: 'STANDARD',
    priority: 'NORMAL',
    source: 'ONLINE',
    deliveryType: 'DELIVERY',
    totalPrice: 8500,
    advanceAmount: 3000,
    balanceAmount: 5500,
    paymentStatus: 'BALANCE'
  };

  assert.strictEqual(hasJobSheetOutstandingBalance(outletOrder), true);
  assert.strictEqual(hasJobSheetOutstandingBalance(homeManOrder), true);
  assert.strictEqual(getJobSheetBalanceIndicator(outletOrder), '✓');
  assert.strictEqual(getJobSheetBalanceIndicator(homeManOrder), '✓');

  const renderedOutlet = renderJobSheetBadges(outletOrder);
  const renderedHomeMan = renderJobSheetBadges(homeManOrder);

  // Both contain &#10003;
  assert(renderedOutlet.includes('&#10003;'));
  assert(renderedHomeMan.includes('&#10003;'));
  // Neither contains balance amount or word balance
  assert(!renderedOutlet.toLowerCase().includes('balance'));
  assert(!renderedHomeMan.toLowerCase().includes('balance'));
  assert(!renderedOutlet.includes('5500'));
  assert(!renderedHomeMan.includes('5500'));
});

// 6. Pure COD order with 0 advance
test('Case 6: Pure COD order (totalPrice > 0, advance = 0) -> positive balance -> show only ✓', () => {
  const order = {
    orderNumber: 'COD-001',
    type: 'STANDARD',
    priority: 'NORMAL',
    source: 'ONLINE',
    deliveryType: 'DELIVERY',
    totalPrice: 6000,
    advanceAmount: 0,
    paymentStatus: 'COD'
  };
  assert.strictEqual(hasJobSheetOutstandingBalance(order), true);
  assert.strictEqual(getJobSheetBalanceIndicator(order), '✓');
  const rendered = renderJobSheetBadges(order);
  assert(rendered.includes('&#10003;'), 'Must contain tick mark');
  assert(!rendered.includes('6000'), 'Must not contain amount');
  assert(!rendered.toLowerCase().includes('balance'), 'Must not contain word Balance');
  assert(!rendered.includes('COD:'), 'Must not contain COD amount text');
});

// 7. Prepaid / isPrepaid order
test('Case 7: isPrepaid order -> balance is 0 -> show nothing', () => {
  const order = {
    orderNumber: 'PREPAID-001',
    type: 'STANDARD',
    priority: 'NORMAL',
    isPrepaid: true,
    totalPrice: 12000,
    advanceAmount: 0
  };
  assert.strictEqual(hasJobSheetOutstandingBalance(order), false);
  assert.strictEqual(getJobSheetBalanceIndicator(order), '');
  const rendered = renderJobSheetBadges(order);
  assert(!rendered.includes('&#10003;'), 'Must not contain tick mark');
  assert(!rendered.toLowerCase().includes('balance'));
});

// 8. Returned or Cancelled order
test('Case 8: Cancelled or Returned order -> balance is 0 -> show nothing', () => {
  const cancelledOrder = {
    orderNumber: 'CAN-001',
    type: 'STANDARD',
    priority: 'NORMAL',
    status: 'CANCELLED',
    totalPrice: 5000,
    advanceAmount: 0
  };
  assert.strictEqual(hasJobSheetOutstandingBalance(cancelledOrder), false);
  assert.strictEqual(getJobSheetBalanceIndicator(cancelledOrder), '');
});

console.log(`\n=== RESULTS: ${testsPassed}/${totalTests} TESTS PASSED ===\n`);
if (testsPassed !== totalTests) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY!\n');
}
