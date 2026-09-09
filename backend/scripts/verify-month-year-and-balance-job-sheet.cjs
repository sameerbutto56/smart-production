const assert = require('assert');
const prisma = require('../src/prisma');
const { normalizeDateOnly } = require('../src/utils/workingHours');

async function runTests() {
  console.log('=== STARTING TESTS: SHOPIFY MONTH/YEAR PERSISTENCE & JOB SHEET BALANCE FIX ===\n');

  // Test 1: User Month & Year Preference DB Storage & Retrieval
  console.log('Test 1: User Month & Year Preference DB Storage & Retrieval');
  const testUser = await prisma.user.findFirst({ where: { role: 'ORDER_ENTRY' } });
  if (!testUser) throw new Error('No ORDER_ENTRY user found to test preferences');

  await prisma.user.update({
    where: { id: testUser.id },
    data: {
      dateFormatPreference: 'DD/MM/YYYY',
      shopifyMonthPreference: 9,
      shopifyYearPreference: 2026
    }
  });

  const reloaded = await prisma.user.findUnique({
    where: { id: testUser.id },
    select: { dateFormatPreference: true, shopifyMonthPreference: true, shopifyYearPreference: true }
  });

  assert.strictEqual(reloaded.dateFormatPreference, 'DD/MM/YYYY', 'Date format preference should match');
  assert.strictEqual(reloaded.shopifyMonthPreference, 9, 'Shopify month preference should be 9 (September)');
  assert.strictEqual(reloaded.shopifyYearPreference, 2026, 'Shopify year preference should be 2026');
  console.log('  ✓ Test 1 Passed: Month=9 and Year=2026 persisted successfully in database\n');

  // Test 2: Date-only Normalization (No time, no timezone drift)
  console.log('Test 2: Date-only Normalization');
  const d1 = normalizeDateOnly('2026-09-05');
  assert(d1 instanceof Date, 'd1 must be a Date');
  assert.strictEqual(d1.toISOString(), '2026-09-05T00:00:00.000Z', 'Must be UTC midnight');

  const d2 = normalizeDateOnly('2026-09-05T14:35:00.000Z');
  assert.strictEqual(d2.toISOString(), '2026-09-05T00:00:00.000Z', 'Time component must be completely stripped');

  const d3 = normalizeDateOnly('2026/09/05');
  assert.strictEqual(d3.toISOString(), '2026-09-05T00:00:00.000Z', 'Slash delimiter must parse to UTC midnight');
  console.log('  ✓ Test 2 Passed: Date-only normalized to 00:00:00.000Z without timezone shift\n');

  // Test 3: Order Creation with PAID paymentStatus
  console.log('Test 3: Order Creation with PAID paymentStatus');
  const paidOrderNo = `TEST-PAID-${Date.now()}`;
  const paidOrder = await prisma.order.create({
    data: {
      orderNumber: paidOrderNo,
      customerName: 'Test Paid Customer',
      customerPhone: '03001234567',
      source: 'OUTLET',
      outletName: 'Johar Town',
      paymentStatus: 'PAID',
      totalPrice: 4500,
      advanceAmount: 0,
      balanceAmount: null,
      shopifyOrderDate: normalizeDateOnly('2026-09-09')
    }
  });

  assert.strictEqual(paidOrder.paymentStatus, 'PAID');
  assert.strictEqual(paidOrder.balanceAmount, null);
  console.log('  ✓ Test 3 Passed: PAID order created without balance amount\n');

  // Test 4: Order Creation with BALANCE paymentStatus & balanceAmount
  console.log('Test 4: Order Creation with BALANCE paymentStatus & balanceAmount');
  const balanceOrderNo = `TEST-BAL-${Date.now()}`;
  const balanceOrder = await prisma.order.create({
    data: {
      orderNumber: balanceOrderNo,
      customerName: 'Test Balance Customer',
      customerPhone: '03009876543',
      source: 'OUTLET',
      outletName: 'Johar Town',
      paymentStatus: 'BALANCE',
      totalPrice: 5000,
      advanceAmount: 3800,
      balanceAmount: 1200,
      shopifyOrderDate: normalizeDateOnly('2026-09-09')
    }
  });

  assert.strictEqual(balanceOrder.paymentStatus, 'BALANCE');
  assert.strictEqual(balanceOrder.balanceAmount, 1200);
  console.log('  ✓ Test 4 Passed: BALANCE order created with balanceAmount=1200\n');

  // Test 5: Edit Request & Verification updates preserve balanceAmount & paymentStatus
  console.log('Test 5: Verification & Edit updates preserve balanceAmount');
  const updatedBalOrder = await prisma.order.update({
    where: { id: balanceOrder.id },
    data: {
      paymentStatus: 'BALANCE',
      balanceAmount: 1500,
      shopifyOrderDate: normalizeDateOnly('2026-08-15')
    }
  });
  assert.strictEqual(updatedBalOrder.paymentStatus, 'BALANCE');
  assert.strictEqual(updatedBalOrder.balanceAmount, 1500);
  assert.strictEqual(updatedBalOrder.shopifyOrderDate.toISOString(), '2026-08-15T00:00:00.000Z');
  console.log('  ✓ Test 5 Passed: Balance update and normalized shopifyOrderDate preserved\n');

  // Clean up test orders
  await prisma.order.deleteMany({
    where: { id: { in: [paidOrder.id, balanceOrder.id] } }
  });
  console.log('  ✓ Cleaned up test orders');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests()
  .catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
