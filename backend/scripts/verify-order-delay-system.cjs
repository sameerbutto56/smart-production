const assert = require('assert');
const {
  computeWorkingMs,
  computeWorkingHours,
  computeWorkingDeadline,
  toPktParts
} = require('../src/utils/workingHours');
const {
  getDelayInfo,
  attachDelayInfoToOrders,
  DEFAULT_DELAY_CONFIG,
  STAGE_LABELS,
  STAGE_CONFIG_MAP
} = require('../src/utils/orderDelay');

console.log('=== VERIFYING ORDER DELAY SYSTEM ===\n');

// --- TEST 1: computeWorkingDeadline ---
console.log('1. Testing computeWorkingDeadline (PKT 9AM-7PM, Mon-Sat, Sunday closed)...');
{
  // Monday 2026-09-07 10:00 AM PKT = 2026-09-07 05:00:00 UTC
  const monday10AmUtc = new Date('2026-09-07T05:00:00.000Z').getTime();
  const deadline4h = computeWorkingDeadline(monday10AmUtc, 4);
  const deadlineDate = new Date(deadline4h);
  // Should be Monday 2:00 PM PKT = 09:00:00 UTC
  assert.strictEqual(deadlineDate.toISOString(), '2026-09-07T09:00:00.000Z', 'Monday 10am + 4h working deadline must be Monday 2pm PKT');
  console.log('   ✓ Monday 10:00 AM PKT + 4h -> Monday 2:00 PM PKT (same-day working hours)');

  // Saturday 2026-09-12 5:00 PM PKT (2h left on Saturday before 7pm close)
  // Saturday 5:00 PM PKT = 2026-09-12 12:00:00 UTC
  // Allowed 4h: 2h on Saturday (5pm-7pm), Sunday closed, remaining 2h on Monday (9am-11am PKT)
  // Monday 11:00 AM PKT = 2026-09-14 06:00:00 UTC
  const sat5pmUtc = new Date('2026-09-12T12:00:00.000Z').getTime();
  const deadlineSat4h = computeWorkingDeadline(sat5pmUtc, 4);
  const satDeadlineDate = new Date(deadlineSat4h);
  assert.strictEqual(satDeadlineDate.toISOString(), '2026-09-14T06:00:00.000Z', 'Saturday 5pm + 4h working deadline must bridge Sunday to Monday 11am PKT');
  console.log('   ✓ Saturday 5:00 PM PKT + 4h -> Monday 11:00 AM PKT (bridges Sunday weekend boundary)');
}

// --- TEST 2: ORDER_ENTRY Delay using shopifyOrderDate ---
console.log('\n2. Testing ORDER_ENTRY delay with shopifyOrderDate...');
{
  // Now = Monday 2026-09-07 2:00 PM PKT = 09:00:00 UTC
  const nowMs = new Date('2026-09-07T09:00:00.000Z').getTime();
  
  // Order placed on Shopify on Friday 2026-09-04 10:00 AM PKT (more than 4 working hours ago)
  const delayedOrder = {
    id: 'ord-1',
    orderNumber: '50001',
    currentStage: 'ORDER_ENTRY',
    status: 'PENDING',
    shopifyOrderDate: '2026-09-04T05:00:00.000Z',
    createdAt: new Date('2026-09-07T08:00:00.000Z'), // Created in system 1 hour ago
    stages: [{ stageName: 'ORDER_ENTRY', status: 'PENDING', createdAt: new Date('2026-09-07T08:00:00.000Z') }]
  };

  const delayInfo = getDelayInfo(delayedOrder, DEFAULT_DELAY_CONFIG, null, null, nowMs);
  assert.ok(delayInfo, 'Order with older shopifyOrderDate must be detected as delayed');
  assert.strictEqual(delayInfo.isDelayed, true);
  assert.strictEqual(delayInfo.stage, 'ORDER_ENTRY');
  assert.ok(delayInfo.delayDuration > 0, 'delayDuration must be > 0');
  console.log(`   ✓ Delayed Order Entry detected: ${delayInfo.reason}, delayed by ${(delayInfo.delayDuration / 3600000).toFixed(1)} working hours`);

  // Fresh order placed 1 hour ago
  const freshOrder = {
    id: 'ord-2',
    orderNumber: '50002',
    currentStage: 'ORDER_ENTRY',
    status: 'PENDING',
    shopifyOrderDate: '2026-09-07T08:00:00.000Z', // 1 working hour ago
    createdAt: new Date('2026-09-07T08:00:00.000Z'),
    stages: [{ stageName: 'ORDER_ENTRY', status: 'PENDING', createdAt: new Date('2026-09-07T08:00:00.000Z') }]
  };

  const freshDelayInfo = getDelayInfo(freshOrder, DEFAULT_DELAY_CONFIG, null, null, nowMs);
  assert.strictEqual(freshDelayInfo, null, 'Fresh order within allowed hours must return null');
  console.log('   ✓ Fresh Order Entry order is on time (returns null)');
}

