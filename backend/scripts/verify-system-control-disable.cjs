const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
const prisma = require('../src/prisma');
const { isFeatureAllowed, requirePermission, invalidatePermissionCache } = require('../src/middleware/systemControl.middleware');

async function runTest() {
  console.log('=== STARTING SYSTEM CONTROL DISABLE VERIFICATION ===\n');

  try {
    // 1. Initial State Check
    invalidatePermissionCache();
    const initialSuperAdmin = await isFeatureAllowed('SUPER_ADMIN', 'DASHBOARD_VIEW');
    const initialAdmin = await isFeatureAllowed('ADMIN', 'DASHBOARD_VIEW');
    console.log(`[1] Initial State for DASHBOARD_VIEW: SUPER_ADMIN = ${initialSuperAdmin}, ADMIN = ${initialAdmin}`);

    // 2. Simulate User in Software Settings Disabling Dashboard for ADMIN
    console.log('\n[2] Setting ADMIN DASHBOARD_VIEW = false in database...');
    await prisma.systemControlPermission.upsert({
      where: {
        profile_featureId: {
          profile: 'ADMIN',
          featureId: 'DASHBOARD_VIEW'
        }
      },
      update: { isEnabled: false },
      create: { profile: 'ADMIN', featureId: 'DASHBOARD_VIEW', isEnabled: false }
    });
    invalidatePermissionCache();

    // 3. Test that SUPER_ADMIN and ADMIN are both blocked
    const disabledSuperAdmin = await isFeatureAllowed('SUPER_ADMIN', 'DASHBOARD_VIEW');
    const disabledAdmin = await isFeatureAllowed('ADMIN', 'DASHBOARD_VIEW');
    console.log(`[3] After Disabling: SUPER_ADMIN = ${disabledSuperAdmin}, ADMIN = ${disabledAdmin}`);

    if (disabledSuperAdmin !== false || disabledAdmin !== false) {
      throw new Error(`FAILED: Expected both SUPER_ADMIN and ADMIN to be false, got SUPER_ADMIN=${disabledSuperAdmin}, ADMIN=${disabledAdmin}`);
    }
    console.log('✓ PASS: Both SUPER_ADMIN and ADMIN are strictly disabled when ADMIN is disabled.');

    // 4. Test that other features remain unaffected
    const orderViewAllowed = await isFeatureAllowed('SUPER_ADMIN', 'ORDER_VIEW');
    console.log(`[4] Independent feature check: SUPER_ADMIN ORDER_VIEW = ${orderViewAllowed}`);
    if (orderViewAllowed !== true) {
      throw new Error(`FAILED: Expected ORDER_VIEW to remain true, got ${orderViewAllowed}`);
    }
    console.log('✓ PASS: Disabling DASHBOARD_VIEW did not affect ORDER_VIEW.');

    // 5. Test requirePermission middleware blocks with 403 FEATURE_DISABLED
    console.log('\n[5] Testing requirePermission middleware rejection...');
    const middleware = requirePermission('DASHBOARD_VIEW');
    let statusSent = null;
    let jsonSent = null;
    const req = { user: { role: 'SUPER_ADMIN' } };
    const res = {
      status: (code) => {
        statusSent = code;
        return {
          json: (data) => { jsonSent = data; }
        };
      }
    };
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });

    console.log(`Response status: ${statusSent}, code: ${jsonSent?.code}, nextCalled: ${nextCalled}`);
    if (statusSent !== 403 || jsonSent?.code !== 'FEATURE_DISABLED' || nextCalled) {
      throw new Error(`FAILED: Middleware did not return 403 FEATURE_DISABLED!`);
    }
    console.log('✓ PASS: requirePermission middleware successfully rejected request with HTTP 403 and code FEATURE_DISABLED.');

    // 6. Test Re-enabling Dashboard
    console.log('\n[6] Re-enabling DASHBOARD_VIEW for ADMIN (isEnabled = true)...');
    await prisma.systemControlPermission.upsert({
      where: {
        profile_featureId: {
          profile: 'ADMIN',
          featureId: 'DASHBOARD_VIEW'
        }
      },
      update: { isEnabled: true },
      create: { profile: 'ADMIN', featureId: 'DASHBOARD_VIEW', isEnabled: true }
    });
    // Also remove any test rows or set to true for SUPER_ADMIN
    await prisma.systemControlPermission.upsert({
      where: {
        profile_featureId: {
          profile: 'SUPER_ADMIN',
          featureId: 'DASHBOARD_VIEW'
        }
      },
      update: { isEnabled: true },
      create: { profile: 'SUPER_ADMIN', featureId: 'DASHBOARD_VIEW', isEnabled: true }
    });
    invalidatePermissionCache();

    const restoredSuperAdmin = await isFeatureAllowed('SUPER_ADMIN', 'DASHBOARD_VIEW');
    const restoredAdmin = await isFeatureAllowed('ADMIN', 'DASHBOARD_VIEW');
    console.log(`[7] After Re-enabling: SUPER_ADMIN = ${restoredSuperAdmin}, ADMIN = ${restoredAdmin}`);

    if (restoredSuperAdmin !== true || restoredAdmin !== true) {
      throw new Error(`FAILED: Expected both to be true after re-enabling, got SUPER_ADMIN=${restoredSuperAdmin}, ADMIN=${restoredAdmin}`);
    }
    console.log('✓ PASS: Access successfully restored upon re-enabling.');

    // Clean up test rows
    await prisma.systemControlPermission.deleteMany({
      where: {
        featureId: 'DASHBOARD_VIEW',
        profile: { in: ['ADMIN', 'SUPER_ADMIN'] }
      }
    });
    invalidatePermissionCache();
    console.log('✓ Database cleaned up to defaults.');

    console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY (100%) ===');
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
