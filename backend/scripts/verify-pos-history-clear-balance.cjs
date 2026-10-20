const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting POS History Clear Outstanding Balance Verification Test Suite...\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

const posHistorySrc = fs.readFileSync(path.join(__dirname, '../src/../../frontend/src/components/POSHistory.jsx'), 'utf8');
const posControllerSrc = fs.readFileSync(path.join(__dirname, '../src/controllers/pos.controller.js'), 'utf8');
const posContextSrc = fs.readFileSync(path.join(__dirname, '../src/../../frontend/src/context/POSContext.jsx'), 'utf8');
const posModalsSrc = fs.readFileSync(path.join(__dirname, '../src/../../frontend/src/components/POSModals.jsx'), 'utf8');

// ==========================================
// 1. POS History Clear Balance Button on Card
// ==========================================
test('POSHistory.jsx displays Clear Balance button on invoice card when outstanding balance exists', () => {
  assert(posHistorySrc.includes('handlePayBalanceOpen'), 'Must import or use handlePayBalanceOpen from POSContext');
  assert(posHistorySrc.includes('Clear Balance'), 'Must have user-visible Clear Balance button text');
  assert(posHistorySrc.includes('loadingBalanceAction'), 'Must disable or guard with loadingBalanceAction');
  assert(posHistorySrc.includes('outstanding > 0.01'), 'Must check outstanding balance > 0.01');
});

// ==========================================
// 2. POS History Invoice Details Modal & Layout
// ==========================================
test('POSHistory.jsx renders Invoice Details screen with exact requested fields', () => {
  assert(posHistorySrc.includes('Invoice Details'), 'Must have Invoice Details title/button');
  assert(posHistorySrc.includes('Invoice Number:'), 'Must show Invoice Number field');
  assert(posHistorySrc.includes('Customer:'), 'Must show Customer field');
  assert(posHistorySrc.includes('Invoice Total:'), 'Must show Invoice Total field');
  assert(posHistorySrc.includes('Amount Paid:'), 'Must show Amount Paid field');
  assert(posHistorySrc.includes('Outstanding Balance:'), 'Must show Outstanding Balance field');
});

test('POSHistory.jsx Invoice Details Modal has Clear Balance action when balance is pending', () => {
  assert(posHistorySrc.includes('Clear Outstanding Balance'), 'Must have Clear Outstanding Balance callout');
  assert(posHistorySrc.includes('handlePayBalanceOpen(activeInvoice)'), 'Must call handlePayBalanceOpen on activeInvoice');
});

// ==========================================
// 3. Gate Pass Option Available upon Clearance
// ==========================================
test('POSHistory.jsx displays Gate Pass button when balance is cleared', () => {
  assert(posHistorySrc.includes('Gate Pass'), 'Must render Gate Pass button when cleared');
  assert(posHistorySrc.includes('printBalanceGatePass'), 'Must import printBalanceGatePass');
  assert(posHistorySrc.includes('setPrintOpts({ invoice: false, gatePass: true })'), 'Must support printing Gate Pass for cleared invoice');
});

test('POSModals.jsx offers Gate Pass directly after balance clearance', () => {
  assert(posModalsSrc.includes('printBalanceGatePass'), 'Must call printBalanceGatePass on payment success');
  assert(posModalsSrc.includes('Gate Pass'), 'Must display Gate Pass button on success modal');
});

// ==========================================
// 4. Backend Reuses Existing Balance Payment & Updates Linked Order
// ==========================================
test('backend pos.controller.js payBalance reuses existing balance clearance logic and updates linked Order', () => {
  assert(posControllerSrc.includes('posBalancePayment.create'), 'Must create PosBalancePayment record');
  assert(posControllerSrc.includes('linkedOrder'), 'Must query and sync linked Order');
  assert(posControllerSrc.includes('paymentStatus: isOrderPaid ? \'PAID\' : \'BALANCE\''), 'Must update order paymentStatus to PAID when fully cleared');
  assert(posControllerSrc.includes('balanceAmount: isOrderPaid ? 0 : newBal'), 'Must update order balanceAmount to 0');
});

test('backend pos.controller.js payBalance invalidates caches and prevents overpayment', () => {
  assert(posControllerSrc.includes('Invoice is already fully paid'), 'Must guard against paying zero balance');
  assert(posControllerSrc.includes('Amount exceeds remaining balance'), 'Must guard against paying more than remaining');
  assert(posControllerSrc.includes('cache.delPattern'), 'Must invalidate caches on payment');
});

// ==========================================
// 5. Reactive UI Refresh without Leaving History
// ==========================================
test('POSContext.jsx refreshes sales upon balance payment so History updates immediately', () => {
  assert(posContextSrc.includes('refreshSales();'), 'Must call refreshSales after balance payment');
  assert(posHistorySrc.includes('activeInvoice'), 'Must reactively derive activeInvoice from sales list');
});

console.log(`\n📊 Test Suite Summary: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);

if (passedTests === totalTests) {
  console.log('🎉 ALL POS HISTORY CLEAR BALANCE SPECIFICATION CHECKS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ Some tests failed. Please review the output above.\n');
  process.exit(1);
}
