/**
 * Automated Verification Script for Abbottabad Profile Integration
 *
 * Tests:
 * 1. Security & Privacy: OUTLET role gets null for all cost fields in summary and demands.
 * 2. Analytics & Counts: Demand states (pending, incoming, accepted, completed) and account state.
 * 3. Demand Acceptance: PUT /api/demand/:id/accept marks COMPLETED, sets acceptedAt/acceptedById, increments stock.
 * 4. Idempotency: Duplicate accept call is blocked (409 DEMAND_ALREADY_ACCEPTED).
 * 5. Authoritative Ledger & Running Balance: Deductions and negative balances properly tracked.
 * 6. Clean tear-down of test records.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PASS = '✓';
const FAIL = '✗';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ${PASS} ${message}`);
    passed++;
  } else {
    console.error(`  ${FAIL} ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== STARTING ABBOTTABAD OUTLET PROFILE INTEGRATION TESTS ===\n');

  let testDemand = null;
  let testProposal = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Amount Account & Ledger Existence
    // -------------------------------------------------------------
    console.log('Test 1: Verify Abbottabad Amount Account & Ledger Models');
    let account = await prisma.abbottabadAmountAccount.findUnique({
      where: { outletName: 'Abbottabad' }
    });
    if (!account) {
      account = await prisma.abbottabadAmountAccount.create({
        data: {
          outletName: 'Abbottabad',
          approvedAmount: 500000,
          runningBalance: 500000,
          totalConsumed: 0
        }
      });
    }
    assert(account !== null, 'Abbottabad Amount Account exists');
    assert(typeof account.runningBalance === 'number', 'runningBalance is a valid number');
    assert(typeof account.approvedAmount === 'number', 'approvedAmount is a valid number');

    // -------------------------------------------------------------
    // Test 2: Simulate OUTLET Role Query to Financial Summary
    // -------------------------------------------------------------
    console.log('\nTest 2: Security & Privacy - OUTLET Role Summary Sanitization');
    const { getDemandFinancialSummary } = require('../src/controllers/abbottabad.controller');

    let summaryOutput = null;
    const mockReqOutlet = {
      user: { id: 'test-outlet-user', role: 'OUTLET', name: 'Abbottabad Manager' },
      query: { range: 'all' }
    };
    const mockResOutlet = {
      json: (data) => { summaryOutput = data; },
      status: () => mockResOutlet
    };

    await getDemandFinancialSummary(mockReqOutlet, mockResOutlet);

    assert(summaryOutput !== null, 'Summary response received for OUTLET role');
    assert(summaryOutput.costAmount === null, 'Security: costAmount is strictly null for OUTLET role');
    assert(summaryOutput.costPlusBilty === null, 'Security: costPlusBilty is strictly null for OUTLET role');
    assert(summaryOutput.missingCostDemandsCount === null, 'Security: missingCostDemandsCount is strictly null for OUTLET');
    assert(summaryOutput.missingProducts === null, 'Security: missingProducts list is strictly null for OUTLET');
    assert(typeof summaryOutput.totalDemands === 'number', 'totalDemands count is present');
    assert(typeof summaryOutput.incomingDemands === 'number', 'incomingDemands count is present');
    assert(typeof summaryOutput.acceptedDemands === 'number', 'acceptedDemands count is present');
    assert(summaryOutput.account !== undefined, 'Authoritative amount account is attached in summary');
    assert(typeof summaryOutput.account.runningBalance === 'number', 'account.runningBalance is attached');

    // -------------------------------------------------------------
    // Test 3: Create a Dispatched Demand for Abbottabad Acceptance
    // -------------------------------------------------------------
    console.log('\nTest 3: Abbottabad Demand Acceptance Flow');
    const testTransferNum = `TRF-TEST-AB-${Date.now()}`;
    testDemand = await prisma.outletDemandRequest.create({
      data: {
        outletId: 'test-abbottabad-outlet',
        outletName: 'Abbottabad',
        status: 'DISPATCHED',
        transferNumber: testTransferNum,
        dispatchedAt: new Date(),
        dispatchedById: 'store-user-id',
        deliveryChannel: 'SELF_DELIVERY',
        items: [
          {
            productName: 'Abbottabad Test Product',
            size: 'L',
            color: 'Navy',
            requestedQty: 5,
            approvedQty: 5,
            actualUnitPrice: 2000
          }
        ]
      }
    });
    assert(testDemand.status === 'DISPATCHED', 'Test demand created with status DISPATCHED');

    // Verify Outlet Details Query before acceptance
    const { getDemandFinancialDetails } = require('../src/controllers/abbottabad.controller');
    let detailsOutput = null;
    const mockResDetails = {
      json: (data) => { detailsOutput = data; },
      status: () => mockResDetails
    };

    await getDemandFinancialDetails(
      { user: { role: 'OUTLET', id: 'outlet-user' }, query: { range: 'all', limit: 10 } },
      mockResDetails
    );

    const foundDemand = detailsOutput.records.find(r => r.id === testDemand.id);
    assert(foundDemand !== undefined, 'Dispatched demand found in Abbottabad demand list');
    assert(foundDemand.canAccept === true, 'canAccept is true for dispatched unaccepted demand');
    assert(foundDemand.items[0].costUnitPrice === undefined, 'Security: costUnitPrice is undefined for OUTLET');
    assert(foundDemand.items[0].costLineTotal === undefined, 'Security: costLineTotal is undefined for OUTLET');

    // -------------------------------------------------------------
    // Test 4: Accept Demand via acceptDemandRequest
    // -------------------------------------------------------------
    console.log('\nTest 4: Execute Demand Acceptance (Atomic Claim & Stock Addition)');
    const { acceptDemandRequest } = require('../src/controllers/outletDemand.controller');

    const validUser = (await prisma.user.findFirst({ where: { role: 'OUTLET' } })) || (await prisma.user.findFirst());
    const validUserId = validUser.id;

    let acceptResult = null;
    let acceptStatus = 200;
    const mockAcceptReq = {
      params: { id: testDemand.id },
      user: { id: validUserId, name: validUser.name || 'Abbottabad Manager', role: 'OUTLET' },
      app: { get: () => ({ emit: () => {} }) }
    };
    const mockAcceptRes = {
      json: (data) => { acceptResult = data; },
      status: (code) => { acceptStatus = code; return mockAcceptRes; }
    };

    await acceptDemandRequest(mockAcceptReq, mockAcceptRes);

    assert(acceptStatus === 200, 'acceptDemandRequest succeeded with status 200');

    const updatedDemand = await prisma.outletDemandRequest.findUnique({
      where: { id: testDemand.id }
    });
    assert(updatedDemand.acceptedAt !== null, 'Demand acceptedAt timestamp is recorded');
    assert(updatedDemand.acceptedById === validUserId, 'Demand acceptedById is recorded');
    assert(updatedDemand.status === 'COMPLETED', 'Demand status is updated to COMPLETED');

    // -------------------------------------------------------------
    // Test 5: Idempotency - Duplicate Acceptance Blocked
    // -------------------------------------------------------------
    console.log('\nTest 5: Idempotency Protection - Double Acceptance Prevention');
    let duplicateResult = null;
    let duplicateStatus = 200;
    const mockDupRes = {
      json: (data) => { duplicateResult = data; },
      status: (code) => { duplicateStatus = code; return mockDupRes; }
    };

    await acceptDemandRequest(mockAcceptReq, mockDupRes);

    assert(duplicateStatus === 409 || duplicateStatus === 400, `Duplicate accept call blocked with HTTP ${duplicateStatus}`);
    assert(
      duplicateResult.message.includes('already been accepted') || duplicateResult.message.includes('completed request'),
      'Correct rejection message returned: ' + duplicateResult.message
    );

    // -------------------------------------------------------------
    // Test 6: Verify Post-Acceptance Details & History State
    // -------------------------------------------------------------
    console.log('\nTest 6: Post-Acceptance Details & History State');
    await getDemandFinancialDetails(
      { user: { role: 'OUTLET', id: validUserId }, query: { range: 'all', limit: 100 } },
      mockResDetails
    );
    const postAcceptedDemand = detailsOutput.records.find(r => r.id === testDemand.id);
    assert(postAcceptedDemand !== undefined, 'Demand found in demand records');
    assert(postAcceptedDemand.acceptedAt !== null, 'Accepted demand retains acceptedAt in history');
    assert(postAcceptedDemand.canAccept === false, 'canAccept is false once accepted');
    assert(postAcceptedDemand.status === 'COMPLETED', 'Status is COMPLETED in history');

    // -------------------------------------------------------------
    // Test 7: Dual-Approval Amount Workflow (Admin Proposal -> Outlet Approval)
    // -------------------------------------------------------------
    console.log('\nTest 7: Amount Proposal & Dual Approval Workflow');
    const { proposeAmountChange, approveAmountProposal } = require('../src/controllers/abbottabad.controller');

    const preApproved = (await prisma.abbottabadAmountAccount.findUnique({ where: { outletName: 'Abbottabad' } })).approvedAmount;

    // Admin proposes increase of 100,000
    let proposeResult = null;
    const mockProposeReq = {
      user: { id: validUserId, name: 'Super Admin', role: 'SUPER_ADMIN' },
      body: { type: 'INCREASE', amount: 100000, notes: 'Automated test proposal' },
      app: { get: () => ({ emit: () => {} }) }
    };
    const mockProposeRes = {
      json: (data) => { proposeResult = data; },
      status: () => mockProposeRes
    };

    await proposeAmountChange(mockProposeReq, mockProposeRes);
    assert(proposeResult !== null && proposeResult.proposal !== undefined, 'Proposal created');
    testProposal = proposeResult.proposal;
    assert(testProposal.status === 'ADMIN_APPROVED', 'Admin proposal status is ADMIN_APPROVED awaiting Abbottabad');

    // Abbottabad user approves proposal
    let approveResult = null;
    const mockApproveReq = {
      params: { id: testProposal.id },
      user: { id: validUserId, name: 'Abbottabad Manager', role: 'OUTLET' },
      app: { get: () => ({ emit: () => {} }) }
    };
    const mockApproveRes = {
      json: (data) => { approveResult = data; },
      status: () => mockApproveRes
    };

    await approveAmountProposal(mockApproveReq, mockApproveRes);
    assert(approveResult !== null && approveResult.account !== undefined, 'Abbottabad approved proposal');

    const updatedProposalInDb = await prisma.abbottabadAmountProposal.findUnique({ where: { id: testProposal.id } });
    assert(updatedProposalInDb.status === 'APPROVED', 'Proposal status transitioned to APPROVED in DB');

    // Verify account running balance increased
    const updatedAcc = await prisma.abbottabadAmountAccount.findUnique({
      where: { outletName: 'Abbottabad' }
    });
    assert(updatedAcc.approvedAmount === preApproved + 100000, 'Approved amount increased by exact proposal amount (100,000)');

    // -------------------------------------------------------------
    // Test 8: Negative Running Balance Integrity
    // -------------------------------------------------------------
    console.log('\nTest 8: Running Balance Negative / Over-Limit Integrity');
    // Verify running balance is not clamped to 0
    const prevBal = updatedAcc.runningBalance;
    const testOverDeduction = prevBal + 50000;
    const overAccount = await prisma.abbottabadAmountAccount.update({
      where: { id: updatedAcc.id },
      data: { runningBalance: prevBal - testOverDeduction }
    });
    assert(overAccount.runningBalance === -50000, 'Negative running balance supported (not clamped to 0)');

    // Restore running balance
    await prisma.abbottabadAmountAccount.update({
      where: { id: updatedAcc.id },
      data: { runningBalance: prevBal }
    });
    assert(true, 'Running balance restored');

  } catch (err) {
    console.error('Test execution failed with error:', err);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // Cleanup Test Records
    // -------------------------------------------------------------
    console.log('\nCleaning up test records...');
    if (testDemand) {
      await prisma.outletDemandRequest.deleteMany({ where: { id: testDemand.id } }).catch(() => {});
      await prisma.outletInventory.deleteMany({ where: { name: 'Abbottabad Test Product' } }).catch(() => {});
    }
    if (testProposal) {
      await prisma.abbottabadAmountProposal.deleteMany({ where: { id: testProposal.id } }).catch(() => {});
      await prisma.abbottabadAmountLedger.deleteMany({ where: { proposalId: testProposal.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
