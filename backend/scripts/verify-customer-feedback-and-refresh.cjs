/**
 * Comprehensive Automated Verification Script:
 * 1. Customer Feedback Portal, Outlet Tokens, Anti-Spoofing & Existing QR Preservation
 * 2. Profile Refresh Functionality & useCache Revalidation
 */

const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const feedbackController = require('../src/controllers/feedback.controller');

// Mock response object
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.data = body;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING CUSTOMER FEEDBACK & REFRESH VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // TEST SUITE 1: Feedback Tokens & Existing QR Preservation
  console.log('--- SUITE 1: Feedback Tokens & Official Johar Town QR Preservation ---');

  await asyncTest('1. Empty token resolves strictly to Johar Town (Official Existing QR preserved)', async () => {
    const req = { query: {} };
    const res = createMockRes();
    await feedbackController.resolveFeedbackToken(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.valid, true);
    assert.strictEqual(res.data.outlet, 'Johar Town');
    assert.strictEqual(res.data.isDefault, true);
  });

  await asyncTest('2. Official Johar Town token "jt-feedback-official" resolves to Johar Town', async () => {
    const req = { query: { token: 'jt-feedback-official' } };
    const res = createMockRes();
    await feedbackController.resolveFeedbackToken(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.valid, true);
    assert.strictEqual(res.data.outlet, 'Johar Town');
  });

  await asyncTest('3. Jail Road token "jr-feedback-official" resolves to Jail Road', async () => {
    const req = { query: { token: 'jr-feedback-official' } };
    const res = createMockRes();
    await feedbackController.resolveFeedbackToken(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.valid, true);
    assert.strictEqual(res.data.outlet, 'Jail Road');
    assert.strictEqual(res.data.token, 'jr-feedback-official');
    assert.strictEqual(res.data.barcode, 'ENAMELS-FB-JR');
  });

  await asyncTest('4. Abbottabad token "ab-feedback-official" resolves to Abbottabad', async () => {
    const req = { query: { token: 'ab-feedback-official' } };
    const res = createMockRes();
    await feedbackController.resolveFeedbackToken(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.valid, true);
    assert.strictEqual(res.data.outlet, 'Abbottabad');
    assert.strictEqual(res.data.token, 'ab-feedback-official');
    assert.strictEqual(res.data.barcode, 'ENAMELS-FB-AB');
  });

  await asyncTest('5. Random / Invalid token is rejected with 404', async () => {
    const req = { query: { token: 'hacker-fake-token-999' } };
    const res = createMockRes();
    await feedbackController.resolveFeedbackToken(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.data.valid, false);
  });

  // TEST SUITE 2: Anti-Spoofing, Submission & Duplicate Prevention
  console.log('\n--- SUITE 2: Anti-Spoofing, Feedback Submission & Duplicate Prevention ---');

  const testMobile = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;

  await asyncTest('6. Submission without token defaults to Johar Town', async () => {
    const req = {
      body: {
        fullName: 'Test Customer JT',
        mobileNumber: testMobile,
        emailAddress: 'test@example.com',
        q1: 5, q2: 5, q3: 4, q4: 5, q5: 5, q6: 5, q7: 4, q8: 5, q9: 5, q10: 5,
        comments: 'Great service at Johar Town',
      },
    };
    const res = createMockRes();
    await feedbackController.submitFeedback(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.feedback.outlet, 'Johar Town');
    assert.strictEqual(res.data.feedback.outletId, 'Johar Town');
    assert.strictEqual(res.data.feedback.token, 'jt-feedback-official');
    assert.strictEqual(res.data.feedback.averageRating, 4.8);
  });

  await asyncTest('7. Immediate retry within 2 minutes returns 200 with isDuplicate: true', async () => {
    const req = {
      body: {
        fullName: 'Test Customer JT Duplicate',
        mobileNumber: testMobile,
        emailAddress: 'test@example.com',
        q1: 5, q2: 5, q3: 4, q4: 5, q5: 5, q6: 5, q7: 4, q8: 5, q9: 5, q10: 5,
        comments: 'Clicking submit again immediately',
      },
    };
    const res = createMockRes();
    await feedbackController.submitFeedback(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.isDuplicate, true);
    assert.strictEqual(res.data.feedback.outlet, 'Johar Town');
  });

  await asyncTest('8. Anti-Spoofing: Mismatched outlet in request body is rejected with 400', async () => {
    const req = {
      body: {
        token: 'jr-feedback-official', // Jail Road token
        outlet: 'Johar Town',          // Attacker claims it is Johar Town
        fullName: 'Spoof Attacker',
        mobileNumber: '03009998877',
        q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 1, q9: 1, q10: 1,
      },
    };
    const res = createMockRes();
    await feedbackController.submitFeedback(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.error, 'Outlet mismatch');
  });

  await asyncTest('9. Submission with Jail Road token records canonical Jail Road', async () => {
    const jrMobile = `0301${Math.floor(1000000 + Math.random() * 9000000)}`;
    const req = {
      body: {
        token: 'jr-feedback-official',
        fullName: 'Jail Road Customer',
        mobileNumber: jrMobile,
        q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, q6: 4, q7: 4, q8: 4, q9: 4, q10: 4,
        comments: 'Nice ambiance at Jail Road',
      },
    };
    const res = createMockRes();
    await feedbackController.submitFeedback(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.feedback.outlet, 'Jail Road');
    assert.strictEqual(res.data.feedback.token, 'jr-feedback-official');
    assert.strictEqual(res.data.feedback.averageRating, 4.0);
  });

  await asyncTest('10. Submission with Abbottabad token records canonical Abbottabad', async () => {
    const abMobile = `0302${Math.floor(1000000 + Math.random() * 9000000)}`;
    const req = {
      body: {
        token: 'ab-feedback-official',
        fullName: 'Abbottabad Customer',
        mobileNumber: abMobile,
        q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, q6: 5, q7: 5, q8: 5, q9: 5, q10: 5,
        comments: 'Excellent quality in Abbottabad',
      },
    };
    const res = createMockRes();
    await feedbackController.submitFeedback(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.feedback.outlet, 'Abbottabad');
    assert.strictEqual(res.data.feedback.token, 'ab-feedback-official');
    assert.strictEqual(res.data.feedback.averageRating, 5.0);
  });

  await asyncTest('11. Submission with invalid ratings (< 1 or > 5 or missing) is rejected with 400', async () => {
    const req = {
      body: {
        fullName: 'Incomplete Survey',
        mobileNumber: '03001122334',
        q1: 5, q2: 6, // invalid > 5
        q3: 3, q4: 3, q5: 3, q6: 3, q7: 3, q8: 3, q9: 3, q10: 3,
      },
    };
    const res = createMockRes();
    await feedbackController.submitFeedback(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.data.message.includes('Question 2'));
  });

  // TEST SUITE 3: Outlet-Wise Analytics, Filters & Strict 3 Outlets Restriction
  console.log('\n--- SUITE 3: Outlet-Wise Filters & Analytics (Strict 3 Outlets) ---');

  await asyncTest('12. getAllFeedback restricts query to authorized outlets only', async () => {
    const req = { query: { page: 1, limit: 50 } };
    const res = createMockRes();
    await feedbackController.getAllFeedback(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data));
    // Verify every returned feedback is within the 3 allowed outlets
    for (const item of res.data) {
      assert.ok(
        ['Johar Town', 'Jail Road', 'Abbottabad'].includes(item.outlet),
        `Unexpected outlet found: ${item.outlet}`
      );
    }
  });

  await asyncTest('13. getAllFeedback filters by specific outlet correctly', async () => {
    const req = { query: { outlet: 'Jail Road', page: 1, limit: 50 } };
    const res = createMockRes();
    await feedbackController.getAllFeedback(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data));
    for (const item of res.data) {
      assert.strictEqual(item.outlet, 'Jail Road');
    }
  });

  await asyncTest('14. getFeedbackStats returns complete metrics and outlet breakdown', async () => {
    const req = { query: {} };
    const res = createMockRes();
    await feedbackController.getFeedbackStats(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.total >= 1);
    assert.ok(res.data.averageRating > 0);
    assert.ok(Array.isArray(res.data.outletStats));
    assert.strictEqual(res.data.outletStats.length, 3);
    assert.ok(res.data.outletStats.find(o => o.outlet === 'Johar Town'));
    assert.ok(res.data.outletStats.find(o => o.outlet === 'Jail Road'));
    assert.ok(res.data.outletStats.find(o => o.outlet === 'Abbottabad'));
    assert.ok(Array.isArray(res.data.ratingDistribution));
  });

  await asyncTest('15. getOutletQRs returns 3 outlets, preserving base URL for Johar Town', async () => {
    const req = { headers: { host: 'smart-production-v2.vercel.app' }, protocol: 'https' };
    const res = createMockRes();
    await feedbackController.getOutletQRs(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 3);

    const jt = res.data.find(o => o.outlet === 'Johar Town');
    const jr = res.data.find(o => o.outlet === 'Jail Road');
    const ab = res.data.find(o => o.outlet === 'Abbottabad');

    assert.ok(jt);
    assert.ok(jr);
    assert.ok(ab);

    // Johar Town preserves the official unmodified URL ${origin}/feedback
    assert.strictEqual(jt.isExisting, true);
    assert.strictEqual(jt.url, 'https://smart-production-v2.vercel.app/feedback');

    // Jail Road and Abbottabad have their respective token URLs
    assert.ok(jr.url.includes('token=jr-feedback-official'));
    assert.ok(ab.url.includes('token=ab-feedback-official'));
  });

  // TEST SUITE 4: Profile Refresh & useCache Optimization
  console.log('\n--- SUITE 4: Profile Refresh & useCache Revalidation Logic ---');

  test('16. useCache skips identical data suppression when skipCache === true (Manual Refresh)', () => {
    const useCacheContent = require('fs').readFileSync('frontend/src/hooks/useCache.js', 'utf8');

    // Verify loading flips to true when skipCache is true
    assert.ok(
      useCacheContent.includes('skipCache') && useCacheContent.includes('setLoading(true)'),
      'useCache must set loading to true when skipCache is requested'
    );

    // Verify sameData check is only evaluated for background revalidations (!skipCache)
    assert.ok(
      useCacheContent.includes('!skipCache && sameData'),
      'useCache must bypass sameData suppression when user explicitly triggers manual refresh'
    );

    // Verify load returns fresh data
    assert.ok(
      useCacheContent.includes('return freshData;'),
      'useCache load function must return fresh data for await refresh() consumers'
    );
  });

  test('17. MyTasks.jsx has top & bottom Refresh buttons with spin animation & toast', () => {
    const myTasksContent = require('fs').readFileSync('frontend/src/pages/MyTasks.jsx', 'utf8');

    assert.ok(myTasksContent.includes('const [refreshing, setRefreshing] = useState(false)'));
    assert.ok(myTasksContent.includes('refreshTasks'));
    assert.ok(myTasksContent.includes('refreshUnseen'));
    assert.ok(myTasksContent.includes('refreshOrders'));
    assert.ok(myTasksContent.includes("toast.success('Tasks refreshed')"));
    assert.ok(myTasksContent.includes("refreshing ? 'animate-spin' : ''"));
  });

  test('18. AllOrders.jsx has dedicated Refresh button in the action bar', () => {
    const allOrdersContent = require('fs').readFileSync('frontend/src/pages/AllOrders.jsx', 'utf8');

    assert.ok(allOrdersContent.includes('const [refreshing, setRefreshing] = useState(false)'));
    assert.ok(allOrdersContent.includes('await refresh()'));
    assert.ok(allOrdersContent.includes("toast.success('Orders refreshed')"));
    assert.ok(allOrdersContent.includes("refreshing ? 'animate-spin text-blue-400' : ''"));
    assert.ok(allOrdersContent.includes('title="Refresh orders list"'));
  });

  test('19. VerificationPage.jsx has dedicated Refresh button', () => {
    const verificationContent = require('fs').readFileSync('frontend/src/pages/VerificationPage.jsx', 'utf8');

    assert.ok(verificationContent.includes('RefreshCw'));
    assert.ok(verificationContent.includes('const [refreshing, setRefreshing] = useState(false)'));
    assert.ok(verificationContent.includes("toast.success('Orders refreshed')"));
    assert.ok(verificationContent.includes("refreshing ? 'animate-spin text-amber-400' : ''"));
    assert.ok(verificationContent.includes('title="Refresh verification orders"'));
  });

  test('20. ReturnedFromVerification.jsx has dedicated Refresh button', () => {
    const returnedContent = require('fs').readFileSync('frontend/src/pages/ReturnedFromVerification.jsx', 'utf8');

    assert.ok(returnedContent.includes('RefreshCw'));
    assert.ok(returnedContent.includes('const [refreshing, setRefreshing] = useState(false)'));
    assert.ok(returnedContent.includes("toast.success('Orders refreshed')"));
    assert.ok(returnedContent.includes("refreshing ? 'animate-spin text-amber-400' : ''"));
    assert.ok(returnedContent.includes('title="Refresh returned orders"'));
  });

  console.log('\n================================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} / ${total} TESTS PASSED!`);
  console.log('================================================================\n');

  // Clean up test feedback records created during this run
  await prisma.customerFeedback.deleteMany({
    where: {
      fullName: { in: ['Test Customer JT', 'Test Customer JT Duplicate', 'Jail Road Customer', 'Abbottabad Customer'] },
    },
  });
  console.log('✓ Cleaned up ephemeral test feedback records');
}

runTests()
  .catch((err) => {
    console.error('Test suite failure:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
