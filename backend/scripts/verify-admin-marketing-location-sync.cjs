require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../src/prisma');
const {
  saveEmployeeConfiguredLocation,
  getAdminActivities
} = require('../src/controllers/marketing.controller');

function createMockRes() {
  let statusCode = 200;
  let responseData = null;
  const headers = {};
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    set: (k, v) => {
      headers[k.toLowerCase()] = v;
      return res;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers
  };
  return res;
}

async function runVerification() {
  console.log('=== VERIFYING ADMIN PROFILE MARKETING LOCATION SYNCHRONIZATION ===\n');

  // Step 0: Find or select Junaid / Marketing employee
  const allEmployees = await prisma.outletEmployee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, profiles: true }
  });

  let junaid = allEmployees.find(e => 
    e.name && e.name.toLowerCase().includes('junaid')
  );

  if (!junaid) {
    junaid = allEmployees.find(e => Array.isArray(e.profiles) && e.profiles.includes('MARKETING')) || allEmployees[0];
  }

  console.log(`Found target employee: ${junaid.name} (ID: ${junaid.id})`);

  // Step 1: Save first location for Junaid in Software Settings (Doctors Hospital, Johar Town)
  console.log('\n--- Step 1: Save configured location in Software Settings (Doctors Hospital) ---');
  const saveReq1 = {
    body: {
      employeeId: junaid.id,
      locationName: 'Doctors Hospital & Medical Center',
      area: 'Johar Town',
      city: 'Lahore',
      hospitalName: 'Doctors Hospital',
      companyName: null,
      address: '152-G1 Canal Bank Rd, Johar Town, Lahore',
      latitude: 31.4697,
      longitude: 74.2728,
      radius: 100,
      originalMapUrl: 'https://maps.app.goo.gl/doctors-hospital-sample',
      locationMode: 'CONFIGURED',
      isActive: true
    },
    user: { id: 'admin-test-id', name: 'Test Administrator' },
    app: { get: () => null }
  };
  const saveRes1 = createMockRes();
  await saveEmployeeConfiguredLocation(saveReq1, saveRes1);

  if (saveRes1.getStatusCode() !== 200 || !saveRes1.getData()?.success) {
    throw new Error(`Step 1 Failed: ${JSON.stringify(saveRes1.getData())}`);
  }
  console.log('✅ Step 1 Passed: Successfully saved initial location in Software Settings.');

  // Step 2: Call getAdminActivities (Admin Profile -> Marketing)
  console.log('\n--- Step 2: Fetch Admin Profile Marketing Data ---');
  const adminReq1 = {
    query: {},
    app: { get: () => null }
  };
  const adminRes1 = createMockRes();
  await getAdminActivities(adminReq1, adminRes1);

  const adminData1 = adminRes1.getData();
  const activeEmps1 = adminData1?.activeEmployees || [];
  console.log(`Retrieved ${activeEmps1.length} active marketing staff records.`);

  const junaidActive1 = activeEmps1.find(ae => ae.employee?.id === junaid.id);
  if (!junaidActive1) {
    throw new Error(`Step 2 Failed: Employee ${junaid.name} not found in activeEmployees!`);
  }

  console.log('Junaid resolved location on Admin Profile:', junaidActive1.location);

  if (
    Math.abs(junaidActive1.location.latitude - 31.4697) > 0.0001 ||
    Math.abs(junaidActive1.location.longitude - 74.2728) > 0.0001 ||
    junaidActive1.location.area !== 'Johar Town'
  ) {
    throw new Error(`Step 2 Failed: Location mismatch on Admin Profile! Got lat=${junaidActive1.location.latitude}, lng=${junaidActive1.location.longitude}, area=${junaidActive1.location.area}`);
  }

  // Verify that locationMode is NOT exposed in the location payload
  if (junaidActive1.location.locationMode) {
    throw new Error('Step 2 Failed: Internal locationMode was exposed to Admin Profile!');
  }

  // Verify no-cache headers
  const headers1 = adminRes1.getHeaders();
  if (!headers1['cache-control'] || !headers1['cache-control'].includes('no-store')) {
    throw new Error('Step 2 Failed: Cache-Control no-store header missing on admin activities response.');
  }

  console.log('✅ Step 2 Passed: Admin Profile immediately retrieved Junaid with newly configured location (Doctors Hospital).');

  // Step 3: Change Junaid's location again in Software Settings (Jail Road Office, Gulberg)
  console.log('\n--- Step 3: Change Junaid\'s location in Software Settings (Jail Road, Gulberg) ---');
  const saveReq2 = {
    body: {
      employeeId: junaid.id,
      locationName: 'Jail Road Corporate Office',
      area: 'Gulberg',
      city: 'Lahore',
      hospitalName: null,
      companyName: 'Enamels Head Office',
      address: 'Jail Road, Main Gulberg, Lahore',
      latitude: 31.5385,
      longitude: 74.3394,
      radius: 100,
      originalMapUrl: 'https://maps.app.goo.gl/jail-road-sample',
      locationMode: 'CONFIGURED',
      isActive: true
    },
    user: { id: 'admin-test-id', name: 'Test Administrator' },
    app: { get: () => null }
  };
  const saveRes2 = createMockRes();
  await saveEmployeeConfiguredLocation(saveReq2, saveRes2);

  if (saveRes2.getStatusCode() !== 200 || !saveRes2.getData()?.success) {
    throw new Error(`Step 3 Failed: ${JSON.stringify(saveRes2.getData())}`);
  }
  console.log('✅ Step 3 Passed: Successfully saved new location for Junaid in Software Settings.');

  // Step 4: Re-fetch Admin Profile Marketing Data
  console.log('\n--- Step 4: Verify Admin Profile reflects updated location without old data ---');
  const adminReq2 = {
    query: {},
    app: { get: () => null }
  };
  const adminRes2 = createMockRes();
  await getAdminActivities(adminReq2, adminRes2);

  const adminData2 = adminRes2.getData();
  const activeEmps2 = adminData2?.activeEmployees || [];
  const junaidActive2 = activeEmps2.find(ae => ae.employee?.id === junaid.id);

  if (!junaidActive2) {
    throw new Error(`Step 4 Failed: Employee ${junaid.name} not found in activeEmployees!`);
  }

  console.log('Junaid updated location on Admin Profile:', junaidActive2.location);

  if (
    Math.abs(junaidActive2.location.latitude - 31.5385) > 0.0001 ||
    Math.abs(junaidActive2.location.longitude - 74.3394) > 0.0001 ||
    junaidActive2.location.area !== 'Gulberg'
  ) {
    throw new Error(`Step 4 Failed: Location did not update to new coordinates! Got lat=${junaidActive2.location.latitude}, lng=${junaidActive2.location.longitude}`);
  }

  // Ensure old coordinates are NOT present
  if (Math.abs(junaidActive2.location.latitude - 31.4697) < 0.0001) {
    throw new Error('Step 4 Failed: Old coordinates are still being returned!');
  }

  console.log('✅ Step 4 Passed: Admin Profile immediately updated to Jail Road Office (31.5385, 74.3394) with ZERO old data.');

  // Step 5: Clean up test record
  console.log('\n--- Step 5: Clean up test data ---');
  await prisma.marketingConfiguredLocation.deleteMany({
    where: { employeeId: junaid.id }
  });
  console.log('✅ Cleaned up test data.');

  console.log('\n========================================================================');
  console.log('🎉 ALL ADMIN MARKETING LOCATION SYNCHRONIZATION TESTS PASSED WITH 100%!');
  console.log('========================================================================');
}

runVerification()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
