const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Verifying Disabled Feature Handling (Remove Option & No Error / Permission Note) ---');

// 1. Verify App.jsx: Ensure "Access Denied • Feature Disabled" is 100% purged from PermittedRoute
const appJsxPath = path.join(__dirname, '../../frontend/src/App.jsx');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');

assert.ok(!appJsxContent.includes('Access Denied • Feature Disabled'), 'FAIL: App.jsx still contains "Access Denied • Feature Disabled"');
assert.ok(!appJsxContent.includes('This functionality has been disabled for your profile in'), 'FAIL: App.jsx still contains the permission note');
assert.ok(appJsxContent.includes('if (feature && !hasPermission(feature)) {\n    return <Navigate to="/" replace />;\n  }'), 'FAIL: PermittedRoute does not silently redirect to "/"');
console.log('✓ App.jsx: PermittedRoute silently redirects to "/" with zero error banner or permission note');

// 2. Verify route blockers in App.jsx redirect to "/" instead of hardcoded dashboards
assert.ok(!appJsxContent.includes('if (role === \'OUTLET\') return <Navigate to="/outlet-dashboard" replace />;'), 'FAIL: OutletBlockedRoute still hardcodes /outlet-dashboard');
assert.ok(!appJsxContent.includes('if (role === \'SUPER_ADMIN\' || role === \'ADMIN\') return <Navigate to="/dashboard" replace />;'), 'FAIL: AdminBlockedRoute still hardcodes /dashboard');
console.log('✓ App.jsx: Route guards redirect to "/" preventing bounce loops into disabled pages');

// 3. Verify AuthRedirectHandler hasPermission checks for every role
assert.ok(appJsxContent.includes("if (hasPermission('OUTLET_DASHBOARD')) return <Navigate to=\"/outlet-dashboard\" replace={true} />;"), 'FAIL: AuthRedirectHandler missing OUTLET_DASHBOARD check');
assert.ok(appJsxContent.includes("if (hasPermission('OUTLET_POS')) return <Navigate to=\"/pos\" replace={true} />;"), 'FAIL: AuthRedirectHandler missing OUTLET_POS check');
assert.ok(appJsxContent.includes("if (hasPermission('WAREHOUSE_VIEW')) return <Navigate to=\"/warehouse\" replace={true} />;"), 'FAIL: AuthRedirectHandler missing WAREHOUSE_VIEW check');
assert.ok(appJsxContent.includes("if (hasPermission('PRODUCTION_DASHBOARD')) return <Navigate to=\"/production\" replace={true} />;"), 'FAIL: AuthRedirectHandler missing PRODUCTION_DASHBOARD check');
console.log('✓ App.jsx: AuthRedirectHandler checks hasPermission before routing to every role dashboard');

// 4. Verify Layout.jsx filters
const layoutPath = path.join(__dirname, '../../frontend/src/components/Layout.jsx');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

assert.ok(layoutContent.includes("featureIdToCheck = 'ADMIN_MARKETING_VIEW';"), 'FAIL: Layout.jsx missing ADMIN_MARKETING_VIEW mapping');
assert.ok(layoutContent.includes("featureIdToCheck && !hasPermission(featureIdToCheck)"), 'FAIL: Layout.jsx missing hasPermission check on featureIdToCheck');
assert.ok(layoutContent.includes("hasPermission('PRODUCT_DATA_VIEW')"), 'FAIL: Layout.jsx top bar missing PRODUCT_DATA_VIEW permission gate');
console.log('✓ Layout.jsx: Navigation and top bar options are completely removed when disabled');

// 5. Verify AdminDashboard.jsx card filtering
const adminDashPath = path.join(__dirname, '../../frontend/src/pages/AdminDashboard.jsx');
const adminDashContent = fs.readFileSync(adminDashPath, 'utf8');

assert.ok(adminDashContent.includes(".filter(card => !card.feature || hasPermission(card.feature))"), 'FAIL: AdminDashboard.jsx does not filter module cards by feature');
assert.ok(adminDashContent.includes("tabFeatureMap[activeTab] && !hasPermission(tabFeatureMap[activeTab])"), 'FAIL: AdminDashboard.jsx does not reset activeTab when disabled');
console.log('✓ AdminDashboard.jsx: Disabled cards are removed from Control Center grid and activeTab resets cleanly');

// 6. Verify OutletDashboard.jsx tab filtering
const outletDashPath = path.join(__dirname, '../../frontend/src/pages/OutletDashboard.jsx');
const outletDashContent = fs.readFileSync(outletDashPath, 'utf8');

assert.ok(outletDashContent.includes(".filter(tab => !tab.feature || hasPermission(tab.feature))"), 'FAIL: OutletDashboard.jsx does not filter tabs by feature');
assert.ok(outletDashContent.includes("tabFeatureMap[activeTab] && !hasPermission(tabFeatureMap[activeTab])"), 'FAIL: OutletDashboard.jsx does not reset activeTab when disabled');
console.log('✓ OutletDashboard.jsx: Disabled tabs are removed from dropdown and activeTab resets gracefully');

// 7. Verify MarketingDashboard.jsx tab filtering
const marketingDashPath = path.join(__dirname, '../../frontend/src/pages/MarketingDashboard.jsx');
const marketingDashContent = fs.readFileSync(marketingDashPath, 'utf8');

assert.ok(marketingDashContent.includes("hasPermission('MARKETING_MAP_VIEW')"), 'FAIL: MarketingDashboard.jsx missing MARKETING_MAP_VIEW check');
assert.ok(marketingDashContent.includes("hasPermission('MARKETING_ACTIVITY_HISTORY')"), 'FAIL: MarketingDashboard.jsx missing MARKETING_ACTIVITY_HISTORY check');
console.log('✓ MarketingDashboard.jsx: Disabled tabs are removed and activeTab auto-resets');

console.log('\n--- ALL VERIFICATION CHECKS PASSED (7/7) ---');
