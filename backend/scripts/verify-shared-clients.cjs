const prisma = require('../src/prisma');
const clientController = require('../src/controllers/client.controller');
const outletOrderController = require('../src/controllers/outletOrder.controller');

async function runTests() {
  console.log('=== STARTING SHARED CLIENT REGISTRATION & POS INTEGRATION VERIFICATION ===\n');
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

  try {
    // 1. Setup Test Clients across multiple branches
    const testPhoneJT = `0300999${Math.floor(1000 + Math.random() * 9000)}`;
    const testPhoneJL = `0321888${Math.floor(1000 + Math.random() * 9000)}`;
    const testPhoneAB = `0333777${Math.floor(1000 + Math.random() * 9000)}`;

    const jtClient = await prisma.client.create({
      data: {
        clientNumber: `90${Math.floor(100 + Math.random() * 900)}`,
        name: 'Dr. Ahmad Johar',
        gender: 'Male',
        phone: testPhoneJT,
        outletName: 'Johar Town',
        city: 'Lahore',
        permanentAddress: 'House 12, Johar Town Phase 1',
        standardSizes: ['M', 'L'],
        sizeDetails: {
          shirtLength: '39.5',
          shoulder: '18',
          sleevesLength: '24',
          chest: '40',
          waist: '34',
          length: '41',
          _extra: [{ name: 'Bicep', value: '14' }]
        }
      }
    });

    const jlClient = await prisma.client.create({
      data: {
        clientNumber: `91${Math.floor(100 + Math.random() * 900)}`,
        name: 'Dr. Fatima JailRoad',
        gender: 'Female',
        phone: testPhoneJL,
        outletName: 'Jail Road',
        city: 'Lahore',
        permanentAddress: 'Flat 4, Shadman, Jail Road',
        standardSizes: ['S'],
        sizeDetails: {
          shirtLength: '36',
          shoulder: '15.5',
          chest: '36',
          waist: '28',
          length: '38'
        }
      }
    });

    assert(jtClient.id && jlClient.id, 'Test clients created in Johar Town and Jail Road');

    // 2. Test Cross-Outlet Search
    // An outlet user from Abbottabad searches for "Ahmad Johar"
    const reqSearch = {
      query: { q: 'Ahmad Johar' },
      user: { role: 'OUTLET', name: 'Abbottabad' }
    };
    let searchResults = [];
    const resSearch = {
      json: (data) => { searchResults = data; }
    };
    await clientController.searchClients(reqSearch, resSearch);
    const foundCrossOutlet = searchResults.some(c => c.id === jtClient.id);
    assert(foundCrossOutlet, 'Abbottabad outlet user can search and find Johar Town client (cross-outlet lookup)');

    // 3. Test Cross-Outlet Branch Ownership Guard
    // Jail Road user tries to edit Johar Town client's profile
    let forbiddenCalled = false;
    let forbiddenMessage = '';
    const reqUnauthorizedUpdate = {
      params: { id: jtClient.id },
      user: { role: 'OUTLET', name: 'Jail Road' },
      body: { name: 'Attempted Hijack by Jail Road' }
    };
    const resUnauthorizedUpdate = {
      status: (code) => {
        if (code === 403) forbiddenCalled = true;
        return {
          json: (data) => { forbiddenMessage = data.message; }
        }
      }
    };
    await clientController.updateClient(reqUnauthorizedUpdate, resUnauthorizedUpdate);
    assert(forbiddenCalled && forbiddenMessage.includes('Only Johar Town staff'),
      'Jail Road user is strictly blocked (HTTP 403) from editing Johar Town client profile');

    // 4. Test Authorized Owning Branch Update & Custom Measurements Persistence
    let updatedClient = null;
    const reqAuthorizedUpdate = {
      params: { id: jtClient.id },
      user: { role: 'OUTLET', name: 'Johar Town' },
      body: {
        name: 'Dr. Ahmad Johar Updated',
        standardSizes: ['M', 'L', 'XL'],
        sizeDetails: {
          shirtLength: '40',
          shoulder: '18.5',
          sleevesLength: '24.5',
          chest: '41',
          waist: '35',
          length: '41.5',
          _extra: [{ name: 'Bicep', value: '14.5' }]
        }
      }
    };
    const resAuthorizedUpdate = {
      json: (data) => { updatedClient = data; },
      status: (code) => ({ json: (d) => { console.error('Status code:', code, d); } })
    };
    await clientController.updateClient(reqAuthorizedUpdate, resAuthorizedUpdate);
    assert(updatedClient && updatedClient.name === 'Dr. Ahmad Johar Updated', 'Johar Town staff successfully updates own client');
    assert(updatedClient.sizeDetails && updatedClient.sizeDetails.shirtLength === '40', 'Custom measurements updated and persisted correctly');
    assert(Array.isArray(updatedClient.standardSizes) && updatedClient.standardSizes.includes('XL'), 'Standard sizes array preserved independently');

    // 5. Test Admin Role Permission to Edit Any Client
    let adminUpdated = false;
    const reqAdminUpdate = {
      params: { id: jtClient.id },
      user: { role: 'SUPER_ADMIN', name: 'Super Admin' },
      body: { name: 'Dr. Ahmad Johar (Verified by Admin)' }
    };
    const resAdminUpdate = {
      json: (data) => { adminUpdated = true; },
      status: (code) => ({ json: () => {} })
    };
    await clientController.updateClient(reqAdminUpdate, resAdminUpdate);
    assert(adminUpdated, 'SUPER_ADMIN can update client from any branch');

    // 6. Test getClientById includes Past Orders
    // Create an order for this customer phone
    const testOrder = await prisma.order.create({
      data: {
        orderNumber: `JT-TST-${Math.floor(10000 + Math.random() * 90000)}`,
        customerName: jtClient.name,
        customerPhone: jtClient.phone,
        outletName: 'Johar Town',
        source: 'OUTLET',
        totalPrice: 4500,
        advanceAmount: 2000,
        balanceAmount: 2500,
        status: 'PENDING',
        currentStage: 'ORDER_ENTRY',
        productDetails: JSON.stringify([{ name: 'Classic Scrub', size: 'M', color: 'Navy Blue', quantity: 1, unitPrice: 4500 }])
      }
    });

    let clientWithOrders = null;
    const reqGetClient = {
      params: { id: jtClient.id },
      user: { role: 'OUTLET', name: 'Jail Road' }
    };
    const resGetClient = {
      json: (data) => { clientWithOrders = data; },
      status: () => ({ json: () => {} })
    };
    await clientController.getClientById(reqGetClient, resGetClient);
    assert(clientWithOrders && Array.isArray(clientWithOrders.recentOrders) && clientWithOrders.recentOrders.length > 0,
      'getClientById includes customer previous order history');
    assert(clientWithOrders.recentOrders.some(o => o.orderNumber === testOrder.orderNumber),
      'Matching order appears in client previous orders');

    // 7. Test lookupClientByNumber with client number and client id
    let lookupResult = null;
    const reqLookup = {
      query: { number: jtClient.clientNumber },
      user: { role: 'OUTLET', name: 'Jail Road' }
    };
    const resLookup = {
      json: (data) => { lookupResult = data; },
      status: () => ({ json: () => {} })
    };
    await outletOrderController.lookupClientByNumber(reqLookup, resLookup);
    assert(lookupResult && lookupResult.clients && lookupResult.clients.length > 0,
      'lookupClientByNumber successfully looks up cross-branch client by clientNumber');
    assert(lookupResult.clients[0].client.name.includes('Dr. Ahmad Johar'),
      'Lookup returns correct client profile');

    // Clean up test records
    await prisma.order.deleteMany({ where: { id: testOrder.id } });
    await prisma.client.deleteMany({ where: { id: { in: [jtClient.id, jlClient.id] } } });

    console.log(`\n========================================`);
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
