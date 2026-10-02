require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../src/prisma');
const {
  extractLocationLink,
  saveEmployeeConfiguredLocation,
  getEmployeeConfiguredLocation
} = require('../src/controllers/marketing.controller');

function createMockRes() {
  let statusCode = 200;
  let responseData = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };
  return res;
}

async function runVerification() {
  console.log('=== Starting Marketing Location Extraction & Storage Verification ===\n');

  // Step 0: Find or ensure marketing employee (e.g. Junaid)
  const allEmployees = await prisma.outletEmployee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, profiles: true }
  });

  let employee = allEmployees.find(e => 
    (e.name && e.name.toLowerCase().includes('junaid')) ||
    (Array.isArray(e.profiles) && e.profiles.includes('MARKETING'))
  ) || allEmployees[0];

  if (!employee) {
    console.log('No existing marketing employee found, finding any active outlet employee...');
    employee = await prisma.outletEmployee.findFirst({ where: { isActive: true } });
  }

  if (!employee) {
    throw new Error('No employee found in database to test.');
  }

  console.log(`Found test employee: ${employee.name} (${employee.id})`);

  // Step 1: Test extractLocationLink with Google Maps coordinate URL
  console.log('\n--- Test 1: Extract location from Google Maps URL ---');
  const validUrlReq = {
    body: {
      url: 'https://www.google.com/maps/@31.4697,74.2728,15z'
    }
  };
  const validRes = createMockRes();
  await extractLocationLink(validUrlReq, validRes);

  console.log('Extraction status code:', validRes.getStatusCode());
  const extractData = validRes.getData();
  console.log('Extracted response data:', extractData);

  if (validRes.getStatusCode() !== 200 || !extractData?.success) {
    throw new Error(`Test 1 Failed: Expected 200 and success: true, got ${validRes.getStatusCode()}`);
  }
  if (Math.abs(extractData.latitude - 31.4697) > 0.001 || Math.abs(extractData.longitude - 74.2728) > 0.001) {
    throw new Error(`Test 1 Failed: Coordinates mismatch (${extractData.latitude}, ${extractData.longitude})`);
  }
  console.log('✅ Test 1 Passed: Successfully extracted coordinates from Google Maps link.');

  // Step 2: Test saveEmployeeConfiguredLocation
  console.log('\n--- Test 2: Save configured location for employee ---');
  const saveReq = {
    body: {
      employeeId: employee.id,
      locationName: 'Doctors Hospital & Medical Center',
      area: 'Johar Town',
      city: 'Lahore',
      hospitalName: 'Doctors Hospital',
      companyName: null,
      address: '152-G1 Canal Bank Rd, Johar Town, Lahore',
      latitude: extractData.latitude,
      longitude: extractData.longitude,
      radius: 100,
      originalMapUrl: validUrlReq.body.url,
      locationMode: 'CONFIGURED',
      isActive: true
    },
    user: { id: 'admin-test-id', name: 'Test Administrator' }
  };
  const saveRes = createMockRes();
  await saveEmployeeConfiguredLocation(saveReq, saveRes);

  console.log('Save status code:', saveRes.getStatusCode());
  const saveData = saveRes.getData();
  console.log('Save response data:', saveData);

  if (saveRes.getStatusCode() !== 200 || !saveData?.success || !saveData?.location?.id) {
    throw new Error(`Test 2 Failed: Expected 200 and saved location, got ${saveRes.getStatusCode()}`);
  }
  const initialLocId = saveData.location.id;
  console.log(`✅ Test 2 Passed: Successfully saved configured location (ID: ${initialLocId})`);

  // Step 3: Test getEmployeeConfiguredLocation
  console.log('\n--- Test 3: Get active configured location for employee ---');
  const getReq = {
    params: { employeeId: employee.id }
  };
  const getRes = createMockRes();
  await getEmployeeConfiguredLocation(getReq, getRes);

  console.log('Get status code:', getRes.getStatusCode());
  const getData = getRes.getData();
  console.log('Get response data:', getData);

  if (getRes.getStatusCode() !== 200 || !getData?.success || getData?.location?.id !== initialLocId) {
    throw new Error(`Test 3 Failed: Location mismatch on fetch.`);
  }
  console.log('✅ Test 3 Passed: Successfully fetched active configured location.');

  // Step 4: Test update/replacement without duplicate creation (Section 11)
  console.log('\n--- Test 4: Replace with new location and verify NO duplicate active records ---');
  const updateReq = {
    body: {
      employeeId: employee.id,
      locationName: 'Jail Road Office',
      area: 'Gulberg',
      city: 'Lahore',
      hospitalName: null,
      companyName: 'Enamels Head Office',
      address: 'Jail Road, Main Gulberg, Lahore',
      latitude: 31.5385,
      longitude: 74.3394,
      radius: 120,
      originalMapUrl: 'https://www.google.com/maps/@31.5385,74.3394,16z',
      locationMode: 'CONFIGURED',
      isActive: true
    },
    user: { id: 'admin-test-id', name: 'Test Administrator' }
  };
  const updateRes = createMockRes();
  await saveEmployeeConfiguredLocation(updateReq, updateRes);

  const updateData = updateRes.getData();
  console.log('Update response data:', updateData);

  const activeRecordsCount = await prisma.marketingConfiguredLocation.count({
    where: {
      employeeId: employee.id,
      isActive: true
    }
  });

  console.log(`Active configured locations for ${employee.name}: ${activeRecordsCount}`);
  if (activeRecordsCount !== 1) {
    throw new Error(`Test 4 Failed: Expected exactly 1 active record, found ${activeRecordsCount}`);
  }
  if (updateData.location.id !== initialLocId) {
    throw new Error(`Test 4 Failed: Expected existing record ${initialLocId} to be updated, but created new ID ${updateData.location.id}`);
  }
  console.log('✅ Test 4 Passed: Clean in-place update with zero duplicate records.');

  // Step 5: Test invalid input handling & rejection
  console.log('\n--- Test 5: Error handling & invalid URL / coordinate rejection ---');
  
  // 5a: Empty URL
  const emptyRes = createMockRes();
  await extractLocationLink({ body: { url: '' } }, emptyRes);
  if (emptyRes.getStatusCode() !== 400 || emptyRes.getData()?.success !== false) {
    throw new Error('Test 5a Failed: Empty URL was not rejected with 400.');
  }
  console.log('  5a Passed: Empty URL rejected with 400 & clear message.');

  // 5b: Invalid coordinates in save
  const invalidCoordsRes = createMockRes();
  await saveEmployeeConfiguredLocation({
    body: {
      employeeId: employee.id,
      latitude: 999.0, // Out of bounds
      longitude: 74.3
    }
  }, invalidCoordsRes);
  if (invalidCoordsRes.getStatusCode() !== 400 || invalidCoordsRes.getData()?.success !== false) {
    throw new Error('Test 5b Failed: Out-of-bounds coordinates not rejected with 400.');
  }
  console.log('  5b Passed: Out-of-bounds coordinates rejected with 400.');

  // 5c: Non-existent employee ID
  const invalidEmpRes = createMockRes();
  await saveEmployeeConfiguredLocation({
    body: {
      employeeId: '00000000-0000-0000-0000-000000000000',
      latitude: 31.5,
      longitude: 74.3
    }
  }, invalidEmpRes);
  if (invalidEmpRes.getStatusCode() !== 404) {
    throw new Error('Test 5c Failed: Non-existent employee ID was not rejected with 404.');
  }
  console.log('  5c Passed: Non-existent employee ID rejected with 404.');

  // Step 6: Clean up test record
  console.log('\n--- Step 6: Cleanup test data ---');
  await prisma.marketingConfiguredLocation.deleteMany({
    where: { id: initialLocId }
  });
  console.log('✅ Cleaned up test record.');

  console.log('\n=======================================================');
  console.log('🎉 ALL MARKETING LOCATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('=======================================================');
}

runVerification()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