// --- TEST 3: RETURN_VERIFICATION Phase Delay ---
console.log('\n3. Testing RETURN_VERIFICATION delay...');
{
  const nowMs = new Date('2026-09-07T09:00:00.000Z').getTime(); // Monday 2pm PKT
  // Returned from verification on Monday 9:00 AM PKT (5 hours ago, threshold 4h)
  const returnedOrder = {
    id: 'ord-3',
    orderNumber: '50003',
    currentStage: 'ORDER_ENTRY',
    status: 'PENDING',
    goForVerification: true,
    verifiedAt: null,
    verificationReturnedAt: new Date('2026-09-07T04:00:00.000Z'), // Monday 9:00 AM PKT = 04:00 UTC
    createdAt: new Date('2026-09-01T05:00:00.000Z'),
    stages: [{ stageName: 'ORDER_ENTRY', status: 'PENDING', createdAt: new Date('2026-09-01T05:00:00.000Z') }]
  };

  const delayInfo = getDelayInfo(returnedOrder, DEFAULT_DELAY_CONFIG, null, null, nowMs);
  assert.ok(delayInfo, 'Order returned from verification past threshold must be delayed');
  assert.strictEqual(delayInfo.stage, 'RETURN_VERIFICATION');
  assert.strictEqual(delayInfo.department, 'Return from Verification');
  console.log(`   ✓ RETURN_VERIFICATION detected correctly: ${delayInfo.reason} (stage: ${delayInfo.stage})`);
}

// --- TEST 4: Dynamic Reconfiguration from Software Settings ---
console.log('\n4. Testing dynamic threshold adjustment via delayConfig...');
{
  const nowMs = new Date('2026-09-07T09:00:00.000Z').getTime(); // Monday 2pm PKT
  // Store order arrived at 11:00 AM PKT (3 working hours ago)
  const storeOrder = {
    id: 'ord-4',
    orderNumber: '50004',
    currentStage: 'STORE',
    status: 'PENDING',
    createdAt: new Date('2026-09-07T06:00:00.000Z'),
    stages: [{ stageName: 'STORE', status: 'PENDING', createdAt: new Date('2026-09-07T06:00:00.000Z') }]
  };

  // With standard STORE allowed hours = 24 -> NOT delayed
  const standardCheck = getDelayInfo(storeOrder, DEFAULT_DELAY_CONFIG, null, null, nowMs);
  assert.strictEqual(standardCheck, null, '3 hours in Store with 24h limit should NOT be delayed');

  // Admin changes STORE allowed hours to 2 in Software Settings -> IMMEDIATELY DELAYED
  const customConfig = { ...DEFAULT_DELAY_CONFIG, STORE: 2 };
  const customCheck = getDelayInfo(storeOrder, customConfig, null, null, nowMs);
  assert.ok(customCheck, 'Order must immediately become delayed when limit reduced below elapsed time');
  assert.strictEqual(customCheck.isDelayed, true);
  assert.strictEqual(customCheck.stage, 'STORE');
  console.log('   ✓ Dynamically reflects updated threshold: 3h in Store with 24h limit = ON TIME, with 2h limit = DELAYED');
}

// --- TEST 5: attachDelayInfoToOrders bulk attachment ---
console.log('\n5. Testing attachDelayInfoToOrders...');
{
  const nowMs = new Date('2026-09-07T09:00:00.000Z').getTime();
  const orders = [
    {
      id: 'ord-5',
      currentStage: 'VERIFICATION',
      status: 'PENDING',
      createdAt: new Date('2026-09-07T04:00:00.000Z'), // 5h ago (allowed 4h)
      stages: [{ stageName: 'VERIFICATION', status: 'PENDING', createdAt: new Date('2026-09-07T04:00:00.000Z') }]
    },
    {
      id: 'ord-6',
      currentStage: 'STORE',
      status: 'PENDING',
      createdAt: new Date('2026-09-07T08:00:00.000Z'), // 1h ago (allowed 24h)
      stages: [{ stageName: 'STORE', status: 'PENDING', createdAt: new Date('2026-09-07T08:00:00.000Z') }]
    }
  ];

  attachDelayInfoToOrders(orders, DEFAULT_DELAY_CONFIG);
  assert.ok(orders[0].delayInfo, 'Overdue verification order must have delayInfo');
  assert.strictEqual(orders[0].delayInfo.isDelayed, true);
  assert.strictEqual(orders[1].delayInfo, null, 'On-time store order must have delayInfo: null');
  console.log('   ✓ attachDelayInfoToOrders properly attached delayInfo to array');
}

console.log('\n>>> ALL 5 ORDER DELAY SYSTEM TESTS PASSED SUCCESSFULLY! <<<\n');
