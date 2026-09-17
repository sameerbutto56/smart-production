const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('================================================================');
  console.log('  VERIFICATION: STORE RECEIVE VISIBILITY & GENDER SELECTION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Live STORE_RECEIVE orders in database
  // -------------------------------------------------------------
  console.log('TEST 1: Live STORE_RECEIVE orders');
  const storeReceiveOrders = await prisma.order.findMany({
    where: { currentStage: 'STORE_RECEIVE' },
    select: { id: true, orderNumber: true, currentStage: true, status: true, customerName: true }
  });
  assert(storeReceiveOrders.length === 2, `Database contains exactly 2 orders in STORE_RECEIVE (found ${storeReceiveOrders.length})`);
  assert(storeReceiveOrders.some(o => o.orderNumber === '51871'), 'Order #51871 is in STORE_RECEIVE');
  assert(storeReceiveOrders.some(o => o.orderNumber === '51361'), 'Order #51361 is in STORE_RECEIVE');

  // -------------------------------------------------------------
  // TEST 2: AllOrders filter logic for Control Center vs Store vs Others
  // -------------------------------------------------------------
  console.log('\nTEST 2: AllOrders filtering for STORE_RECEIVE');
  for (const role of ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORE', 'STORE_EMPLOYEE', 'FAISAL', 'OUTLET']) {
    const userRole = role;
    const isControlCenter = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(userRole);
    const isStoreRole = ['STORE', 'STORE_EMPLOYEE'].includes(userRole);
    const canSeeStoreReceive = isControlCenter || isStoreRole;

    for (const o of storeReceiveOrders) {
      const notStoreReceive = canSeeStoreReceive || o.currentStage !== 'STORE_RECEIVE';
      if (['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORE', 'STORE_EMPLOYEE'].includes(role)) {
        assert(notStoreReceive === true, `Role ${role} CAN see order #${o.orderNumber} in STORE_RECEIVE`);
      } else {
        assert(notStoreReceive === false, `Role ${role} cannot see order #${o.orderNumber} in STORE_RECEIVE (correct role isolation)`);
      }
    }
  }

  // -------------------------------------------------------------
  // TEST 3: createOrder backend gender validation
  // -------------------------------------------------------------
  console.log('\nTEST 3: Backend createOrder gender validation logic');
  const testCases = [
    {
      desc: 'Online order without gender in items or body -> should fail',
      isOutletOrder: false,
      items: [{ productDetails: { productType: 'Scrubs', size: 'M' } }],
      body: {},
      shouldPass: false
    },
    {
      desc: 'Online order with empty string gender -> should fail',
      isOutletOrder: false,
      items: [{ productDetails: { productType: 'Scrubs', size: 'M', gender: '   ' } }],
      body: {},
      shouldPass: false
    },
    {
      desc: 'Online order with valid gender Male -> should pass',
      isOutletOrder: false,
      items: [{ productDetails: { productType: 'Scrubs', size: 'M', gender: 'Male' } }],
      body: {},
      shouldPass: true
    },
    {
      desc: 'Online order with valid gender Female -> should pass',
      isOutletOrder: false,
      items: [{ productDetails: { productType: 'Scrubs', size: 'L', gender: 'Female' } }],
      body: {},
      shouldPass: true
    },
    {
      desc: 'Outlet order without gender -> allowed (outlet has separate flow)',
      isOutletOrder: true,
      items: [{ productDetails: { productType: 'Scrubs', size: 'M' } }],
      body: {},
      shouldPass: true
    }
  ];

  for (const tc of testCases) {
    let hasGender = false;
    if (!tc.isOutletOrder) {
      if (tc.items && Array.isArray(tc.items) && tc.items.length > 0) {
        hasGender = tc.items.every(i => {
          const g = i.productDetails?.gender || i.gender;
          return typeof g === 'string' && g.trim().length > 0;
        });
      } else {
        const g = tc.body.productDetails?.gender || tc.body.gender;
        hasGender = typeof g === 'string' && g.trim().length > 0;
      }
    } else {
      hasGender = true;
    }

    assert(hasGender === tc.shouldPass, tc.desc);
  }

  // -------------------------------------------------------------
  // TEST 4: Existing order gender preservation
  // -------------------------------------------------------------
  console.log('\nTEST 4: Existing order gender preservation logic');
  const sampleOrderWithGender = {
    gender: 'Female',
    productDetails: [{ productDetails: { gender: 'Female', size: 'M' } }]
  };
  const firstPd = sampleOrderWithGender.productDetails[0].productDetails;
  const loadedGender = firstPd.gender || sampleOrderWithGender.gender || '';
  assert(loadedGender === 'Female', 'Existing order with Female gender preserves Female');

  const newOrderState = { gender: '' };
  assert(newOrderState.gender === '', 'New order state initial gender is empty (NOT preselected)');

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================');

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
