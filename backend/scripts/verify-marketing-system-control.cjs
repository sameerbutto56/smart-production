const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { isFeatureAllowed, invalidatePermissionCache } = require('../src/middleware/systemControl.middleware');
const { MODULES, FEATURES } = require('../src/utils/featureRegistry');

async function runVerification() {
  console.log('--- Starting Marketing & System Control Verification ---');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASSED: ${message}`);
    }
  }

  try {
    // 1. Feature Registry Integrity
    assert(MODULES.length >= 9, `Feature registry contains at least 9 modules (found ${MODULES.length})`);
    assert(FEATURES.length >= 40, `Feature registry contains at least 40 features (found ${FEATURES.length})`);

    // 2. System Control Permission Checking
    const marketingCanLog = await isFeatureAllowed('MARKETING', 'MARKETING_LOCATION_ENTRY');
    assert(marketingCanLog === true, 'MARKETING role is allowed MARKETING_LOCATION_ENTRY by default');

    const marketingCanSeeStore = await isFeatureAllowed('MARKETING', 'STORE_INVENTORY_VIEW');
    assert(marketingCanSeeStore === false, 'MARKETING role cannot access STORE_INVENTORY_VIEW by default');

    const adminCanDoAll = await isFeatureAllowed('SUPER_ADMIN', 'MARKETING_LOCATION_ENTRY');
    assert(adminCanDoAll === true, 'SUPER_ADMIN can access all features');

    // 3. Marketing User Verification
    const marketingUser = await prisma.user.findFirst({
      where: { email: 'marketing@enamel.com' }
    });
    assert(!!marketingUser, 'marketing@enamel.com user exists in database');
    assert(marketingUser && marketingUser.role === 'MARKETING', 'marketing@enamel.com has MARKETING role');

    // 4. Marketing Activity Append-Only Verification (Never Overwrite)
    const testDate = '2026-10-02';
    const act1 = await prisma.marketingActivity.create({
      data: {
        userId: marketingUser.id,
        employeeName: marketingUser.name,
        date: testDate,
        time: '09:30 AM',
        area: 'Johar Town',
        location: 'Doctors Hospital',
        hospitalName: 'Doctors Hospital',
        companyName: null,
        notes: 'Met Head of Dermatology',
        latitude: 31.4697,
        longitude: 74.2728,
        status: 'COMPLETED',
        source: 'GPS'
      }
    });
    assert(!!act1.id, 'Created first marketing activity for morning');

    const act2 = await prisma.marketingActivity.create({
      data: {
        userId: marketingUser.id,
        employeeName: marketingUser.name,
        date: testDate,
        time: '01:45 PM',
        area: 'Gulberg',
        location: 'National Hospital',
        hospitalName: 'National Hospital',
        companyName: null,
        notes: 'Follow-up visit regarding dental scrubs',
        latitude: 31.5204,
        longitude: 74.3587,
        status: 'COMPLETED',
        source: 'CONFIGURED'
      }
    });
    assert(!!act2.id, 'Created second marketing activity for afternoon on same day');

    const allVisitsToday = await prisma.marketingActivity.findMany({
      where: { userId: marketingUser.id, date: testDate },
      orderBy: { createdAt: 'asc' }
    });
    assert(allVisitsToday.length >= 2, `Both activities are preserved for ${testDate} (found ${allVisitsToday.length})`);
    const foundAct1 = allVisitsToday.some(a => a.id === act1.id && a.area === 'Johar Town');
    const foundAct2 = allVisitsToday.some(a => a.id === act2.id && a.area === 'Gulberg');
    assert(foundAct1 && foundAct2, 'First activity was NOT overwritten by second activity');

    // 5. Configured Reference Locations
    const testLoc = await prisma.marketingConfiguredLocation.create({
      data: {
        name: 'Test Medical Complex',
        area: 'Model Town',
        hospitalName: 'Test Medical Complex',
        address: 'Model Town Block C, Lahore',
        latitude: 31.4850,
        longitude: 74.3200,
        radius: 100,
        isActive: true
      }
    });
    assert(!!testLoc.id, 'Created configured marketing reference location');

    // 6. System Control Permission Override & Invalidation
    await prisma.systemControlPermission.upsert({
      where: {
        profile_featureId: {
          profile: 'OUTLET',
          featureId: 'MARKETING_LOCATION_ENTRY'
        }
      },
      update: { isEnabled: true },
      create: {
        profile: 'OUTLET',
        featureId: 'MARKETING_LOCATION_ENTRY',
        isEnabled: true
      }
    });
    invalidatePermissionCache('OUTLET');
    const outletCanLogNow = await isFeatureAllowed('OUTLET', 'MARKETING_LOCATION_ENTRY');
    assert(outletCanLogNow === true, 'Successfully toggled permission and cache invalidated dynamically');

    // Clean up test records
    await prisma.marketingActivity.delete({ where: { id: act1.id } });
    await prisma.marketingActivity.delete({ where: { id: act2.id } });
    await prisma.marketingConfiguredLocation.delete({ where: { id: testLoc.id } });
    await prisma.systemControlPermission.deleteMany({
      where: { profile: 'OUTLET', featureId: 'MARKETING_LOCATION_ENTRY' }
    });
    invalidatePermissionCache('OUTLET');
    console.log('🧹 Cleaned up verification test records');

    if (failures === 0) {
      console.log('🎉 ALL MARKETING & SYSTEM CONTROL VERIFICATION TESTS PASSED!');
    } else {
      console.error(`💥 Completed with ${failures} test failure(s).`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error during verification:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
