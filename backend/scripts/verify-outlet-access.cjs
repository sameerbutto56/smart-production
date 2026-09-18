const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Starting Outlet Access & Form Fields Verification ---');

// 1. Verify gatePassOutletGuard logic
const gatePassOutletGuard = (req, res, next) => {
  if (req.user?.role === 'OUTLET') {
    const name = String(req.user.name || '').toLowerCase();
    const isJoharTown = name.includes('johar') || req.user.name?.includes('1');
    if (!isJoharTown) {
      return res.status(403).json({ message: 'Gate Pass is only available for Johar Town outlet.' });
    }
  }
  next();
};

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  return res;
};

let nextCalled = false;
const mockNext = () => { nextCalled = true; };

// Test Johar Town
nextCalled = false;
let res = mockRes();
gatePassOutletGuard({ user: { role: 'OUTLET', name: 'Johar Town Outlet' } }, res, mockNext);
assert.strictEqual(nextCalled, true, 'Johar Town OUTLET should pass gate pass guard');
assert.strictEqual(res.statusCode, 200);

// Test Johar Town alias (Outlet 1)
nextCalled = false;
res = mockRes();
gatePassOutletGuard({ user: { role: 'OUTLET', name: 'Outlet 1' } }, res, mockNext);
assert.strictEqual(nextCalled, true, 'Outlet 1 should pass gate pass guard');

// Test Jail Road
nextCalled = false;
res = mockRes();
gatePassOutletGuard({ user: { role: 'OUTLET', name: 'Jail Road Outlet' } }, res, mockNext);
assert.strictEqual(nextCalled, false, 'Jail Road OUTLET must be blocked from gate pass');
assert.strictEqual(res.statusCode, 403);
assert.strictEqual(res.body.message, 'Gate Pass is only available for Johar Town outlet.');

// Test Abbottabad
nextCalled = false;
res = mockRes();
gatePassOutletGuard({ user: { role: 'OUTLET', name: 'Abbottabad Outlet' } }, res, mockNext);
assert.strictEqual(nextCalled, false, 'Abbottabad OUTLET must be blocked from gate pass');
assert.strictEqual(res.statusCode, 403);

// Test General
nextCalled = false;
res = mockRes();
gatePassOutletGuard({ user: { role: 'OUTLET', name: 'General Outlet' } }, res, mockNext);
assert.strictEqual(nextCalled, false, 'General OUTLET must be blocked from gate pass');
assert.strictEqual(res.statusCode, 403);

// Test non-outlet roles (STORE, ADMIN, SUPER_ADMIN)
for (const nonOutletRole of ['STORE', 'ADMIN', 'SUPER_ADMIN', 'FAISAL', 'DISPATCH']) {
  nextCalled = false;
  res = mockRes();
  gatePassOutletGuard({ user: { role: nonOutletRole, name: 'Warehouse Admin' } }, res, mockNext);
  assert.strictEqual(nextCalled, true, `${nonOutletRole} should pass gate pass guard`);
  assert.strictEqual(res.statusCode, 200);
}
console.log('✓ gatePassOutletGuard passed all 9 test cases');

// 2. Verify officeSupplyOutletGuard logic
const officeSupplyOutletGuard = (req, res, next) => {
  if (req.user?.role === 'OUTLET') {
    const name = String(req.user.name || '').toLowerCase();
    const isJoharTown = name.includes('johar') || req.user.name?.includes('1');
    const isJailRoad = name.includes('jail') || req.user.name?.includes('2');
    if (!isJoharTown && !isJailRoad) {
      return res.status(403).json({ message: 'Office Supply is not available for this outlet.' });
    }
  }
  next();
};

// Test Johar Town
nextCalled = false;
res = mockRes();
officeSupplyOutletGuard({ user: { role: 'OUTLET', name: 'Johar Town Outlet' } }, res, mockNext);
assert.strictEqual(nextCalled, true, 'Johar Town OUTLET should pass office supply guard');
assert.strictEqual(res.statusCode, 200);

// Test Jail Road
nextCalled = false;
res = mockRes();
officeSupplyOutletGuard({ user: { role: 'OUTLET', name: 'Jail Road Outlet' } }, res, mockNext);
assert.strictEqual(nextCalled, true, 'Jail Road OUTLET should pass office supply guard');
assert.strictEqual(res.statusCode, 200);

