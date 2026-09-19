const assert = require('assert');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// 1. Simulate the api.js response interceptor logic
function shouldInterceptorSkipLogout(error, currentPath = '/orders') {
  const url = error.config?.url || '';
  const msg = String(error.response?.data?.message || error.response?.data?.error || '').toLowerCase();
  const isPasswordOrCredentialError =
    msg.includes('password') ||
    msg.includes('employee') ||
    msg.includes('access denied') ||
    msg.includes('credential') ||
    msg.includes('incorrect');

  const isSubAuthUrl =
    url.includes('/verify-employee') ||
    url.includes('/auth/verify') ||
    url.includes('/journal/auth') ||
    url.includes('/bank-deposits/auth') ||
    url.includes('/change-password') ||
    url.includes('/system-wipe') ||
    url.includes('/toggle-pause') ||
    url.includes('/system/pause') ||
    url.includes('/system/resume');

  const shouldSkipRedirect =
    Boolean(error.config?.skipAuthRedirect) ||
    Boolean(error.config?.headers?.['x-skip-auth-redirect']) ||
    isSubAuthUrl ||
    isPasswordOrCredentialError;

  const wouldRedirectToLogin = error.response?.status === 401 && currentPath !== '/login' && !shouldSkipRedirect;
  return {
    shouldSkipRedirect,
    wouldRedirectToLogin,
    isPasswordOrCredentialError,
    isSubAuthUrl
  };
}

console.log('--- Testing Frontend Interceptor Logic ---');

// Case A: Wrong employee password in ProfileEmployeeGate / Faisal / Dispatch / POS
const gateError = {
  config: { url: '/api/software-settings/verify-employee' },
  response: {
    status: 400,
    data: { ok: false, message: 'Incorrect password. Please try again.' }
  }
};
let res = shouldInterceptorSkipLogout(gateError, '/store');
assert.strictEqual(res.wouldRedirectToLogin, false, 'Should NOT redirect to login on gate wrong password');
assert.strictEqual(res.shouldSkipRedirect, true);
console.log('✓ ProfileEmployeeGate wrong password: skips logout, remains in profile');

// Case B: Wrong employee password even if status were 401
const gateError401 = {
  config: { url: '/api/software-settings/verify-employee' },
  response: {
    status: 401,
    data: { message: 'Incorrect password. Please try again.' }
  }
};
res = shouldInterceptorSkipLogout(gateError401, '/production');
assert.strictEqual(res.wouldRedirectToLogin, false, 'Should NOT redirect to login on gate 401');
assert.strictEqual(res.shouldSkipRedirect, true);
console.log('✓ ProfileEmployeeGate 401 fallback: safely prevented logout');

// Case C: Wrong Abbottabad password modal
const abbottabadError = {
  config: { url: '/api/abbottabad/auth/verify' },
  response: {
    status: 400,
    data: { success: false, message: 'Invalid Abbottabad password. Access denied.' }
  }
};
res = shouldInterceptorSkipLogout(abbottabadError, '/abbottabad');
assert.strictEqual(res.wouldRedirectToLogin, false, 'Should NOT redirect on Abbottabad wrong password');
assert.strictEqual(res.shouldSkipRedirect, true);
console.log('✓ Abbottabad wrong password: skips logout, displays in modal');

// Case D: Outlet Order Entry wrong password
const outletOrderError = {
  config: { url: '/api/outlet-orders/verify-employee' },
  response: {
    status: 400,
    data: { ok: false, message: 'Incorrect password. Please try again.' }
  }
};
res = shouldInterceptorSkipLogout(outletOrderError, '/outlet-order-entry');
assert.strictEqual(res.wouldRedirectToLogin, false, 'Should NOT redirect on Outlet Order Entry wrong password');
assert.strictEqual(res.shouldSkipRedirect, true);
console.log('✓ Outlet Order Entry wrong password: skips logout, displays inline');

// Case E: Admin change-password wrong admin password
const adminError = {
  config: { url: '/api/admin/change-password' },
  response: {
    status: 400,
    data: { message: 'Admin password is incorrect' }
  }
};
res = shouldInterceptorSkipLogout(adminError, '/admin');
assert.strictEqual(res.wouldRedirectToLogin, false, 'Should NOT redirect on Admin change password error');
assert.strictEqual(res.shouldSkipRedirect, true);
console.log('✓ Admin wrong password: skips logout, displays in settings');

// Case F: Real JWT session expiry on protected resource
const sessionExpiredError = {
  config: { url: '/api/orders?page=1' },
  response: {
    status: 401,
    headers: { 'x-token-error': 'invalid' },
    data: { message: 'Invalid token', code: 'INVALID_TOKEN' }
  }
};
res = shouldInterceptorSkipLogout(sessionExpiredError, '/orders');
assert.strictEqual(res.wouldRedirectToLogin, true, 'MUST redirect to login on true token expiry');
assert.strictEqual(res.shouldSkipRedirect, false);
console.log('✓ True JWT session expiry: triggers redirect to /login as required');

// Case G: Token missing on protected resource
const tokenMissingError = {
  config: { url: '/api/products' },
  response: {
    status: 401,
    headers: { 'x-token-error': 'missing' },
    data: { message: 'No token provided', code: 'NO_TOKEN' }
  }
};
res = shouldInterceptorSkipLogout(tokenMissingError, '/inventory-view');
assert.strictEqual(res.wouldRedirectToLogin, true, 'MUST redirect to login when token missing');
assert.strictEqual(res.shouldSkipRedirect, false);
console.log('✓ Missing token: triggers redirect to /login as required');

console.log('\nALL INTERCEPTOR & PASSWORD CHECKS PASSED PERFECTLY!');
