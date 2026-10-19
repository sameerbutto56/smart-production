/**
 * Comprehensive Verification Test Suite:
 * Multi-Phone Number, Name & Address-Based Customer Search & Duplicate Detection
 */
const prisma = require('../src/prisma');
const clientController = require('../src/controllers/client.controller');
const outletOrderController = require('../src/controllers/outletOrder.controller');

// Mock response object
const mockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
};

async function runTests() {
  console.log('--- STARTING MULTI-PHONE & ADDRESS SEARCH TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const testSuffix = Math.floor(100000 + Math.random() * 900000);
  const testPhonePrimary = `0300${testSuffix}`;
  const testPhoneAlt1 = `0312${testSuffix}`;
  const testPhoneAlt2 = `0321${testSuffix}`;
  const testCustomerName = `Dr. MultiPhone Test-${testSuffix}`;
  const testAddress = `House 45, Sector B, DHA Phase 5, Lahore ${testSuffix}`;

  let createdClientId = null;
  let createdClientNumber = null;
  let sharedClientId = null;
  let testOrderId = null;

  try {
    // TEST 1: Register customer with 1 primary and 2 additional phones and address
    console.log('\n[Test 1: Register customer with multi-phones & address]');
    const req1 = {
      user: { id: 'test-admin', name: 'Jail Road User', role: 'ADMIN' },
      body: {
        name: testCustomerName,
        gender: 'Male',
        phone: testPhonePrimary,
        additionalPhones: [testPhoneAlt1, testPhoneAlt2],
        permanentAddress: testAddress,
        deliveryAddresses: [`Clinic #3, Shadman, Jail Road ${testSuffix}`],
        city: 'Lahore',
        outletName: 'Jail Road',
        standardSizes: ['L', 'XL'],
        customMeasurements: { chest: '42.5', waist: '36' },
        sizeDetails: JSON.stringify({ chest: '42.5', waist: '36' })
      }
    };
    const res1 = mockRes();
    await clientController.createClient(req1, res1);
    assert(res1.statusCode === 201, 'Client created successfully with HTTP 201');
    assert(res1.data && res1.data.id, 'Client ID generated');
    assert(res1.data.phone === testPhonePrimary, 'Primary phone saved');
    assert(Array.isArray(res1.data.additionalPhones) && res1.data.additionalPhones.length === 2, '2 additional phones saved');
    createdClientId = res1.data.id;
    createdClientNumber = res1.data.clientNumber;

    // Create a mock order placed under testPhoneAlt1 (alternate phone) to verify order history linking
    const testOrder = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-${testSuffix}`,
        customerName: testCustomerName,
        customerPhone: testPhoneAlt1,
        totalPrice: 4500,
        currentStage: 'COMPLETED',
        status: 'DELIVERED',
        outletName: 'Jail Road',
        productDetails: [{ name: 'Scrub Set', quantity: 1, unitPrice: 4500 }]
      }
    });
    testOrderId = testOrder.id;

    // TEST 2: Search by Primary Phone (formatted with dashes & country code)
    console.log('\n[Test 2: Search by Primary Phone variations]');
    const searchVariants = [
      testPhonePrimary,
      `+92 ${testPhonePrimary.slice(1, 4)} ${testPhonePrimary.slice(4)}`,
      `${testPhonePrimary.slice(0, 4)}-${testPhonePrimary.slice(4)}`,
      testPhonePrimary.slice(1) // without leading zero: 300...
    ];
    for (const qPhone of searchVariants) {
      const reqSearch = { query: { q: qPhone, allOutlets: 'true' } };
      const resSearch = mockRes();
      await clientController.searchClients(reqSearch, resSearch);
      assert(
        Array.isArray(resSearch.data) && resSearch.data.some(c => c.id === createdClientId),
        `Search query '${qPhone}' matched customer profile by primary phone`
      );
    }

    // TEST 3: Search by Additional Phone 1 (formatted & unformatted)
    console.log('\n[Test 3: Search by Additional Phone 1]');
    const alt1Variants = [
      testPhoneAlt1,
      `${testPhoneAlt1.slice(0, 4)}-${testPhoneAlt1.slice(4)}`,
      testPhoneAlt1.slice(1)
    ];
    for (const qAlt of alt1Variants) {
      const reqSearch = { query: { q: qAlt, allOutlets: 'true' } };
      const resSearch = mockRes();
      await clientController.searchClients(reqSearch, resSearch);
      assert(
        Array.isArray(resSearch.data) && resSearch.data.some(c => c.id === createdClientId),
        `Search query '${qAlt}' matched customer profile via additional phone 1`
      );
    }

    // TEST 4: Search by Additional Phone 2
    console.log('\n[Test 4: Search by Additional Phone 2]');
    const reqSearchAlt2 = { query: { q: testPhoneAlt2, allOutlets: 'true' } };
    const resSearchAlt2 = mockRes();
    await clientController.searchClients(reqSearchAlt2, resSearchAlt2);
    assert(
      Array.isArray(resSearchAlt2.data) && resSearchAlt2.data.some(c => c.id === createdClientId),
      `Search query '${testPhoneAlt2}' matched customer profile via additional phone 2`
    );

    // TEST 5: Search by Customer Name (Full & Case-Insensitive)
    console.log('\n[Test 5: Search by Customer Name]');
    const reqSearchName = { query: { q: testCustomerName.toLowerCase(), allOutlets: 'true' } };
    const resSearchName = mockRes();
    await clientController.searchClients(reqSearchName, resSearchName);
    assert(
      Array.isArray(resSearchName.data) && resSearchName.data.some(c => c.id === createdClientId),
      `Full case-insensitive name '${testCustomerName.toLowerCase()}' returned matching customer`
    );

    // TEST 6: Search by Multi-Word Name Tokens (e.g. out-of-order words)
    console.log('\n[Test 6: Search by Multi-Word Name Tokens]');
    const tokenQuery = `Test-${testSuffix} MultiPhone`;
    const reqSearchToken = { query: { q: tokenQuery, allOutlets: 'true' } };
    const resSearchToken = mockRes();
    await clientController.searchClients(reqSearchToken, resSearchToken);
    assert(
      Array.isArray(resSearchToken.data) && resSearchToken.data.some(c => c.id === createdClientId),
      `Multi-word query '${tokenQuery}' returned matching customer`
    );

    // TEST 7: Search by Address (Area / Locality / Street fragment)
    console.log('\n[Test 7: Search by Address fragment]');
    const addressFragment = `DHA Phase 5 ${testSuffix}`;
    const reqSearchAddress = { query: { q: addressFragment, allOutlets: 'true' } };
    const resSearchAddress = mockRes();
    await clientController.searchClients(reqSearchAddress, resSearchAddress);
    assert(
      Array.isArray(resSearchAddress.data) && resSearchAddress.data.some(c => c.id === createdClientId),
      `Address query '${addressFragment}' returned matching customer`
    );

    // TEST 8: Search by Delivery Address fragment
    console.log('\n[Test 8: Search by Delivery Address fragment]');
    const deliveryFragment = `Shadman ${testSuffix}`;
    const reqSearchDelivery = { query: { q: deliveryFragment, allOutlets: 'true' } };
    const resSearchDelivery = mockRes();
    await clientController.searchClients(reqSearchDelivery, resSearchDelivery);
    assert(
      Array.isArray(resSearchDelivery.data) && resSearchDelivery.data.some(c => c.id === createdClientId),
      `Delivery address query '${deliveryFragment}' returned matching customer`
    );

    // TEST 9: Search by Client Number (with and without #)
    console.log('\n[Test 9: Search by Client Number]');
    for (const cNumQuery of [createdClientNumber, `#${createdClientNumber}`]) {
      const reqSearchCNum = { query: { q: cNumQuery, allOutlets: 'true' } };
      const resSearchCNum = mockRes();
      await clientController.searchClients(reqSearchCNum, resSearchCNum);
      assert(
        Array.isArray(resSearchCNum.data) && resSearchCNum.data.some(c => c.id === createdClientId),
        `Client number query '${cNumQuery}' returned matching customer`
      );
    }

    // TEST 10: Cross-Outlet Search
    console.log('\n[Test 10: Cross-Outlet Search]');
    // Search with outlet = 'Johar Town', but customer is registered at 'Jail Road'
    const reqCross1 = { query: { q: testPhonePrimary, outlet: 'Johar Town', allOutlets: 'false' } };
    const resCross1 = mockRes();
    await clientController.searchClients(reqCross1, resCross1);
    assert(
      Array.isArray(resCross1.data) && !resCross1.data.some(c => c.id === createdClientId),
      'Strict branch filter excludes client from other outlet'
    );

    const reqCross2 = { query: { q: testPhonePrimary, allOutlets: 'true' } };
    const resCross2 = mockRes();
    await clientController.searchClients(reqCross2, resCross2);
    assert(
      Array.isArray(resCross2.data) && resCross2.data.some(c => c.id === createdClientId && c.outletName === 'Jail Road'),
      'Cross-branch search finds Jail Road customer from any outlet'
    );

    // TEST 11: POS Order Entry Lookup (`lookupClientByNumber`)
    console.log('\n[Test 11: POS Order Entry lookupClientByNumber]');
    // Lookup by alternate phone
    const reqPosAlt = { query: { q: testPhoneAlt1 } };
    const resPosAlt = mockRes();
    await outletOrderController.lookupClientByNumber(reqPosAlt, resPosAlt);
    assert(resPosAlt.statusCode === 200, 'POS lookup returned HTTP 200');
    assert(
      Array.isArray(resPosAlt.data?.clients) && resPosAlt.data.clients.some(e => e.client.id === createdClientId),
      'POS lookup found customer by alternate phone'
    );

    // Lookup by address
    const reqPosAddr = { query: { q: addressFragment } };
    const resPosAddr = mockRes();
    await outletOrderController.lookupClientByNumber(reqPosAddr, resPosAddr);
    assert(
      Array.isArray(resPosAddr.data?.clients) && resPosAddr.data.clients.some(e => e.client.id === createdClientId),
      'POS lookup found customer by address query'
    );

    // Verify recent orders linking: order was placed under testPhoneAlt1
    const posEntry = resPosAlt.data.clients.find(e => e.client.id === createdClientId);
    assert(
      Array.isArray(posEntry?.recentOrders) && posEntry.recentOrders.some(o => o.orderNumber === `TEST-ORD-${testSuffix}`),
      'Order history successfully links past orders placed under alternate phone numbers'
    );

    // TEST 12: Duplicate Phone Detection on Registration
    console.log('\n[Test 12: Duplicate Phone Detection on Registration]');
    // Attempt to register with primary phone of existing customer
    const reqDup1 = {
      user: { id: 'test-admin', name: 'Johar User', role: 'ADMIN' },
      body: {
        name: 'Imposter Customer',
        phone: testPhonePrimary,
        outletName: 'Johar Town'
      }
    };
    const resDup1 = mockRes();
    await clientController.createClient(reqDup1, resDup1);
    assert(resDup1.statusCode === 409, 'Duplicate primary phone blocked with HTTP 409 Conflict');
    assert(resDup1.data?.code === 'DUPLICATE_PHONE', 'Error code is DUPLICATE_PHONE');
    assert(resDup1.data?.existingClient?.id === createdClientId, 'Duplicate response identifies existing client');

    // Attempt to register with alternate phone of existing customer
    const reqDup2 = {
      user: { id: 'test-admin', name: 'Johar User', role: 'ADMIN' },
      body: {
        name: 'Another Customer',
        phone: `0333${testSuffix}`,
        additionalPhones: [testPhoneAlt2],
        outletName: 'Johar Town'
      }
    };
    const resDup2 = mockRes();
    await clientController.createClient(reqDup2, resDup2);
    assert(resDup2.statusCode === 409, 'Duplicate in additionalPhones blocked with HTTP 409 Conflict');

    // Allow shared family phone when force: true is passed
    const reqDupForce = {
      user: { id: 'test-admin', name: 'Johar User', role: 'ADMIN' },
      body: {
        name: `Family Member of Test-${testSuffix}`,
        phone: testPhonePrimary,
        outletName: 'Johar Town',
        force: true
      }
    };
    const resDupForce = mockRes();
    await clientController.createClient(reqDupForce, resDupForce);
    assert(resDupForce.statusCode === 201, 'Registration with force: true succeeds for shared family phone');
    sharedClientId = resDupForce.data?.id;

    // TEST 13: Multi-match list when searching shared phone
    console.log('\n[Test 13: Multi-match list returned when searching shared phone]');
    const reqSharedSearch = { query: { q: testPhonePrimary, allOutlets: 'true' } };
    const resSharedSearch = mockRes();
    await clientController.searchClients(reqSharedSearch, resSharedSearch);
    assert(
      Array.isArray(resSharedSearch.data) && resSharedSearch.data.length >= 2,
      'Multiple distinct customer profiles returned without auto-merging'
    );

    // TEST 14: getClientById with comprehensive order history
    console.log('\n[Test 14: getClientById order history across all phone numbers]');
    const reqGetId = { params: { id: createdClientId } };
    const resGetId = mockRes();
    await clientController.getClientById(reqGetId, resGetId);
    assert(resGetId.statusCode === 200, 'getClientById returned HTTP 200');
    assert(
      Array.isArray(resGetId.data?.recentOrders) && resGetId.data.recentOrders.some(o => o.orderNumber === `TEST-ORD-${testSuffix}`),
      'getClientById returns orders placed under alternate phone numbers'
    );

  } catch (error) {
    console.error('Unhandled test exception:', error);
    failed++;
  } finally {
    // Cleanup test records
    console.log('\n[Cleanup]');
    if (testOrderId) {
      await prisma.order.delete({ where: { id: testOrderId } }).catch(() => {});
    }
    if (createdClientId) {
      await prisma.client.delete({ where: { id: createdClientId } }).catch(() => {});
    }
    if (sharedClientId) {
      await prisma.client.delete({ where: { id: sharedClientId } }).catch(() => {});
    }
    console.log('Cleanup completed.');
  }

  console.log('\n=============================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`PASS RATE: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
