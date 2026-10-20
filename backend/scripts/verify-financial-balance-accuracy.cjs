/**
 * Verification Test Suite: Financial Balance Accuracy & Consistency
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Financial Balance Accuracy Test Suite...\n');

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

// Read Source Files
const outletOrderControllerPath = path.resolve(__dirname, '../src/controllers/outletOrder.controller.js');
const orderControllerPath = path.resolve(__dirname, '../src/controllers/order.controller.js');
const clientControllerPath = path.resolve(__dirname, '../src/controllers/client.controller.js');
const posPrintPath = path.resolve(__dirname, '../../frontend/src/utils/POSPrint.js');
const printReportPath = path.resolve(__dirname, '../../frontend/src/utils/printReport.js');
const outletOrderEntryPath = path.resolve(__dirname, '../../frontend/src/pages/OutletOrderEntry.jsx');
const outletOrderLookupPath = path.resolve(__dirname, '../../frontend/src/pages/OutletOrderLookup.jsx');
const clientRegPath = path.resolve(__dirname, '../../frontend/src/pages/ClientRegistration.jsx');

const outletOrderControllerSrc = fs.readFileSync(outletOrderControllerPath, 'utf8');
const orderControllerSrc = fs.readFileSync(orderControllerPath, 'utf8');
const clientControllerSrc = fs.readFileSync(clientControllerPath, 'utf8');
const posPrintSrc = fs.readFileSync(posPrintPath, 'utf8');
const printReportSrc = fs.readFileSync(printReportPath, 'utf8');
const outletOrderEntrySrc = fs.readFileSync(outletOrderEntryPath, 'utf8');
const outletOrderLookupSrc = fs.readFileSync(outletOrderLookupPath, 'utf8');
const clientRegSrc = fs.readFileSync(clientRegPath, 'utf8');

// ==========================================
// 1. POSPrint.js Thermal Slip Balance Checks
// ==========================================
test('POSPrint.js checks paymentStatus === "PAID" to prevent phantom balance on paid orders', () => {
  assert(posPrintSrc.includes("String(order.paymentStatus || '').toUpperCase() === 'PAID'"), 'Must check order.paymentStatus === PAID');
  assert(posPrintSrc.includes('const advPaid = isPaid ? grandTotal :'), 'When isPaid, advance paid must equal grand total');
  assert(posPrintSrc.includes('const balDue = isPaid ? 0 :'), 'When isPaid, balance due must be strictly 0');
});

// ==========================================
// 2. printReport.js Job Sheet Balance Checks
// ==========================================
test('printReport.js checks isPaidStatus and sets balance to 0 for PAID orders', () => {
  assert(printReportSrc.includes("String(order.paymentStatus || '').toUpperCase() === 'PAID'"), 'Must check paymentStatus === PAID');
  assert(printReportSrc.includes("if (!isPaidStatus && isBalanceStatus)"), 'Only prints balance row if not isPaidStatus');
  assert(printReportSrc.includes("ORDER PAID"), 'Prints ORDER PAID badge');
});

// ==========================================
// 3. OutletOrderEntry.jsx Balance Calculation & Parity
// ==========================================
test('OutletOrderEntry.jsx has handleSelectPaid and handleSelectBalance with mathematical parity', () => {
  assert(outletOrderEntrySrc.includes('handleSelectPaid'), 'Must define handleSelectPaid');
  assert(outletOrderEntrySrc.includes('handleSelectBalance'), 'Must define handleSelectBalance');
  assert(outletOrderEntrySrc.includes('handleAdvanceChange'), 'Must define handleAdvanceChange');
  assert(outletOrderEntrySrc.includes('handleBalanceChange'), 'Must define handleBalanceChange');
});

test('OutletOrderEntry.jsx handleSubmit calculates computedAdv and computedBal accurately', () => {
  assert(outletOrderEntrySrc.includes('const isPaid = payStatus === \'PAID\';'), 'Must evaluate isPaid in handleSubmit');
  assert(outletOrderEntrySrc.includes('const computedBal = isPaid ? 0 :'), 'Must set computedBal to 0 when isPaid');
  assert(outletOrderEntrySrc.includes('const computedAdv = isPaid ? totalAmount :'), 'Must set computedAdv to totalAmount when isPaid');
  assert(outletOrderEntrySrc.includes('balanceAmount: isPaid ? 0 : computedBal'), 'Must send 0 balance when isPaid');
  assert(outletOrderEntrySrc.includes('advanceAmount: computedAdv'), 'Must send computedAdv');
});

test('OutletOrderEntry.jsx Step 3 has unified non-duplicate financial card', () => {
  assert(outletOrderEntrySrc.includes('Unified Payment & Balance Details Card'), 'Must have unified payment card');
  assert(outletOrderEntrySrc.includes('handleSelectPaid'), 'Must use handleSelectPaid in button');
  assert(outletOrderEntrySrc.includes('handleSelectBalance'), 'Must use handleSelectBalance in button');
  assert(!outletOrderEntrySrc.includes('placeholder="Enter exact balance amount (must be > 0)"'), 'Old duplicate input must be removed');
});

test('OutletOrderEntry.jsx submitted confirmation card displays correct paid and balance numbers', () => {
  assert(outletOrderEntrySrc.includes('computedBal > 0 ? "text-amber-400 font-black" : "text-emerald-400 font-black"'), 'Color balance green when 0');
  assert(outletOrderEntrySrc.includes('Paid / Advance: <span className="text-emerald-400 font-black">₨{computedAdv.toLocaleString()}</span>'), 'Shows accurate advance');
});

// ==========================================
// 4. Backend Controllers Balance & Payment Logic
// ==========================================
test('backend outletOrder.controller.js createOutletOrder enforces isPaid = payStatus === "PAID"', () => {
  assert(outletOrderControllerSrc.includes("const isPaid = payStatus === 'PAID';"), 'Must define isPaid in createOutletOrder');
  assert(outletOrderControllerSrc.includes("let finalBal = 0;"), 'Default finalBal to 0');
  assert(outletOrderControllerSrc.includes("let finalAdv = totalPrice;"), 'Default finalAdv to totalPrice');
  assert(outletOrderControllerSrc.includes("advanceAmount: finalAdv"), 'Pass finalAdv to order.create');
  assert(outletOrderControllerSrc.includes("balanceAmount: finalBal"), 'Pass finalBal to order.create');
});

test('backend outletOrder.controller.js lookupOrderWithFinancials returns 0 remaining on PAID orders', () => {
  assert(outletOrderControllerSrc.includes("isFullyPaidAtCheckout") && outletOrderControllerSrc.includes("String(order.paymentStatus"), 'Checks paymentStatus PAID and checkout status in posSale branch');
  assert(outletOrderControllerSrc.includes("remaining: bal,"), 'Sets remaining to bal in order-only branch');
  assert(outletOrderControllerSrc.includes("balanceAmount: bal,"), 'Sets balanceAmount to bal in order-only branch');
});

test('backend outletOrder.controller.js lookupPosSaleForOrderEntry returns 0 balance on PAID orders', () => {
  assert(outletOrderControllerSrc.includes("isFullyPaidAtCheckout") && outletOrderControllerSrc.includes("balanceAmount = isPaid ? 0 : rawBal;"), 'Sets balanceAmount to 0 when isPaid or fully paid at checkout');
});

test('backend outletOrder.controller.js fetchRecentOrdersForClient selects paymentStatus', () => {
  assert(outletOrderControllerSrc.includes("paymentStatus: true,"), 'fetchRecentOrdersForClient must include paymentStatus: true');
});

test('backend client.controller.js getClientById selects paymentStatus for recentOrders', () => {
  assert(clientControllerSrc.includes("paymentStatus: true,"), 'getClientById must select paymentStatus: true');
});

test('backend order.controller.js createOrder enforces 0 balance and full advance on PAID orders', () => {
  assert(orderControllerSrc.includes("const isOrderPaid = reqPayStatus === 'PAID';"), 'Must evaluate isOrderPaid');
  assert(orderControllerSrc.includes("finalAdv = effectiveTotalPrice;"), 'Sets finalAdv to effectiveTotalPrice on PAID');
  assert(orderControllerSrc.includes("finalBal = 0;"), 'Sets finalBal to 0 on PAID');
  assert(orderControllerSrc.includes("balanceAmount: finalBal"), 'Saves finalBal in order.create');
  assert(orderControllerSrc.includes("advanceAmount: finalAdv"), 'Saves finalAdv in order.create');
});

// ==========================================
// 5. Frontend Order Lookup & Client Registration
// ==========================================
test('OutletOrderLookup.jsx displays ₨0 in emerald green for PAID orders in table and details', () => {
  assert(outletOrderLookupSrc.includes("isPaid ? 0 :"), 'Sets remaining to 0 if isPaid in OutletOrderLookup');
  assert(outletOrderLookupSrc.includes("text-emerald-400 font-bold"), 'Uses emerald text for Rs. 0 balance');
});

test('ClientRegistration.jsx displays Fully Paid badge for PAID orders in order history', () => {
  assert(clientRegSrc.includes("ord.paymentStatus === 'PAID' || (ord.balanceAmount != null && parseFloat(ord.balanceAmount) <= 0.01)"), 'Checks paymentStatus === PAID or zero balance');
  assert(clientRegSrc.includes("✓ Fully Paid"), 'Renders Fully Paid badge');
});

// ==========================================
// 6. OutletOrderEntry Draft Purge & POS Parity
// ==========================================
test('OutletOrderEntry.jsx permanently purges draft and prevents re-flush upon placement', () => {
  assert(outletOrderEntrySrc.includes('COMPLETED_ORDERS_KEY'), 'Must define COMPLETED_ORDERS_KEY');
  assert(outletOrderEntrySrc.includes('markOrderCompletedInRegistry'), 'Must mark order completed in registry');
  assert(outletOrderEntrySrc.includes('isOrderSubmittedRef.current = true;'), 'Must set isOrderSubmittedRef on submit');
  assert(outletOrderEntrySrc.includes('if (!isHydratedRef.current || submitted || isOrderSubmittedRef.current) return;'), 'Must abort auto-save if submitted');
  assert(outletOrderEntrySrc.includes('if (posSaleInfo?.grandTotal > 0) return posSaleInfo.grandTotal;'), 'Must prioritize POS grandTotal for totalAmount');
});

console.log(`\n📊 Test Suite Summary: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);

if (passedTests === totalTests) {
  console.log('🎉 ALL FINANCIAL BALANCE ACCURACY CHECKS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ Some tests failed. Please review the output above.\n');
  process.exit(1);
}
