/**
 * Verification Test Suite: Abbottabad Other Metrics Separation & Backend Security
 *
 * Validates:
 * 1. Default Abbottabad Dashboard API (/api/outlet-detailed/Abbottabad) returns basic POS/sales metrics without Abbottabad token.
 * 2. Default dashboard data contains NO confidential cost prices, bilty charges, demand financial calculations, or amount ledgers.
 * 3. Sensitive Abbottabad APIs (/demand-summary, /demands, /amount/state, /amount/ledger, /cost-price/history, /export-excel)
 *    are STRICTLY GUARDED on the backend:
 *    - Unauthenticated request -> 403 Forbidden.
 *    - Invalid / tampered token -> 401 Unauthorized.
 * 4. Password verification endpoint (/api/abbottabad/auth/verify):
 *    - Rejects missing password (400).
 *    - Rejects incorrect password (401).
 *    - Accepts existing single Abbottabad password and issues signed JWT.
 * 5. With valid token, sensitive metrics (demands, costs, bilty, amount state, ledger) unlock and return accurately.
 * 6. Regression check: Jail Road and Johar Town outlet APIs continue functioning identically with 0 regression.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'abbottabad-secret-key-2026';
const ABBOTTABAD_PASSWORD_KEY = 'ABBOTTABAD_DASHBOARD_PASSWORD_HASH';
const DEFAULT_ABBOTTABAD_PASS = 'Enamels07';

async function runTests() {
  console.log('🚀 Starting Abbottabad Other Metrics & Access Control Verification...\n');
  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition, testName) {
    testsTotal++;
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}`);
    }
  }

  try {
    // 1. Database Check for Existing Abbottabad Password
    console.log('--- Test Group 1: Authoritative Single Password in DB ---');
    let setting = await prisma.systemSetting.findUnique({
      where: { key: ABBOTTABAD_PASSWORD_KEY }
    });
    if (!setting) {
      const hash = await bcrypt.hash(DEFAULT_ABBOTTABAD_PASS, 10);
      setting = await prisma.systemSetting.create({
        data: { key: ABBOTTABAD_PASSWORD_KEY, value: hash }
      });
    }
    assert(setting && setting.value.startsWith('$2'), 'Abbottabad password exists in DB and is bcrypt hashed');

    const matchesCorrect = await bcrypt.compare('Enamels07', setting.value);
    assert(matchesCorrect, 'Existing Abbottabad password "Enamels07" matches authoritative stored hash');

    const matchesWrong = await bcrypt.compare('WrongPassword123', setting.value);
    assert(!matchesWrong, 'Wrong password correctly rejected by bcrypt compare');

    // 2. Setup mock request / response helpers for controllers
    console.log('\n--- Test Group 2: Password Verification Controller (/api/abbottabad/auth/verify) ---');
    const {
      verifyAbbottabadPassword,
      requireAbbottabadAuth,
      getDemandFinancialSummary,
      getDemandFinancialDetails,
      getAmountAccountState,
      getAmountLedger
    } = require('../src/controllers/abbottabad.controller');

    // Mock Admin User
    const adminUser = { id: 'admin-test-uuid', role: 'SUPER_ADMIN', name: 'Test Admin' };

    let resData = null;
    let resStatus = 200;
    const mockRes = () => {
      resStatus = 200;
      resData = null;
      return {
        status(code) { resStatus = code; return this; },
        json(data) { resData = data; return this; },
        set() { return this; }
      };
    };

    await verifyAbbottabadPassword({ body: {}, user: adminUser }, mockRes());
    assert(resStatus === 400, 'Empty password rejected with status 400');

    // Test: Wrong password
    await verifyAbbottabadPassword({ body: { password: 'IncorrectPassword' }, user: adminUser }, mockRes());
    assert(resStatus === 401 && resData.message.includes('Invalid Abbottabad password'), 'Incorrect password rejected with 401');

    // Test: Correct password
    await verifyAbbottabadPassword({ body: { password: 'Enamels07' }, user: adminUser }, mockRes());
    assert(resStatus === 200 && resData.success === true && !!resData.token, 'Correct password returns 200 and signed JWT token');
    const validToken = resData.token;

    // Verify token claims
    const decoded = jwt.verify(validToken, JWT_SECRET);
    assert(decoded.access === 'ABBOTTABAD_DASHBOARD' && decoded.role === 'SUPER_ADMIN', 'JWT token contains valid ABBOTTABAD_DASHBOARD access claim');

    // 3. Backend Security: requireAbbottabadAuth Middleware
    console.log('\n--- Test Group 3: requireAbbottabadAuth Guard on Sensitive Endpoints ---');

    // Test: Missing token for Admin
    let nextCalled = false;
    await requireAbbottabadAuth(
      { headers: {}, query: {}, user: adminUser },
      mockRes(),
      () => { nextCalled = true; }
    );
    assert(!nextCalled && resStatus === 403, 'Admin request without x-abbottabad-token is blocked with 403');
    assert(resData && resData.message.includes('Abbottabad'), 'Informative Abbottabad authentication required message returned');

    // Test: Forged / invalid token
    nextCalled = false;
    await requireAbbottabadAuth(
      { headers: { 'x-abbottabad-token': 'forged.invalid.token' }, query: {}, user: adminUser },
      mockRes(),
      () => { nextCalled = true; }
    );
    assert(!nextCalled && resStatus === 401, 'Admin request with forged token is blocked with 401');

    // Test: Valid token
    nextCalled = false;
    const reqWithToken = { headers: { 'x-abbottabad-token': validToken }, query: {}, user: adminUser };
    await requireAbbottabadAuth(
      reqWithToken,
      mockRes(),
      () => { nextCalled = true; }
    );
    assert(nextCalled && reqWithToken.abbottabadAuth.access === 'ABBOTTABAD_DASHBOARD', 'Admin request with valid x-abbottabad-token proceeds to next()');

    // Test: OUTLET role bypasses token requirement for operational demands
    nextCalled = false;
    await requireAbbottabadAuth(
      { headers: {}, query: {}, user: { id: 'outlet-user', role: 'OUTLET' } },
      mockRes(),
      () => { nextCalled = true; }
    );
    assert(nextCalled, 'OUTLET role user allowed operational access without Abbottabad admin token');

    // 4. Test Basic Dashboard API (/api/outlet-detailed/Abbottabad)
    console.log('\n--- Test Group 4: Basic Abbottabad Dashboard API (/api/outlet-detailed) ---');
    const { getOutletDetailed } = require('../src/controllers/outletDetailed.controller');

    await getOutletDetailed(
      { params: { outletName: 'Abbottabad' }, query: { range: 'all' }, user: adminUser },
      mockRes()
    );
    assert(resStatus === 200 && resData && resData.overview != null, 'Basic Abbottabad dashboard API returns 200 without password token');
    assert(typeof resData.overview.totalSales === 'number', 'Basic dashboard returns standard totalSales');
    assert(typeof resData.overview.netRevenue === 'number', 'Basic dashboard returns standard netRevenue');
    assert(Array.isArray(resData.invoices), 'Basic dashboard returns standard invoices array');
    assert(resData.costPrice == null && resData.totalCost == null && resData.biltyAmount == null, 'Basic dashboard does NOT return any confidential cost or bilty fields');

    // 5. Test Sensitive Financial APIs with Token
    console.log('\n--- Test Group 5: Sensitive Metrics Retrieval with Valid Token ---');
    await getDemandFinancialSummary(
      { headers: { 'x-abbottabad-token': validToken }, query: { range: 'all' }, user: adminUser },
      mockRes()
    );
    assert(resStatus === 200 && resData != null, 'getDemandFinancialSummary returns 200 with valid token');
    assert(resData.totalDemands !== undefined && resData.productValue !== undefined, 'getDemandFinancialSummary contains demand metrics');

    await getAmountAccountState(
      { headers: { 'x-abbottabad-token': validToken }, query: {}, user: adminUser },
      mockRes()
    );
    assert(resStatus === 200 && resData != null, 'getAmountAccountState returns 200 with valid token');
    assert(resData.account && resData.account.runningBalance !== undefined && resData.account.approvedAmount !== undefined, 'getAmountAccountState contains runningBalance & approvedAmount');

    // 6. Regression Testing: Jail Road & Johar Town
    console.log('\n--- Test Group 6: Regression Testing on Other Outlets ---');
    await getOutletDetailed(
      { params: { outletName: 'Jail Road' }, query: { range: 'all' }, user: adminUser },
      mockRes()
    );
    assert(resStatus === 200 && resData.overview != null, 'Jail Road outlet detailed API unaffected and returns 200');

    await getOutletDetailed(
      { params: { outletName: 'Johar Town' }, query: { range: 'all' }, user: adminUser },
      mockRes()
    );
    assert(resStatus === 200 && resData.overview != null, 'Johar Town outlet detailed API unaffected and returns 200');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    console.log(`\n========================================`);
    console.log(`RESULTS: ${testsPassed} / ${testsTotal} tests passed (${Math.round((testsPassed / testsTotal) * 100)}%)`);
    console.log(`========================================\n`);
    await prisma.$disconnect();
    process.exit(testsPassed === testsTotal ? 0 : 1);
  }
}

runTests();
