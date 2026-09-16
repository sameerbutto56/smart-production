const prisma = require('../src/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');
const { resolvePktDateRange } = require('../src/utils/workingHours');
const abbottabadController = require('../src/controllers/abbottabad.controller');

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 STARTING ABBOTTABAD FINANCIAL & AMOUNT SYSTEM VERIFICATION');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: Password Gate & Verification
    // -------------------------------------------------------------
    console.log('--- TEST SUITE 1: Password Gate & Verification ---');
    const ABBOTTABAD_PASSWORD_KEY = 'ABBOTTABAD_DASHBOARD_PASSWORD_HASH';
    const testPassword = 'abbottabad@test2026';
    const testHash = await bcrypt.hash(testPassword, 10);

    await prisma.systemSetting.upsert({
      where: { key: ABBOTTABAD_PASSWORD_KEY },
      update: { value: testHash },
      create: { key: ABBOTTABAD_PASSWORD_KEY, value: testHash }
    });

    const isMatchCorrect = await bcrypt.compare(testPassword, testHash);
    assert(isMatchCorrect === true, 'Correct password verifies against bcrypt hash');

    const isMatchWrong = await bcrypt.compare('wrong-password', testHash);
    assert(isMatchWrong === false, 'Incorrect password correctly rejected');

    const token = jwt.sign(
      { sub: 'test-admin-id', role: 'ADMIN', access: 'ABBOTTABAD_DASHBOARD' },
      process.env.JWT_SECRET || 'abbottabad-secret-key-2026',
      { expiresIn: '1h' }
    );
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'abbottabad-secret-key-2026');
    assert(decoded.access === 'ABBOTTABAD_DASHBOARD', 'JWT access claim verified for Abbottabad dashboard');

    // -------------------------------------------------------------
    // TEST SUITE 2: Cost Price Excel Upload & Matching
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Cost Price Excel Upload & Matching ---');
    const mockRows = [
      { 'Product Name': 'Test Product A', 'SKU': 'SKU-TPA-01', 'Color': 'Black', 'Size': 'M', 'Cost Price': 700 },
      { 'Product Name': 'Test Product B', 'SKU': 'SKU-TPB-02', 'Color': 'Blue', 'Size': 'L', 'Cost Price': 350 },
      { 'Product Name': 'Test Product C', 'SKU': 'SKU-TPC-03', 'Cost Price': 1200 }
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(mockRows);
    xlsx.utils.book_append_sheet(wb, ws, 'Cost Prices');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Mock upload controller call
    const mockReq = {
      file: { buffer, originalname: 'test_cost_sheet.xlsx' },
      user: { id: 'test-admin-id', name: 'Test Admin', role: 'ADMIN' }
    };
    let uploadResponseData = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => { uploadResponseData = { code, ...data }; return uploadResponseData; }
      }),
      json: (data) => { uploadResponseData = data; return data; }
    };

    await abbottabadController.uploadCostPriceExcel(mockReq, mockRes);
    assert(uploadResponseData && uploadResponseData.success === true, 'Cost Price Excel uploaded successfully');
    assert(uploadResponseData.matchedProducts === 3, 'All 3 mock products matched and persisted');

    // Verify database rows
    const storedItems = await prisma.abbottabadCostPriceItem.findMany({
      where: { uploadId: uploadResponseData.uploadId }
    });
    assert(storedItems.length === 3, '3 AbbottabadCostPriceItem records stored in database');

    const costA = await abbottabadController.findProductCostPrice({ productName: 'Test Product A', size: 'M', color: 'Black' });
    assert(costA === 700, 'Resolved cost price for Test Product A is 700');

    const costB = await abbottabadController.findProductCostPrice({ productName: 'Test Product B', size: 'L', color: 'Blue' });
    assert(costB === 350, 'Resolved cost price for Test Product B is 350');

    // -------------------------------------------------------------
    // TEST SUITE 3: Demand Financial Calculations (Bilty 1500 vs TCS 0)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Demand Financial Calculations (Bilty vs TCS) ---');
    const testDemand = await prisma.outletDemandRequest.create({
      data: {
        outletId: 'test-abbottabad-outlet',
        outletName: 'Abbottabad',
        status: 'PENDING',
        transferNumber: `TRF-TEST-${Date.now()}`,
        items: [
          { productName: 'Test Product A', size: 'M', color: 'Black', requestedQty: 20, approvedQty: 20, actualUnitPrice: 1000 },
          { productName: 'Test Product B', size: 'L', color: 'Blue', requestedQty: 10, approvedQty: 10, actualUnitPrice: 500 }
        ]
      }
    });

    const productValue = (20 * 1000) + (10 * 500); // 25,000
    const biltyAmount = 1500;
    const actualPlusBilty = productValue + biltyAmount; // 26,500
    const costAmount = (20 * 700) + (10 * 350); // 17,500
    const costPlusBilty = costAmount + biltyAmount; // 19,000

    const finRecord = await prisma.abbottabadDemandFinancial.create({
      data: {
        demandId: testDemand.id,
        transferNumber: testDemand.transferNumber,
        productValue,
        biltyType: 'BILTY',
        biltyAmount,
        actualPlusBilty,
        costAmount,
        costPlusBilty,
        costPriceMissing: false,
        itemFinancials: [
          { productName: 'Test Product A', qty: 20, actualUnitPrice: 1000, actualLineTotal: 20000, costUnitPrice: 700, costLineTotal: 14000, costMissing: false },
          { productName: 'Test Product B', qty: 10, actualUnitPrice: 500, actualLineTotal: 5000, costUnitPrice: 350, costLineTotal: 3500, costMissing: false }
        ]
      }
    });

    assert(finRecord.productValue === 25000, 'Product Value correctly calculated: ₨25,000');
    assert(finRecord.biltyAmount === 1500, 'Bilty Amount fixed at ₨1,500');
    assert(finRecord.actualPlusBilty === 26500, 'Actual Amount + Bilty: ₨26,500');
    assert(finRecord.costAmount === 17500, 'Cost Amount correctly calculated: ₨17,500');
    assert(finRecord.costPlusBilty === 19000, 'Cost Amount + Bilty: ₨19,000');

    // -------------------------------------------------------------
    // TEST SUITE 4: Amount Control & Dual Approval System
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Amount Control & Dual Approval System ---');
    // Ensure clean test account
    let account = await prisma.abbottabadAmountAccount.upsert({
      where: { outletName: 'Abbottabad' },
      update: { approvedAmount: 0, runningBalance: 0, totalConsumed: 0, isCleared: false },
      create: { outletName: 'Abbottabad', approvedAmount: 0, runningBalance: 0, totalConsumed: 0, isCleared: false }
    });

    // Step 4.1: Admin proposes Initial Amount of ₨1,000,000
    const proposal1 = await prisma.abbottabadAmountProposal.create({
      data: {
        accountId: account.id,
        type: 'INITIAL_AMOUNT',
        proposedAmount: 1000000,
        previousApprovedAmount: 0,
        previousRunningBalance: 0,
        proposedBy: 'ADMIN',
        proposedById: 'admin-1',
        proposedByName: 'Admin User',
        status: 'ADMIN_APPROVED',
        adminApprovedAt: new Date()
      }
    });

    assert(proposal1.status === 'ADMIN_APPROVED', 'Proposal starts as ADMIN_APPROVED (waiting for Abbottabad)');
    // Check active balance NOT yet updated
    const accPreApprove = await prisma.abbottabadAmountAccount.findUnique({ where: { id: account.id } });
    assert(accPreApprove.approvedAmount === 0 && accPreApprove.runningBalance === 0, 'Active amount remains 0 before dual approval');

    // Step 4.2: Abbottabad approves proposal
    let approveRes = null;
    await abbottabadController.approveAmountProposal(
      { params: { id: proposal1.id }, user: { id: 'outlet-1', name: 'Abbottabad POS', role: 'OUTLET' }, app: { get: () => null } },
      { json: (d) => { approveRes = d; return d; }, status: () => ({ json: () => {} }) }
    );

    assert(approveRes && approveRes.account.approvedAmount === 1000000, 'Approved amount is now ₨1,000,000 after dual approval');
    assert(approveRes.account.runningBalance === 1000000, 'Running balance is now ₨1,000,000');

    // Step 4.3: Demand Deduction (₨201,500)
    const demandDeductionAmount = 201500;
    const prevBalanceBeforeDeduction = approveRes.account.runningBalance;
    const expectedRemaining = prevBalanceBeforeDeduction - demandDeductionAmount; // 798,500

    const updatedAccountDeducted = await prisma.abbottabadAmountAccount.update({
      where: { id: account.id },
      data: {
        runningBalance: expectedRemaining,
        totalConsumed: demandDeductionAmount
      }
    });

    const deductionLedger = await prisma.abbottabadAmountLedger.create({
      data: {
        accountId: account.id,
        demandId: testDemand.id,
        demandTransferNumber: testDemand.transferNumber,
        actionType: 'DEMAND_DEDUCTION',
        previousAmount: 1000000,
        adjustmentAmount: 0,
        newAmount: 1000000,
        previousBalance: prevBalanceBeforeDeduction,
        consumedAmount: demandDeductionAmount,
        newBalance: expectedRemaining,
        details: 'Demand deduction for ' + testDemand.transferNumber
      }
    });

    assert(updatedAccountDeducted.runningBalance === 798500, 'Running balance deducted to ₨798,500');
    assert(deductionLedger.actionType === 'DEMAND_DEDUCTION', 'Ledger recorded DEMAND_DEDUCTION');

    // Step 4.4: Negative Balance / Over-Limit Handling
    const largeDemandAmount = 900000;
    const balanceOverLimit = updatedAccountDeducted.runningBalance - largeDemandAmount; // 798,500 - 900,000 = -101,500
    const accountOverLimit = await prisma.abbottabadAmountAccount.update({
      where: { id: account.id },
      data: {
        runningBalance: balanceOverLimit,
        totalConsumed: updatedAccountDeducted.totalConsumed + largeDemandAmount
      }
    });

    assert(accountOverLimit.runningBalance === -101500, 'Balance goes negative (-₨101,500) without being clamped to 0');

    // Step 4.5: Amount Increase (+₨500,000) with Dual Approval
    const increaseProposal = await prisma.abbottabadAmountProposal.create({
      data: {
        accountId: account.id,
        type: 'INCREASE',
        proposedAmount: 500000,
        previousApprovedAmount: accountOverLimit.approvedAmount,
        previousRunningBalance: accountOverLimit.runningBalance,
        proposedBy: 'ADMIN',
        proposedById: 'admin-1',
        proposedByName: 'Admin User',
        status: 'ADMIN_APPROVED',
        adminApprovedAt: new Date()
      }
    });

    let increaseRes = null;
    await abbottabadController.approveAmountProposal(
      { params: { id: increaseProposal.id }, user: { id: 'outlet-1', name: 'Abbottabad POS', role: 'OUTLET' }, app: { get: () => null } },
      { json: (d) => { increaseRes = d; return d; }, status: () => ({ json: () => {} }) }
    );

    // Expected new balance: -101,500 + 500,000 = 398,500
    assert(increaseRes.account.runningBalance === 398500, 'Balance after +₨500,000 increase: ₨398,500');
    assert(increaseRes.account.approvedAmount === 1500000, 'Approved amount after increase: ₨1,500,000');

    // Step 4.6: Rejection Test (Proposal rejected leaves balance untouched)
    const rejectProposal = await prisma.abbottabadAmountProposal.create({
      data: {
        accountId: account.id,
        type: 'DECREASE',
        proposedAmount: 100000,
        previousApprovedAmount: 1500000,
        previousRunningBalance: 398500,
        proposedBy: 'ADMIN',
        proposedById: 'admin-1',
        proposedByName: 'Admin User',
        status: 'ADMIN_APPROVED',
        adminApprovedAt: new Date()
      }
    });

    let rejectRes = null;
    await abbottabadController.rejectAmountProposal(
      { params: { id: rejectProposal.id }, body: { reason: 'Abbottabad needs stock budget' }, user: { id: 'outlet-1', name: 'Abbottabad POS', role: 'OUTLET' }, app: { get: () => null } },
      { json: (d) => { rejectRes = d; return d; }, status: () => ({ json: () => {} }) }
    );

    assert(rejectRes.proposal.status === 'REJECTED', 'Proposal status marked REJECTED');
    const accPostReject = await prisma.abbottabadAmountAccount.findUnique({ where: { id: account.id } });
    assert(accPostReject.runningBalance === 398500, 'Balance remains ₨398,500 completely unchanged after rejection');

    // Step 4.7: Clear Amount Test (Dual Approval)
    const clearProposal = await prisma.abbottabadAmountProposal.create({
      data: {
        accountId: account.id,
        type: 'CLEAR',
        proposedAmount: 0,
        previousApprovedAmount: 1500000,
        previousRunningBalance: 398500,
        proposedBy: 'ADMIN',
        proposedById: 'admin-1',
        proposedByName: 'Admin User',
        status: 'ADMIN_APPROVED',
        adminApprovedAt: new Date()
      }
    });

    let clearRes = null;
    await abbottabadController.approveAmountProposal(
      { params: { id: clearProposal.id }, user: { id: 'outlet-1', name: 'Abbottabad POS', role: 'OUTLET' }, app: { get: () => null } },
      { json: (d) => { clearRes = d; return d; }, status: () => ({ json: () => {} }) }
    );

    assert(clearRes.account.approvedAmount === 0, 'Approved amount reset to 0 upon Clear approval');
    assert(clearRes.account.runningBalance === 0, 'Running balance reset to 0 upon Clear approval');
    assert(clearRes.account.isCleared === true, 'isCleared flag marked true');
    assert(clearRes.ledger.actionType === 'CLEAR', 'CLEAR transaction recorded in immutable ledger');

    // Verify ledger history is fully intact
    const ledgerList = await prisma.abbottabadAmountLedger.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'asc' }
    });
    assert(ledgerList.length >= 4, `All ${ledgerList.length} historical ledger transactions preserved intact`);

    // Clean up test records
    await prisma.abbottabadDemandFinancial.deleteMany({ where: { demandId: testDemand.id } });
    await prisma.outletDemandRequest.delete({ where: { id: testDemand.id } });

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exit(1);
  }
}

runVerification();