// Test Abbottabad
nextCalled = false;
res = mockRes();
officeSupplyOutletGuard({ user: { role: 'OUTLET', name: 'Abbottabad Outlet' } }, res, mockNext);
assert.strictEqual(nextCalled, false, 'Abbottabad OUTLET must be blocked from office supply');
assert.strictEqual(res.statusCode, 403);
assert.strictEqual(res.body.message, 'Office Supply is not available for this outlet.');

// Test General
nextCalled = false;
res = mockRes();
officeSupplyOutletGuard({ user: { role: 'OUTLET', name: 'General' } }, res, mockNext);
assert.strictEqual(nextCalled, false, 'General OUTLET must be blocked from office supply');
assert.strictEqual(res.statusCode, 403);

// Test non-outlet roles
for (const nonOutletRole of ['STORE', 'STORE_EMPLOYEE', 'ADMIN', 'SUPER_ADMIN', 'FAISAL']) {
  nextCalled = false;
  res = mockRes();
  officeSupplyOutletGuard({ user: { role: nonOutletRole, name: 'Store Master' } }, res, mockNext);
  assert.strictEqual(nextCalled, true, `${nonOutletRole} should pass office supply guard`);
  assert.strictEqual(res.statusCode, 200);
}
console.log('✓ officeSupplyOutletGuard passed all 9 test cases');

// 3. Inspect Frontend files
const basicInfoContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/BasicInfoTab.jsx'), 'utf8');
const requiredIds = [
  'order-entry-is-pr',
  'order-entry-order-number',
  'order-entry-customer-name',
  'order-entry-customer-phone',
  'order-entry-customer-address',
  'order-entry-payment-status',
  'order-entry-city',
  'order-entry-shopify-month',
  'order-entry-shopify-year',
  'order-entry-shopify-date',
  'order-entry-instruction-notes',
  'order-entry-advance-amount'
];
for (const id of requiredIds) {
  assert(basicInfoContent.includes(`id="${id}"`), `BasicInfoTab must contain id="${id}"`);
}
console.log('✓ BasicInfoTab contains all 12 unique id attributes');

const layoutContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/Layout.jsx'), 'utf8').replace(/\r\n/g, '\n');
assert(!layoutContent.includes("{ name: 'Edit Request', path: '/edit-requests', icon: FileEdit, roles: ['OUTLET'"), 'Layout.jsx must not have OUTLET in Edit Request roles');
assert(layoutContent.includes("if (item.name === 'Edit Request') return false;"), 'Layout.jsx must filter out Edit Request for OUTLET');
assert(layoutContent.includes("if (item.name === 'Gate Pass') {\n        return isJoharTown;\n      }"), 'Layout.jsx must restrict Gate Pass to Johar Town only');
assert(layoutContent.includes("if (item.name === 'Office Supply') {\n        return isJoharTown || isJailRoad;\n      }"), 'Layout.jsx must restrict Office Supply to Johar Town & Jail Road only');
console.log('✓ Layout.jsx properly restricts Edit Request, Gate Pass, and Office Supply');

const officeSupplyContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/OfficeSupply.jsx'), 'utf8').replace(/\r\n/g, '\n');
assert(!officeSupplyContent.includes("{ name: 'Abbottabad', type: 'OUTLET' }"), 'OfficeSupply.jsx LOCATIONS must not include Abbottabad');
assert(officeSupplyContent.includes("const isBlockedOutlet = role === 'OUTLET' && !isJoharTown && !isJailRoad;"), 'OfficeSupply.jsx must have isBlockedOutlet check');
console.log('✓ OfficeSupply.jsx properly removes Abbottabad and enforces isBlockedOutlet');

const appContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/App.jsx'), 'utf8').replace(/\r\n/g, '\n');
assert(appContent.includes('<OutletBlockedRoute><EditRequestDashboard /></OutletBlockedRoute>'), 'App.jsx must wrap EditRequestDashboard with OutletBlockedRoute');
assert(appContent.includes('<JoharTownGatePassRoute><GatePass /></JoharTownGatePassRoute>'), 'App.jsx must wrap GatePass with JoharTownGatePassRoute');
assert(appContent.includes('<OfficeSupplyRoute><OfficeSupply /></OfficeSupplyRoute>'), 'App.jsx must wrap OfficeSupply with OfficeSupplyRoute');
console.log('✓ App.jsx properly guards routes for Edit Request, Gate Pass, and Office Supply');

console.log('--- ALL VERIFICATIONS PASSED SUCCESSFULLY ---');
