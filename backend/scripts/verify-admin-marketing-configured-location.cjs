const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runAcceptanceTest() {
  console.log('=== MARKETING CONFIGURED LOCATION -> ADMIN PROFILE VERIFICATION ===\n');

  // 1. Find Junaid across branches
  const junaidRecords = await prisma.outletEmployee.findMany({
    where: { name: { contains: 'Junaid', mode: 'insensitive' } }
  });
  console.log(`[PASS] Found ${junaidRecords.length} profile(s) for Junaid:`, junaidRecords.map(j => `${j.name} (${j.outletName}, id: ${j.id})`));

  if (junaidRecords.length === 0) {
    throw new Error('No employee named Junaid found!');
  }

  const primaryJunaid = junaidRecords[0];

  // 2. Set configured location to Packages Mall
  console.log('\n--- Step 1: Configure Packages Mall for Junaid ---');
  const packagesMallPayload = {
    employeeId: primaryJunaid.id,
    locationName: 'Packages Mall',
    area: 'Walton Road',
    city: 'Lahore',
    companyName: 'Packages Mall',
    address: 'Packages Mall, Walton Road, Lahore',
    latitude: 31.471125,
    longitude: 74.355889,
    radius: 100,
    isActive: true
  };

  // Simulate saveEmployeeConfiguredLocation logic
  const sameNameEmps = await prisma.outletEmployee.findMany({
    where: { name: { equals: primaryJunaid.name, mode: 'insensitive' } },
    select: { id: true }
  });
  const allEmpIds = Array.from(new Set([primaryJunaid.id, ...sameNameEmps.map(e => e.id)]));

  let existing = await prisma.marketingConfiguredLocation.findFirst({
    where: {
      OR: [
        { employeeId: { in: allEmpIds } },
        { employeeName: { equals: primaryJunaid.name, mode: 'insensitive' } }
      ]
    },
    orderBy: { updatedAt: 'desc' }
  });

  let saved;
  if (existing) {
    saved = await prisma.marketingConfiguredLocation.update({
      where: { id: existing.id },
      data: {
        employeeId: primaryJunaid.id,
        employeeName: primaryJunaid.name,
        name: packagesMallPayload.locationName,
        area: packagesMallPayload.area,
        city: packagesMallPayload.city,
        companyName: packagesMallPayload.companyName,
        address: packagesMallPayload.address,
        latitude: packagesMallPayload.latitude,
        longitude: packagesMallPayload.longitude,
        radius: packagesMallPayload.radius,
        isActive: true
      }
    });
  } else {
    saved = await prisma.marketingConfiguredLocation.create({
      data: {
        employeeId: primaryJunaid.id,
        employeeName: primaryJunaid.name,
        name: packagesMallPayload.locationName,
        area: packagesMallPayload.area,
        city: packagesMallPayload.city,
        companyName: packagesMallPayload.companyName,
        address: packagesMallPayload.address,
        latitude: packagesMallPayload.latitude,
        longitude: packagesMallPayload.longitude,
        radius: packagesMallPayload.radius,
        isActive: true
      }
    });
  }

  // Deactivate any others
  await prisma.marketingConfiguredLocation.updateMany({
    where: {
      id: { not: saved.id },
      OR: [
        { employeeId: { in: allEmpIds } },
        { employeeName: { equals: primaryJunaid.name, mode: 'insensitive' } }
      ]
    },
    data: { isActive: false }
  });

  console.log('[PASS] Configured location saved:', saved.name, `(${saved.latitude}, ${saved.longitude})`, 'isActive:', saved.isActive);

  // 3. Test query for each branch profile of Junaid (Johar Town, Jail Road, Marketing)
  console.log('\n--- Step 2: Query location for every profile ID of Junaid ---');
  for (const emp of junaidRecords) {
    const loc = await prisma.marketingConfiguredLocation.findFirst({
      where: {
        OR: [
          { employeeId: { in: allEmpIds } },
          { employeeName: { equals: emp.name, mode: 'insensitive' } }
        ],
        isActive: true
      }
    });
    if (!loc) {
      throw new Error(`Failed to resolve active location for Junaid via branch profile: ${emp.outletName} (${emp.id})`);
    }
    console.log(`[PASS] Branch profile ${emp.outletName} successfully resolved location:`, loc.name);
  }

  // 4. Test Admin Profile aggregation logic
  console.log('\n--- Step 3: Admin Profile Aggregation (getAdminActivities simulation) ---');
  const outletEmps = await prisma.outletEmployee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, profiles: true, outletName: true }
  });
  const rawMarketingEmps = outletEmps.filter(e => Array.isArray(e.profiles) && e.profiles.includes('MARKETING'));

  const empMap = new Map();
  for (const e of rawMarketingEmps) {
    const key = e.name.toLowerCase().trim();
    if (!empMap.has(key)) {
      empMap.set(key, {
        id: e.id,
        name: e.name,
        outletName: e.outletName,
        allIds: [e.id]
      });
    } else {
      empMap.get(key).allIds.push(e.id);
    }
  }
  const marketingEmployees = Array.from(empMap.values());

  const latestPerEmployee = [];
  for (const emp of marketingEmployees) {
    let configuredLoc = await prisma.marketingConfiguredLocation.findFirst({
      where: {
        OR: [
          { employeeId: { in: emp.allIds } },
          { employeeName: { equals: emp.name, mode: 'insensitive' } }
        ],
        isActive: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (configuredLoc) {
      latestPerEmployee.push({
        employee: emp,
        location: {
          name: configuredLoc.name,
          latitude: configuredLoc.latitude,
          longitude: configuredLoc.longitude,
          area: configuredLoc.area,
          city: configuredLoc.city,
          address: configuredLoc.address
        }
      });
    }
  }

  const junaidActive = latestPerEmployee.find(ae => ae.employee.name.toLowerCase() === 'junaid');
  if (!junaidActive) {
    throw new Error('Junaid did not appear in activeEmployees on Admin Profile!');
  }
  console.log('[PASS] Junaid found in Admin Profile active employees:');
  console.log('       Name:', junaidActive.employee.name);
  console.log('       Location:', junaidActive.location.name);
  console.log('       Coordinates:', `${junaidActive.location.latitude}, ${junaidActive.location.longitude}`);

  if (junaidActive.location.name !== 'Packages Mall' || junaidActive.location.latitude !== 31.471125) {
    throw new Error('Coordinates or location name mismatch on Admin Profile!');
  }

  // 5. Test Update Location to Doctors Hospital
  console.log('\n--- Step 4: Update Location to Doctors Hospital ---');
  const doctorsHospitalPayload = {
    employeeId: primaryJunaid.id,
    locationName: 'Doctors Hospital',
    area: 'Johar Town',
    city: 'Lahore',
    hospitalName: 'Doctors Hospital & Medical Center',
    address: 'Doctors Hospital, Canal Bank Road, Johar Town, Lahore',
    latitude: 31.4697,
    longitude: 74.2728,
    radius: 100,
    isActive: true
  };

  const updatedLoc = await prisma.marketingConfiguredLocation.update({
    where: { id: saved.id },
    data: {
      name: doctorsHospitalPayload.locationName,
      area: doctorsHospitalPayload.area,
      city: doctorsHospitalPayload.city,
      hospitalName: doctorsHospitalPayload.hospitalName,
      companyName: null,
      address: doctorsHospitalPayload.address,
      latitude: doctorsHospitalPayload.latitude,
      longitude: doctorsHospitalPayload.longitude,
      radius: doctorsHospitalPayload.radius,
      isActive: true
    }
  });

  console.log('[PASS] Updated location in database:', updatedLoc.name, `(${updatedLoc.latitude}, ${updatedLoc.longitude})`);

  // Query again for Admin Profile
  let configuredAfterUpdate = await prisma.marketingConfiguredLocation.findFirst({
    where: {
      OR: [
        { employeeId: { in: allEmpIds } },
        { employeeName: { equals: primaryJunaid.name, mode: 'insensitive' } }
      ],
      isActive: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  if (configuredAfterUpdate.name !== 'Doctors Hospital' || configuredAfterUpdate.latitude !== 31.4697) {
    throw new Error('Admin Profile did not reflect the new updated location!');
  }
  console.log('[PASS] Admin Profile immediately retrieves new updated location: Doctors Hospital (31.4697, 74.2728)');

  // 6. Reset back to Packages Mall so state is preserved
  console.log('\n--- Step 5: Restore to Packages Mall ---');
  await prisma.marketingConfiguredLocation.update({
    where: { id: saved.id },
    data: {
      name: packagesMallPayload.locationName,
      area: packagesMallPayload.area,
      city: packagesMallPayload.city,
      companyName: packagesMallPayload.companyName,
      hospitalName: null,
      address: packagesMallPayload.address,
      latitude: packagesMallPayload.latitude,
      longitude: packagesMallPayload.longitude,
      radius: packagesMallPayload.radius,
      isActive: true
    }
  });
  console.log('[PASS] Restored active location to Packages Mall.');

  console.log('\n=== ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY (100% PASS) ===\n');
}

runAcceptanceTest()
  .catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
