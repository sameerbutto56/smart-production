// Automated verification script for Admin cleanup, route protection, and navigation/responsive features
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Starting Admin Cleanup & Navigation Verification ---');

// 1. Verify Layout.jsx navItems
const layoutPath = path.join(__dirname, '../../frontend/src/components/Layout.jsx');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

assert(!layoutContent.includes("to: '/software-settings?tab=employees'"), 'Employee Management should be removed from Layout.jsx navItems');
assert(!layoutContent.includes("to: '/vendors-admin'"), 'Vendors should be removed from Layout.jsx navItems');
assert(!layoutContent.includes("to: '/postex-dashboard'"), 'PostEx Dashboard should be removed from Layout.jsx navItems');

// Check that ASM Allowed is restricted to STORE and not ADMIN/SUPER_ADMIN
const asmAllowedNavMatch = layoutContent.match(/name:\s*'ASM Allowed'[\s\S]*?roles:\s*\[(.*?)\]/);
assert(asmAllowedNavMatch, 'ASM Allowed nav item should exist');
const asmRoles = asmAllowedNavMatch[1];
assert(!asmRoles.includes('ADMIN') && !asmRoles.includes('SUPER_ADMIN'), 'ASM Allowed should not have ADMIN or SUPER_ADMIN in roles');
assert(asmRoles.includes('STORE'), 'ASM Allowed should be available for STORE');

// Check that Office Supply is restricted away from ADMIN/SUPER_ADMIN
const officeSupplyNavMatch = layoutContent.match(/name:\s*'Office Supply'[\s\S]*?roles:\s*\[(.*?)\]/);
assert(officeSupplyNavMatch, 'Office Supply nav item should exist');
const officeSupplyRoles = officeSupplyNavMatch[1];
assert(!officeSupplyRoles.includes('ADMIN') && !officeSupplyRoles.includes('SUPER_ADMIN'), 'Office Supply should not have ADMIN or SUPER_ADMIN');
assert(officeSupplyRoles.includes('STORE'), 'Office Supply should be available for STORE');

// Check Universal Back Button in Layout.jsx
assert(layoutContent.includes('const { goBack } = useAppBack()') || layoutContent.includes('const { goBack } = useAppBack();'), 'Layout.jsx should use useAppBack hook');
assert(layoutContent.includes('onClick={goBack}'), 'Layout.jsx header should have back button wired to goBack');

console.log('✓ Layout.jsx navbar cleanup and universal back button verified');

// 2. Verify AdminDashboard.jsx
const adminDashPath = path.join(__dirname, '../../frontend/src/pages/AdminDashboard.jsx');
const adminDashContent = fs.readFileSync(adminDashPath, 'utf8');

assert(!adminDashContent.includes("id: 'postex'"), 'PostEx card should be removed from AdminDashboard.jsx cards');
assert(!adminDashContent.includes("id: 'vendors'"), 'Vendors card should be removed from AdminDashboard.jsx cards');
assert(!adminDashContent.includes("id: 'asm'"), 'ASM card should be removed from AdminDashboard.jsx cards');
assert(adminDashContent.includes('useSearchParams'), 'AdminDashboard.jsx should sync tab with useSearchParams');
assert(adminDashContent.includes('BackButton') || adminDashContent.includes('setActiveTab(null)'), 'AdminDashboard.jsx should have back navigation when tab is open');

console.log('✓ AdminDashboard.jsx card removal and tab navigation verified');

// 3. Verify App.jsx route guards
const appPath = path.join(__dirname, '../../frontend/src/App.jsx');
const appContent = fs.readFileSync(appPath, 'utf8');

assert(appContent.includes('AdminBlockedRoute'), 'App.jsx should define AdminBlockedRoute');
assert(appContent.includes('<AdminBlockedRoute><PostExDashboard /></AdminBlockedRoute>'), 'PostEx route should be protected by AdminBlockedRoute');
assert(appContent.includes('<AdminBlockedRoute><VendorsPage /></AdminBlockedRoute>'), 'Vendors route should be protected by AdminBlockedRoute');
assert(appContent.includes('<AdminBlockedRoute><AsmPage /></AdminBlockedRoute>'), 'ASM route should be protected by AdminBlockedRoute');
assert(appContent.includes('<AdminBlockedRoute><AsmAllowedStorePage /></AdminBlockedRoute>'), 'ASM Allowed route should be protected by AdminBlockedRoute');

console.log('✓ App.jsx AdminBlockedRoute guards verified');

// 4. Verify BackButton component and useAppBack hook
const backBtnPath = path.join(__dirname, '../../frontend/src/components/BackButton.jsx');
const useAppBackPath = path.join(__dirname, '../../frontend/src/hooks/useAppBack.js');
assert(fs.existsSync(backBtnPath), 'BackButton.jsx component should exist');
assert(fs.existsSync(useAppBackPath), 'useAppBack.js hook should exist');

const useAppBackContent = fs.readFileSync(useAppBackPath, 'utf8');
assert(useAppBackContent.includes('navigate(-1)'), 'useAppBack should support browser history step back');
assert(useAppBackContent.includes('window.history.state') && useAppBackContent.includes('window.history.state.idx'), 'useAppBack should inspect history state depth');

console.log('✓ BackButton and useAppBack hook verified');

// 5. Verify modal responsiveness on key pages
const pagesToCheck = [
  '../../frontend/src/pages/DispatchPage.jsx',
  '../../frontend/src/pages/OrderCancellations.jsx',
  '../../frontend/src/pages/FaisalOrderCancellation.jsx',
  '../../frontend/src/pages/VerificationPage.jsx',
  '../../frontend/src/pages/FaisalReplacements.jsx'
];

for (const p of pagesToCheck) {
  const content = fs.readFileSync(path.join(__dirname, p), 'utf8');
  assert(content.includes('max-h-[90vh]') && content.includes('overflow-y-auto'), `${p} should have responsive max-height and overflow-y-auto on modals`);
}

console.log('✓ Modal responsiveness across key pages verified');

console.log('--- All Admin Cleanup & Navigation Checks Passed! ---');
