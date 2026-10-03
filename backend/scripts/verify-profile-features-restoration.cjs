/**
 * Verification test suite for Profile Features Restoration and System Control Integration.
 * 
 * Verifies:
 * 1. Feature Registry completeness in both backend and frontend.
 * 2. Default permissions for INVENTORY_VIEW, FAISAL, and STORE profiles.
 * 3. Simulated Layout.jsx navigation items for INVENTORY_VIEW, FAISAL, and STORE.
 * 4. System Control toggle test:
 *    - Disabling a feature removes only that option from the profile.
 *    - Enabling it restores the option immediately with zero loss of functionality.
 * 5. Route-level guard checks in App.jsx.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { FEATURES, MODULES, ALL_PROFILES } = require('../src/utils/featureRegistry');
const { isFeatureAllowed, invalidatePermissionCache } = require('../src/middleware/systemControl.middleware');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('🧪 Starting Profile Features Restoration Verification...\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failures++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Check 1: Feature Registry Definitions
    // -------------------------------------------------------------
    console.log('--- Step 1: Checking Feature Registry definitions ---');
    
    const requiredFeatures = [
      { id: 'RETURN_EXCHANGE', module: 'ORDERS', expectedProfile: 'INVENTORY_VIEW' },
      { id: 'ORDER_VERIFICATION', module: 'ORDERS', expectedProfile: 'INVENTORY_VIEW' },
      { id: 'RETURNED_FROM_VERIFICATION', module: 'ORDERS', expectedProfile: 'FAISAL' },
      { id: 'DEMAND_LEDGER_VIEW', module: 'STORE', expectedProfile: 'FAISAL' }
    ];

    for (const rf of requiredFeatures) {
      const feat = FEATURES.find(f => f.id === rf.id);
      assert(feat !== undefined, `Feature '${rf.id}' exists in backend registry`);
      if (feat) {
        assert(feat.module === rf.module, `Feature '${rf.id}' belongs to module '${rf.module}'`);
        assert(feat.defaultProfiles.includes(rf.expectedProfile), `Feature '${rf.id}' includes '${rf.expectedProfile}' in defaultProfiles`);
      }
    }

    // Check frontend featureRegistry.js matches
    const frontendRegistryPath = path.resolve(__dirname, '../../frontend/src/utils/featureRegistry.js');
    const frontendRegistryContent = fs.readFileSync(frontendRegistryPath, 'utf8');
    for (const rf of requiredFeatures) {
      assert(frontendRegistryContent.includes(`id: '${rf.id}'`), `Frontend featureRegistry contains '${rf.id}'`);
    }

    // -------------------------------------------------------------
    // Check 2: Default Profile Permissions
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Checking default profile permissions ---');

    // Invalidate permission cache to ensure fresh state
    invalidatePermissionCache();

    // Check INVENTORY_VIEW
    const ivVerification = await isFeatureAllowed('INVENTORY_VIEW', 'ORDER_VERIFICATION');
    const ivReturnExchange = await isFeatureAllowed('INVENTORY_VIEW', 'RETURN_EXCHANGE');
    const ivOrderTrack = await isFeatureAllowed('INVENTORY_VIEW', 'ORDER_TRACK');
    const ivOrderCancel = await isFeatureAllowed('INVENTORY_VIEW', 'ORDER_CANCEL');
    const ivWarehouse = await isFeatureAllowed('INVENTORY_VIEW', 'WAREHOUSE_VIEW');

    assert(ivVerification === true, 'INVENTORY_VIEW has ORDER_VERIFICATION enabled by default');
    assert(ivReturnExchange === true, 'INVENTORY_VIEW has RETURN_EXCHANGE enabled by default');
    assert(ivOrderTrack === true, 'INVENTORY_VIEW has ORDER_TRACK enabled by default');
    assert(ivOrderCancel === true, 'INVENTORY_VIEW has ORDER_CANCEL enabled by default');
    assert(ivWarehouse === true, 'INVENTORY_VIEW has WAREHOUSE_VIEW enabled by default');

    // Check FAISAL
    const faisalReturned = await isFeatureAllowed('FAISAL', 'RETURNED_FROM_VERIFICATION');
    const faisalDemand = await isFeatureAllowed('FAISAL', 'DEMAND_LEDGER_VIEW');
    const faisalOrderEntry = await isFeatureAllowed('FAISAL', 'ORDER_ENTRY');
    const faisalOrderView = await isFeatureAllowed('FAISAL', 'ORDER_VIEW');

    assert(faisalReturned === true, 'FAISAL has RETURNED_FROM_VERIFICATION enabled by default');
    assert(faisalDemand === true, 'FAISAL has DEMAND_LEDGER_VIEW enabled by default');
    assert(faisalOrderEntry === true, 'FAISAL has ORDER_ENTRY enabled by default');
    assert(faisalOrderView === true, 'FAISAL has ORDER_VIEW enabled by default');

    // Check STORE
    const storeTasks = await isFeatureAllowed('STORE', 'STORE_TASKS');
    const storeOrders = await isFeatureAllowed('STORE', 'ORDER_VIEW');
    const storeTracker = await isFeatureAllowed('STORE', 'ORDER_TRACK');
    const storeDemand = await isFeatureAllowed('STORE', 'DEMAND_LEDGER_VIEW');

    assert(storeTasks === true, 'STORE has STORE_TASKS enabled by default');
    assert(storeOrders === true, 'STORE has ORDER_VIEW enabled by default');
    assert(storeTracker === true, 'STORE has ORDER_TRACK enabled by default');
    assert(storeDemand === true, 'STORE has DEMAND_LEDGER_VIEW enabled by default');

    // -------------------------------------------------------------
    // Check 3: Simulated Layout.jsx navigation items
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Testing simulated Layout navigation for INVENTORY_VIEW ---');

    // Define nav items exactly matching Layout.jsx
    const testNavItems = [
      { name: 'POS Inventory', roles: ['INVENTORY_VIEW'], featureId: 'WAREHOUSE_VIEW' },
      { name: 'Order Track', roles: ['INVENTORY_VIEW'], featureId: 'ORDER_TRACK' },
      { name: 'Order Cancellation', roles: ['INVENTORY_VIEW'], featureId: 'ORDER_CANCEL' },
      { name: 'Verification', roles: ['INVENTORY_VIEW'], featureId: 'ORDER_VERIFICATION' },
      { name: 'Return & Exchange', roles: ['INVENTORY_VIEW'], featureId: 'RETURN_EXCHANGE' },
    ];

    async function filterNavItems(role) {
      const allowed = [];
      for (const item of testNavItems) {
        if (!item.roles.includes(role)) continue;
        const permitted = item.featureId ? await isFeatureAllowed(role, item.featureId) : true;
        if (permitted) allowed.push(item.name);
      }
      return allowed;
    }

    let ivNav = await filterNavItems('INVENTORY_VIEW');
    console.log('  Active INVENTORY_VIEW Navbar Items:', ivNav);
    assert(ivNav.includes('Verification'), 'Navbar includes Verification');
    assert(ivNav.includes('Return & Exchange'), 'Navbar includes Return & Exchange');
    assert(ivNav.includes('Order Track'), 'Navbar includes Order Track');
    assert(ivNav.includes('POS Inventory'), 'Navbar includes POS Inventory');
    assert(ivNav.includes('Order Cancellation'), 'Navbar includes Order Cancellation');
    assert(ivNav.length === 5, 'All 5 options visible for INVENTORY_VIEW');

    // -------------------------------------------------------------
    // Check 4: Dynamic Control via System Control (Disable & Re-enable)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Testing System Control disable & re-enable cycle ---');

    // 1. Disable RETURN_EXCHANGE for INVENTORY_VIEW in DB
    await prisma.systemControlPermission.upsert({
      where: {
        profile_featureId: {
          profile: 'INVENTORY_VIEW',
          featureId: 'RETURN_EXCHANGE'
        }
      },
      update: { isEnabled: false },
      create: {
        profile: 'INVENTORY_VIEW',
        featureId: 'RETURN_EXCHANGE',
        isEnabled: false
      }
    });
    invalidatePermissionCache();

    const disabledCheck = await isFeatureAllowed('INVENTORY_VIEW', 'RETURN_EXCHANGE');
    assert(disabledCheck === false, 'RETURN_EXCHANGE is now disabled for INVENTORY_VIEW');

    ivNav = await filterNavItems('INVENTORY_VIEW');
    console.log('  INVENTORY_VIEW Navbar after disabling RETURN_EXCHANGE:', ivNav);
    assert(!ivNav.includes('Return & Exchange'), 'Return & Exchange option cleanly removed from navbar');
    assert(ivNav.includes('Verification'), 'Verification remains visible and unaffected');
    assert(ivNav.includes('Order Track'), 'Order Track remains visible and unaffected');

    // 2. Re-enable RETURN_EXCHANGE for INVENTORY_VIEW in DB
    await prisma.systemControlPermission.upsert({
      where: {
        profile_featureId: {
          profile: 'INVENTORY_VIEW',
          featureId: 'RETURN_EXCHANGE'
        }
      },
      update: { isEnabled: true },
      create: {
        profile: 'INVENTORY_VIEW',
        featureId: 'RETURN_EXCHANGE',
        isEnabled: true
      }
    });
    invalidatePermissionCache();

    const reenabledCheck = await isFeatureAllowed('INVENTORY_VIEW', 'RETURN_EXCHANGE');
    assert(reenabledCheck === true, 'RETURN_EXCHANGE is now re-enabled for INVENTORY_VIEW');

    ivNav = await filterNavItems('INVENTORY_VIEW');
    console.log('  INVENTORY_VIEW Navbar after re-enabling RETURN_EXCHANGE:', ivNav);
    assert(ivNav.includes('Return & Exchange'), 'Return & Exchange option immediately restored to navbar');
    assert(ivNav.length === 5, 'All 5 options restored to INVENTORY_VIEW');

    // Clean up test DB permission override to leave system in clean default state
    await prisma.systemControlPermission.deleteMany({
      where: {
        profile: 'INVENTORY_VIEW',
        featureId: 'RETURN_EXCHANGE'
      }
    });
    invalidatePermissionCache();
    console.log('  Cleaned up test DB overrides');

    // -------------------------------------------------------------
    // Check 5: App.jsx Route & Redirect Guard verification
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Checking App.jsx route wiring ---');
    const appJsxContent = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/App.jsx'), 'utf8');

    assert(appJsxContent.includes('feature="ORDER_VERIFICATION"'), 'App.jsx routes verification with ORDER_VERIFICATION');
    assert(appJsxContent.includes('feature="RETURN_EXCHANGE"'), 'App.jsx routes return-exchange with RETURN_EXCHANGE');
    assert(appJsxContent.includes('feature="RETURNED_FROM_VERIFICATION"'), 'App.jsx routes returned-from-verification with RETURNED_FROM_VERIFICATION');
    assert(appJsxContent.includes('feature="DEMAND_LEDGER_VIEW"'), 'App.jsx routes demand-history with DEMAND_LEDGER_VIEW');
    assert(appJsxContent.includes("hasPermission('ORDER_VERIFICATION')"), 'AuthRedirectHandler checks ORDER_VERIFICATION for INVENTORY_VIEW');
    assert(appJsxContent.includes("hasPermission('RETURN_EXCHANGE')"), 'AuthRedirectHandler checks RETURN_EXCHANGE for INVENTORY_VIEW');

    console.log(`\n==============================================`);
    if (failures === 0) {
      console.log('🎉 ALL VERIFICATION CHECKS PASSED (100%)');
    } else {
      console.error(`💥 VERIFICATION COMPLETED WITH ${failures} FAILURE(S)`);
    }
    console.log(`==============================================\n`);

  } catch (err) {
    console.error('Fatal error during verification:', err);
    failures++;
  } finally {
    await prisma.$disconnect();
    process.exit(failures > 0 ? 1 : 0);
  }
}

run();
