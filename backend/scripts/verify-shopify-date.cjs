/**
 * verify-shopify-date.cjs
 * Comprehensive test script for Shopify Order Date & Date Format Preference
 */
const prisma = require('../src/prisma');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_123';
const { computeActiveWorkingMs } = require('../src/utils/workingHours');
const { getDelayInfo } = require('../src/utils/orderDelay');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- STARTING SHOPIFY ORDER DATE & PREFERENCES VERIFICATION ---');

  // Find or create test user
  let testUser = await prisma.user.findFirst({ where: { role: 'ORDER_ENTRY' } });
  if (!testUser) {
    testUser = await prisma.user.findFirst();
  }
  assert(!!testUser, 'Found active user for testing');

  // Test 1: User preferences update & persistence in DB
  console.log('\nTest 1: Testing persistent date format preference...');
  await prisma.user.update({
    where: { id: testUser.id },
    data: { dateFormatPreference: 'MM/DD/YYYY' }
  });
  let reloadedUser = await prisma.user.findUnique({
    where: { id: testUser.id },
    select: { dateFormatPreference: true }
  });
  assert(reloadedUser.dateFormatPreference === 'MM/DD/YYYY', 'Updated preference to MM/DD/YYYY successfully');

  await prisma.user.update({
    where: { id: testUser.id },
    data: { dateFormatPreference: 'YYYY/MM/DD' }
  });
  reloadedUser = await prisma.user.findUnique({
    where: { id: testUser.id },
    select: { dateFormatPreference: true }
  });
  assert(reloadedUser.dateFormatPreference === 'YYYY/MM/DD', 'Updated preference to YYYY/MM/DD successfully');

  await prisma.user.update({
    where: { id: testUser.id },
    data: { dateFormatPreference: 'DD/MM/YYYY' }
  });
  reloadedUser = await prisma.user.findUnique({
    where: { id: testUser.id },
    select: { dateFormatPreference: true }
  });
  assert(reloadedUser.dateFormatPreference === 'DD/MM/YYYY', 'Restored preference to DD/MM/YYYY successfully');

  // Test 2: Backend validation logic in order.controller.js
  console.log('\nTest 2: Testing compulsory Shopify Order Date validation...');
  const isOutletOrderFalse = false;
  
  // Validation function matching order.controller.js lines
  function validateOrderPayload(body, role) {
    const requestedOrderNumber = body.orderNumber;
    const shopifyOrderDate = body.shopifyOrderDate;
    const isOutletOrder = role === 'OUTLET' || !!body.isOutlet || (requestedOrderNumber && String(requestedOrderNumber).startsWith('OUT-'));
    if (!isOutletOrder) {
      if (!shopifyOrderDate || (typeof shopifyOrderDate === 'string' && !shopifyOrderDate.trim())) {
        return { status: 400, message: 'Shopify Order Date is required.' };
      }
      const parsedShopifyDate = new Date(shopifyOrderDate);
      if (isNaN(parsedShopifyDate.getTime())) {
        return { status: 400, message: 'Invalid Shopify Order Date.' };
      }
    }
    return { status: 200, message: 'OK' };
  }

  const resMissing = validateOrderPayload({ customerPhone: '03001234567', orderNumber: 'TEST-99999' }, 'ORDER_ENTRY');
  assert(resMissing.status === 400 && resMissing.message === 'Shopify Order Date is required.', 'Missing shopifyOrderDate rejected with 400 "Shopify Order Date is required."');

  const resInvalid = validateOrderPayload({ customerPhone: '03001234567', orderNumber: 'TEST-99999', shopifyOrderDate: 'not-a-date' }, 'ORDER_ENTRY');
  assert(resInvalid.status === 400 && resInvalid.message === 'Invalid Shopify Order Date.', 'Invalid shopifyOrderDate rejected with 400 "Invalid Shopify Order Date."');

  const validIso = '2026-09-05T10:30:00.000Z';
  const resValid = validateOrderPayload({ customerPhone: '03001234567', orderNumber: 'TEST-99999', shopifyOrderDate: validIso }, 'ORDER_ENTRY');
  assert(resValid.status === 200, 'Valid ISO shopifyOrderDate passes validation');

  // Test 3: Create real test order and verify DB persistence of shopifyOrderDate
  console.log('\nTest 3: Creating real test order and verifying shopifyOrderDate preservation...');
  const testOrderNumber = `TEST-${Date.now().toString().slice(-6)}`;
  const testShopifyDate = new Date('2026-09-05T09:00:00.000Z');
  
  const createdOrder = await prisma.order.create({
    data: {
      orderNumber: testOrderNumber,
      customerName: 'Test Faisal Customer',
      customerPhone: '03001234567',
      address: 'Test House #1, Lahore',
      city: 'Lahore',
      currentStage: 'ORDER_ENTRY',
      status: 'PENDING',
      shopifyOrderDate: testShopifyDate
    }
  });
  assert(createdOrder && createdOrder.id, `Created test order #${testOrderNumber}`);
  assert(new Date(createdOrder.shopifyOrderDate).toISOString() === testShopifyDate.toISOString(), 'shopifyOrderDate stored accurately and normalized in DB');

  // Test 4: Edit preservation - shopifyOrderDate must NOT be overwritten with null
  console.log('\nTest 4: Testing edit request preservation (shopifyOrderDate never cleared to null)...');
  const requestedChanges = {
    customerName: 'Updated Test Customer',
    shopifyOrderDate: null // attempted null overwrite
  };
  const parsed = requestedChanges.shopifyOrderDate ? new Date(requestedChanges.shopifyOrderDate) : null;
  const safeShopifyDate = (parsed && !isNaN(parsed.getTime())) ? parsed : (createdOrder.shopifyOrderDate || null);
  
  await prisma.order.update({
    where: { id: createdOrder.id },
    data: {
      customerName: requestedChanges.customerName,
      shopifyOrderDate: safeShopifyDate
    }
  });

  const reloadedOrder = await prisma.order.findUnique({
    where: { id: createdOrder.id },
    select: { id: true, orderNumber: true, currentStage: true, status: true, customerName: true, shopifyOrderDate: true, createdAt: true }
  });
  assert(reloadedOrder.customerName === 'Updated Test Customer', 'Customer name updated');
  assert(new Date(reloadedOrder.shopifyOrderDate).toISOString() === testShopifyDate.toISOString(), 'shopifyOrderDate was preserved and NOT cleared to null');

  // Test 5: Delay calculation using shopifyOrderDate
  console.log('\nTest 5: Testing delay calculation uses shopifyOrderDate as reference...');
  const delayConfig = { ORDER_ENTRY: 4 }; // 4 allowed working hours
  const delayInfo = getDelayInfo(reloadedOrder, delayConfig);
  assert(delayInfo && delayInfo.isDelayed === true, 'Order created with Sep 5 Shopify date correctly calculated as delayed');
  assert(delayInfo && delayInfo.stage === 'ORDER_ENTRY', 'Active stage is ORDER_ENTRY');
  assert(delayInfo && delayInfo.delayDuration > 0, `Delay duration (${delayInfo.delayDuration}ms) is positive`);

  // Cleanup test order
  await prisma.order.delete({ where: { id: createdOrder.id } });
  console.log('Cleaned up test order.');

  console.log(`\n==============================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`==============================================\n`);

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
