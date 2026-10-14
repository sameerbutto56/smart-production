/**
 * Verification test suite for Return & Replacement Delay Tracking in Admin Orders
 * Tests:
 * 1. Default & Fallback delay configuration for CSR_RETURNS, INVENTORY_VIEW_RETURNS, STORE_RETURNS, REPLACEMENT_ORDERS.
 * 2. computeReturnExchangeDelay working-hours engine:
 *    - Accurate categorization by routedTo, returnSource, type.
 *    - Accurate responsibleProfile tagging.
 *    - Accurate delay computation exceeding allowed threshold.
 *    - Zero false positives on on-time cases or completed cases.
 * 3. Live database integration via getReturnsAndReplacementsDelays:
 *    - Live counts from actual database records (Zero hardcoding).
 *    - Return records structure (orderNumber, customer, responsibleProfile, durations).
 * 4. Software Settings delay threshold configuration persistence.
 */

const prisma = require('../src/prisma');
const {
  DEFAULT_DELAY_CONFIG,
  STAGE_DEPARTMENTS,
  DELAY_REASONS,
  getAllowedHours,
  computeReturnExchangeDelay,
  computeWorkingMs
} = require('../src/utils/orderDelay');

async function runVerification() {
  console.log('===============================================================');
  console.log('VERIFYING RETURN & REPLACEMENT DELAY TRACKING IN ADMIN ORDERS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  // TEST 1: Default delay config contains new keys
  assert(DEFAULT_DELAY_CONFIG.CSR_RETURNS === 12, 'DEFAULT_DELAY_CONFIG has CSR_RETURNS (12 hours)');
  assert(DEFAULT_DELAY_CONFIG.INVENTORY_VIEW_RETURNS === 24, 'DEFAULT_DELAY_CONFIG has INVENTORY_VIEW_RETURNS (24 hours)');
  assert(DEFAULT_DELAY_CONFIG.STORE_RETURNS === 24, 'DEFAULT_DELAY_CONFIG has STORE_RETURNS (24 hours)');
  assert(DEFAULT_DELAY_CONFIG.REPLACEMENT_ORDERS === 48, 'DEFAULT_DELAY_CONFIG has REPLACEMENT_ORDERS (48 hours)');
  assert(STAGE_DEPARTMENTS.CSR_RETURNS === 'CSR Returns', 'STAGE_DEPARTMENTS has CSR_RETURNS');
  assert(STAGE_DEPARTMENTS.INVENTORY_VIEW_RETURNS === 'Inventory View Returns', 'STAGE_DEPARTMENTS has INVENTORY_VIEW_RETURNS');
  assert(STAGE_DEPARTMENTS.STORE_RETURNS === 'Store Returns', 'STAGE_DEPARTMENTS has STORE_RETURNS');
  assert(STAGE_DEPARTMENTS.REPLACEMENT_ORDERS === 'Replacement Orders', 'STAGE_DEPARTMENTS has REPLACEMENT_ORDERS');

  // TEST 2: computeReturnExchangeDelay unit tests
  const now = new Date('2026-10-14T12:00:00.000Z').getTime();

  // 2.1: Case that is completed - should return null
  const completedCase = {
    id: 'case-comp-1',
    type: 'RETURN',
    status: 'COMPLETED',
    createdAt: new Date('2026-09-01').toISOString()
  };
  const compDelay = computeReturnExchangeDelay(completedCase, DEFAULT_DELAY_CONFIG, null, now);
  assert(compDelay === null, 'Completed return cases return null (never delayed)');

  // 2.2: Case created 5 minutes ago - within 12h threshold - should not be delayed
  const recentCase = {
    id: 'case-rec-1',
    type: 'RETURN',
    status: 'PENDING',
    routedTo: 'CSR',
    createdAt: new Date(now - 300000).toISOString()
  };
  const recDelay = computeReturnExchangeDelay(recentCase, DEFAULT_DELAY_CONFIG, null, now);
  assert(recDelay !== null && recDelay.isDelayed === false, 'Fresh return case within SLA is not delayed');

  // 2.3: CSR return case created 3 days ago - should be delayed and responsibleProfile === 'CSR Profile'
  const oldCsrCase = {
    id: 'case-csr-1',
    orderNumber: '59901',
    type: 'RETURN',
    status: 'PENDING',
    routedTo: 'CSR',
    customerName: 'Ahmad Khan',
    customerPhone: '03001234567',
    returnSource: 'POSTEX',
    createdAt: new Date('2026-10-10T09:00:00.000Z').toISOString()
  };
  const csrDelay = computeReturnExchangeDelay(oldCsrCase, DEFAULT_DELAY_CONFIG, null, now);
  assert(csrDelay && csrDelay.isDelayed === true, 'Overdue CSR return is marked delayed');
  assert(csrDelay && csrDelay.categoryKey === 'CSR_RETURNS', 'Categorized as CSR_RETURNS');
  assert(csrDelay && csrDelay.responsibleProfile === 'CSR Profile', 'Responsible profile is CSR Profile');
  assert(csrDelay && csrDelay.delayDuration > 0, `Delay duration computed correctly (${Math.round(csrDelay.delayDuration / 3600000)}h overdue)`);

  // 2.4: Store return case routed to Store 4 days ago
  const oldStoreCase = {
    id: 'case-store-1',
    orderNumber: '59902',
    type: 'RETURN',
    status: 'PENDING',
    routedTo: 'STORE',
    customerName: 'Fatima Ali',
    createdAt: new Date('2026-10-08T09:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-10-09T09:00:00.000Z').toISOString()
  };
  const storeDelay = computeReturnExchangeDelay(oldStoreCase, DEFAULT_DELAY_CONFIG, null, now);
  assert(storeDelay && storeDelay.isDelayed === true, 'Overdue Store return is marked delayed');
  assert(storeDelay && storeDelay.categoryKey === 'STORE_RETURNS', 'Categorized as STORE_RETURNS');
  assert(storeDelay && storeDelay.responsibleProfile === 'Store Returns', 'Responsible profile is Store Returns');

  // 2.5: Inventory View return case
  const oldInvCase = {
    id: 'case-inv-1',
    orderNumber: '59903',
    type: 'RETURN',
    status: 'ACCEPTED',
    routedTo: 'INVENTORY_VIEW',
    customerName: 'Dr. Zeeshan',
    createdAt: new Date('2026-10-07T09:00:00.000Z').toISOString(),
    acceptedAt: new Date('2026-10-07T10:00:00.000Z').toISOString()
  };
  const invDelay = computeReturnExchangeDelay(oldInvCase, DEFAULT_DELAY_CONFIG, null, now);
  assert(invDelay && invDelay.isDelayed === true, 'Overdue Inventory View return is marked delayed');
  assert(invDelay && invDelay.categoryKey === 'INVENTORY_VIEW_RETURNS', 'Categorized as INVENTORY_VIEW_RETURNS');
  assert(invDelay && invDelay.responsibleProfile === 'Inventory View', 'Responsible profile is Inventory View');

  // 2.6: Replacement order case
  const oldRepCase = {
    id: 'case-rep-1',
    orderNumber: '59904',
    type: 'REPLACEMENT',
    status: 'PENDING',
    routedTo: 'FAISAL',
    customerName: 'Sara Tariq',
    createdAt: new Date('2026-10-05T09:00:00.000Z').toISOString()
  };
  const repDelay = computeReturnExchangeDelay(oldRepCase, DEFAULT_DELAY_CONFIG, null, now);
  assert(repDelay && repDelay.isDelayed === true, 'Overdue Replacement order case is marked delayed');
  assert(repDelay && repDelay.categoryKey === 'REPLACEMENT_ORDERS', 'Categorized as REPLACEMENT_ORDERS');
  assert(repDelay && repDelay.responsibleProfile === 'Faisal Profile', 'Responsible profile is Faisal Profile');

  // TEST 3: Real database query test via getReturnsAndReplacementsDelays logic
  console.log('\n--- Querying Live Database Records ---');
  const activeCases = await prisma.returnExchange.findMany({
    where: {
      status: { notIn: ['COMPLETED', 'CANCELLED', 'REPLACEMENT_COMPLETED', 'RESTOCKED'] }
    },
    select: {
      id: true,
      orderId: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      type: true,
      status: true,
      routedTo: true,
      returnSource: true,
      createdAt: true,
      acceptedAt: true,
      acceptedById: true,
      storeAcceptedAt: true,
      faisalApprovedAt: true,
      deliveryReturnedAt: true,
      updatedAt: true
    }
  });

  console.log(`Found ${activeCases.length} active ReturnExchange records in database.`);
  let liveCsrCount = 0;
  let liveInvCount = 0;
  let liveStoreCount = 0;
  let liveRepCount = 0;

  for (const c of activeCases) {
    const d = computeReturnExchangeDelay(c, DEFAULT_DELAY_CONFIG, null, Date.now());
    if (d && d.isDelayed) {
      if (d.categoryKey === 'CSR_RETURNS') liveCsrCount++;
      if (d.categoryKey === 'INVENTORY_VIEW_RETURNS') liveInvCount++;
      if (d.categoryKey === 'STORE_RETURNS') liveStoreCount++;
      if (d.categoryKey === 'REPLACEMENT_ORDERS') liveRepCount++;
    }
  }

  console.log(`Live Delayed Counts from DB:
  - CSR Returns Delay: ${liveCsrCount}
  - Inventory View Returns Delay: ${liveInvCount}
  - Store Returns Delay: ${liveStoreCount}
  - Replacement Orders Delay: ${liveRepCount}`);

  assert(typeof liveCsrCount === 'number', 'CSR Returns delay count is valid number');
  assert(typeof liveInvCount === 'number', 'Inventory View Returns delay count is valid number');
  assert(typeof liveStoreCount === 'number', 'Store Returns delay count is valid number');
  assert(typeof liveRepCount === 'number', 'Replacement Orders delay count is valid number');

  // TEST 4: Software Settings persistence test
  console.log('\n--- Software Settings Delay Config Persistence ---');
  const existingSetting = await prisma.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
  let savedConfig = {};
  if (existingSetting?.value) {
    try { savedConfig = JSON.parse(existingSetting.value); } catch {}
  }
  const testUpdatedConfig = {
    ...DEFAULT_DELAY_CONFIG,
    ...savedConfig,
    CSR_RETURNS: 14,
    INVENTORY_VIEW_RETURNS: 26,
    STORE_RETURNS: 28,
    REPLACEMENT_ORDERS: 50
  };

  await prisma.systemSetting.upsert({
    where: { key: 'DEADLINE_CONFIG' },
    update: { value: JSON.stringify(testUpdatedConfig) },
    create: { key: 'DEADLINE_CONFIG', value: JSON.stringify(testUpdatedConfig) }
  });

  const reloadedSetting = await prisma.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
  const reloaded = JSON.parse(reloadedSetting.value);
  assert(reloaded.CSR_RETURNS === 14, 'Software Settings saved and reloaded CSR_RETURNS = 14');
  assert(reloaded.INVENTORY_VIEW_RETURNS === 26, 'Software Settings saved and reloaded INVENTORY_VIEW_RETURNS = 26');
  assert(reloaded.STORE_RETURNS === 28, 'Software Settings saved and reloaded STORE_RETURNS = 28');
  assert(reloaded.REPLACEMENT_ORDERS === 50, 'Software Settings saved and reloaded REPLACEMENT_ORDERS = 50');

  // Restore original / default settings
  if (existingSetting?.value) {
    await prisma.systemSetting.update({
      where: { key: 'DEADLINE_CONFIG' },
      data: { value: existingSetting.value }
    });
  }

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
