const { isFeatureAllowed, invalidatePermissionCache } = require('../src/middleware/systemControl.middleware');
const { FEATURES } = require('../src/utils/featureRegistry');

async function testOutletTasksNavbar() {
  console.log('--- Step 1: Checking Feature Registry Definitions ---');
  const outletTasksDef = FEATURES.find(f => f.id === 'OUTLET_TASKS');
  if (!outletTasksDef) {
    throw new Error('OUTLET_TASKS not found in FEATURES!');
  }
  console.log('✅ OUTLET_TASKS found:', outletTasksDef.name, outletTasksDef.defaultProfiles);

  const storeTasksDef = FEATURES.find(f => f.id === 'STORE_TASKS');
  console.log('✅ STORE_TASKS defaultProfiles:', storeTasksDef.defaultProfiles);
  if (!storeTasksDef.defaultProfiles.includes('OUTLET')) {
    throw new Error('OUTLET missing from STORE_TASKS defaultProfiles');
  }

  console.log('\n--- Step 2: Checking Permission Resolution for OUTLET ---');
  invalidatePermissionCache();
  const allowedOutletTasks = await isFeatureAllowed('OUTLET', 'OUTLET_TASKS');
  console.log('OUTLET -> OUTLET_TASKS allowed:', allowedOutletTasks);
  if (!allowedOutletTasks) {
    throw new Error('OUTLET_TASKS should be allowed for OUTLET by default');
  }

  const allowedStoreTasks = await isFeatureAllowed('OUTLET', 'STORE_TASKS');
  console.log('OUTLET -> STORE_TASKS allowed:', allowedStoreTasks);
  if (!allowedStoreTasks) {
    throw new Error('STORE_TASKS should be allowed for OUTLET by default');
  }

  console.log('\n--- Step 3: Simulating Layout Navbar Filtering for Johar Town Outlet ---');
  const user = { name: 'Johar Town Outlet', role: 'OUTLET' };
  const userRole = 'OUTLET';
  const isJoharTown = true;
  const isJailRoad = false;

  const mockPermissions = {
    OUTLET_TASKS: true,
    OUTLET_DASHBOARD: true,
    OUTLET_POS: true,
    OUTLET_ORDER_VIEW: true,
    OUTLET_INVOICE_QUOTATION: true,
    ORDER_VIEW: true,
    OUTLET_TRANSFERS: true,
    WAREHOUSE_VIEW: true,
    OUTLET_STOCK_REQUEST: true,
    OUTLET_ORDER_ENTRY: true,
    OUTLET_IN_DISPATCH: true,
    OUTLET_GATE_PASS: true,
    ORDER_TRACK: true,
    ALTERATION_PRODUCTION: true,
    ENGRAVING_QUEUE: true,
    GENERAL_ENTRIES: true,
    BANK_DEPOSIT: true,
    STORE_TASKS: true,
  };

  const hasPermission = (feat) => mockPermissions[feat] !== false;

  const navItems = [
    { name: 'Outlet Dashboard', path: '/outlet-dashboard', roles: ['OUTLET'], featureId: 'OUTLET_DASHBOARD' },
    { name: 'POS', path: '/pos', roles: ['OUTLET'], featureId: 'OUTLET_POS' },
    { name: 'Orders', path: '/outlet-orders', roles: ['OUTLET'], featureId: 'OUTLET_ORDER_VIEW' },
    { name: 'Invoice / Quotation', path: '/outlet-invoice-quotation', roles: ['OUTLET'], featureId: 'OUTLET_INVOICE_QUOTATION' },
    { name: 'History', path: '/history', roles: ['OUTLET', 'SUPER_ADMIN', 'ADMIN', 'CEO'], featureId: 'ORDER_VIEW' },
    { name: 'Transfers', path: '/transfers', roles: ['OUTLET', 'STORE'], featureId: 'OUTLET_TRANSFERS' },
    { name: 'My Tasks', path: '/tasks', roles: ['STORE', 'PRODUCTION', 'OUTLET'], featureId: 'STORE_TASKS' },
    { name: 'POS Inventory', path: '/pos-inventory', roles: ['OUTLET', 'STORE'], featureId: 'WAREHOUSE_VIEW' },
    { name: 'Outlet Requests', path: '/outlet-requests', roles: ['OUTLET'], featureId: 'OUTLET_STOCK_REQUEST' },
    { name: 'Outlet Order Entry', path: '/outlet-order-entry', roles: ['OUTLET'], featureId: 'OUTLET_ORDER_ENTRY' },
    { name: 'In Dispatch', path: '/in-dispatch', roles: ['OUTLET'], featureId: 'OUTLET_IN_DISPATCH' },
    { name: 'Gate Pass', path: '/gate-pass', roles: ['OUTLET'], featureId: 'OUTLET_GATE_PASS' },
    { name: 'Order Track', path: '/order-track', roles: ['OUTLET'], featureId: 'ORDER_TRACK' },
    { name: 'Client Registration', path: '/clients', roles: ['OUTLET'], featureId: 'OUTLET_ORDER_ENTRY' },
    { name: 'Alteration', path: '/alteration-request', roles: ['OUTLET'], featureId: 'ALTERATION_PRODUCTION' },
    { name: 'Engraving', path: '/engraving-request', roles: ['OUTLET'], featureId: 'ENGRAVING_QUEUE' },
    { name: 'General Entries', path: '/journal', roles: ['OUTLET'], featureId: 'GENERAL_ENTRIES' },
    { name: 'Bank Deposit', path: '/bank-deposit', roles: ['OUTLET'], featureId: 'BANK_DEPOSIT' },
    { name: 'Chat', path: '/chat', roles: ['OUTLET'] },
    { name: 'Notifications', path: '/notifications', roles: ['OUTLET'] },
    { name: 'Notes', path: '/notes', roles: ['OUTLET'] },
    { name: 'Office Supply', path: '/office-supply', roles: ['OUTLET'] },
  ];

  const filterNav = (permMap) => {
    return navItems.filter(item => {
      // 1. Basic role check
      if (!item.roles.includes(userRole)) return false;

      // Resolve dynamic feature ID based on role if shared
      let featureIdToCheck = item.featureId;
      if (userRole === 'OUTLET') {
        if (item.name === 'My Tasks') {
          featureIdToCheck = 'OUTLET_TASKS';
        } else if (item.name === 'History') {
          featureIdToCheck = 'OUTLET_ORDER_VIEW';
        }
      }

      // 0. System Control Feature check (if featureId defined)
      if (featureIdToCheck && permMap(featureIdToCheck) === false) return false;

      // 2. Extra safety for Outlets
      if (userRole === 'OUTLET') {
        if (item.name === 'Edit Request') return false;
        if (item.name === 'Invoice / Quotation') return isJoharTown;
        if (item.name === 'Orders' && item.path === '/outlet-orders') return isJoharTown || isJailRoad;
        if (item.name === 'History') return isJoharTown || isJailRoad;
        if (item.name === 'In Dispatch') return isJoharTown;
        if (item.name === 'Gate Pass') return isJoharTown;
        if (item.name === 'Office Supply') return isJoharTown || isJailRoad;

        return [
          'Outlet Dashboard', 'POS', 'Orders', 'Invoice / Quotation', 'History',
          'Transfers', 'Outlet Requests', 'Client Registration', 'POS Inventory',
          'Outlet Order Entry', 'Alteration', 'Engraving', 'General Entries',
          'Bank Deposit', 'Chat', 'Notes', 'My Tasks', 'Order Track', 'Notifications'
        ].includes(item.name);
      }
      return true;
    });
  };

  const defaultVisible = filterNav(hasPermission).map(i => i.name);
  console.log('Visible items with default permissions:', defaultVisible);
  if (!defaultVisible.includes('My Tasks')) {
    throw new Error('FAIL: "My Tasks" is NOT visible in Johar Town navbar!');
  }
  console.log('✅ PASS: "My Tasks" is visible in Johar Town navbar!');

  console.log('\n--- Step 4: Testing System Control Disable (OUTLET_TASKS = false) ---');
  const disabledPerms = (feat) => feat === 'OUTLET_TASKS' ? false : true;
  const disabledVisible = filterNav(disabledPerms).map(i => i.name);
  console.log('Visible items when OUTLET_TASKS is disabled:', disabledVisible);
  if (disabledVisible.includes('My Tasks')) {
    throw new Error('FAIL: "My Tasks" should be hidden when OUTLET_TASKS is disabled!');
  }
  console.log('✅ PASS: "My Tasks" is cleanly hidden when OUTLET_TASKS is disabled in System Control!');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

testOutletTasksNavbar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
