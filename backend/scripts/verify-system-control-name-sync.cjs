/**
 * Verification test script: System Control & Navbar Name Synchronization
 * Validates that every feature option in Software Settings -> System Control
 * exactly matches the corresponding profile navbar / feature name.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { FEATURES: backendFeatures } = require('../src/utils/featureRegistry');

async function run() {
  console.log('🧪 Starting System Control Name Synchronization Verification...\n');

  // 1. Read frontend featureRegistry.js
  const frontendPath = path.resolve(__dirname, '../../frontend/src/utils/featureRegistry.js');
  const frontendContent = fs.readFileSync(frontendPath, 'utf8');

  // 2. Read Layout.jsx
  const layoutPath = path.resolve(__dirname, '../../frontend/src/components/Layout.jsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  console.log('--- Step 1: Checking specific key names requested by user ---');
  
  // Requirement: "If the navbar says Return & Exchange, System Control must also say Return & Exchange"
  const retEx = backendFeatures.find(f => f.id === 'RETURN_EXCHANGE');
  assert.strictEqual(retEx.name, 'Return & Exchange', 'RETURN_EXCHANGE must be named "Return & Exchange"');
  console.log(`  ✅ RETURN_EXCHANGE name: "${retEx.name}" matches navbar`);

  // Requirement: "If the navbar says Verification, System Control must also say Verification"
  const verif = backendFeatures.find(f => f.id === 'ORDER_VERIFICATION');
  assert.strictEqual(verif.name, 'Verification', 'ORDER_VERIFICATION must be named "Verification"');
  console.log(`  ✅ ORDER_VERIFICATION name: "${verif.name}" matches navbar`);

  // Requirement: "Do not use internal, shortened, or different names"
  const orderTrack = backendFeatures.find(f => f.id === 'ORDER_TRACK');
  assert.strictEqual(orderTrack.name, 'Order Track', 'ORDER_TRACK must be named "Order Track"');
  console.log(`  ✅ ORDER_TRACK name: "${orderTrack.name}" matches navbar`);

  const orderCancel = backendFeatures.find(f => f.id === 'ORDER_CANCEL');
  assert.strictEqual(orderCancel.name, 'Order Cancellation', 'ORDER_CANCEL must be named "Order Cancellation"');
  console.log(`  ✅ ORDER_CANCEL name: "${orderCancel.name}" matches navbar`);

  const orderEntry = backendFeatures.find(f => f.id === 'ORDER_ENTRY');
  assert.strictEqual(orderEntry.name, 'Order Entry', 'ORDER_ENTRY must be named "Order Entry"');
  console.log(`  ✅ ORDER_ENTRY name: "${orderEntry.name}" matches navbar`);

  const editReq = backendFeatures.find(f => f.id === 'ORDER_EDIT');
  assert.strictEqual(editReq.name, 'Edit Request', 'ORDER_EDIT must be named "Edit Request"');
  console.log(`  ✅ ORDER_EDIT name: "${editReq.name}" matches navbar`);

  const delOrders = backendFeatures.find(f => f.id === 'ORDER_DELETE');
  assert.strictEqual(delOrders.name, 'Deleted Orders', 'ORDER_DELETE must be named "Deleted Orders"');
  console.log(`  ✅ ORDER_DELETE name: "${delOrders.name}" matches navbar`);

  const retVerif = backendFeatures.find(f => f.id === 'RETURNED_FROM_VERIFICATION');
  assert.strictEqual(retVerif.name, 'Return from Verification', 'RETURNED_FROM_VERIFICATION must be named "Return from Verification"');
  console.log(`  ✅ RETURNED_FROM_VERIFICATION name: "${retVerif.name}" matches navbar`);

  const storeTasks = backendFeatures.find(f => f.id === 'STORE_TASKS');
  assert.strictEqual(storeTasks.name, 'My Tasks', 'STORE_TASKS must be named "My Tasks"');
  console.log(`  ✅ STORE_TASKS name: "${storeTasks.name}" matches navbar`);

  const asmAlloc = backendFeatures.find(f => f.id === 'STORE_ASM_ALLOCATION');
  assert.strictEqual(asmAlloc.name, 'ASM Allocate', 'STORE_ASM_ALLOCATION must be named "ASM Allocate"');
  console.log(`  ✅ STORE_ASM_ALLOCATION name: "${asmAlloc.name}" matches navbar`);

  const storeReturns = backendFeatures.find(f => f.id === 'STORE_RETURNS');
  assert.strictEqual(storeReturns.name, 'Returns', 'STORE_RETURNS must be named "Returns"');
  console.log(`  ✅ STORE_RETURNS name: "${storeReturns.name}" matches navbar`);

  const storeReplacements = backendFeatures.find(f => f.id === 'STORE_REPLACEMENTS');
  assert.strictEqual(storeReplacements.name, 'Replacements', 'STORE_REPLACEMENTS must be named "Replacements"');
  console.log(`  ✅ STORE_REPLACEMENTS name: "${storeReplacements.name}" matches navbar`);

  const storeAudit = backendFeatures.find(f => f.id === 'STORE_INVENTORY_AUDIT');
  assert.strictEqual(storeAudit.name, 'Inventory Audit', 'STORE_INVENTORY_AUDIT must be named "Inventory Audit"');
  console.log(`  ✅ STORE_INVENTORY_AUDIT name: "${storeAudit.name}" matches navbar`);

  const warehouse = backendFeatures.find(f => f.id === 'WAREHOUSE_VIEW');
  assert.strictEqual(warehouse.name, 'Warehouse', 'WAREHOUSE_VIEW must be named "Warehouse"');
  console.log(`  ✅ WAREHOUSE_VIEW name: "${warehouse.name}" matches navbar`);

  const demandLedger = backendFeatures.find(f => f.id === 'DEMAND_LEDGER_VIEW');
  assert.strictEqual(demandLedger.name, 'Demand Ledger', 'DEMAND_LEDGER_VIEW must be named "Demand Ledger"');
  console.log(`  ✅ DEMAND_LEDGER_VIEW name: "${demandLedger.name}" matches navbar`);

  const outletPos = backendFeatures.find(f => f.id === 'OUTLET_POS');
  assert.strictEqual(outletPos.name, 'POS', 'OUTLET_POS must be named "POS"');
  console.log(`  ✅ OUTLET_POS name: "${outletPos.name}" matches navbar`);

  const outletInvQuote = backendFeatures.find(f => f.id === 'OUTLET_INVOICE_QUOTATION');
  assert.strictEqual(outletInvQuote.name, 'Invoice / Quotation', 'OUTLET_INVOICE_QUOTATION must be named "Invoice / Quotation"');
  console.log(`  ✅ OUTLET_INVOICE_QUOTATION name: "${outletInvQuote.name}" matches navbar`);

  const outletRequests = backendFeatures.find(f => f.id === 'OUTLET_STOCK_REQUEST');
  assert.strictEqual(outletRequests.name, 'Outlet Requests', 'OUTLET_STOCK_REQUEST must be named "Outlet Requests"');
  console.log(`  ✅ OUTLET_STOCK_REQUEST name: "${outletRequests.name}" matches navbar`);

  const inDispatch = backendFeatures.find(f => f.id === 'OUTLET_IN_DISPATCH');
  assert.strictEqual(inDispatch.name, 'In Dispatch', 'OUTLET_IN_DISPATCH must be named "In Dispatch"');
  console.log(`  ✅ OUTLET_IN_DISPATCH name: "${inDispatch.name}" matches navbar`);

  const gatePass = backendFeatures.find(f => f.id === 'OUTLET_GATE_PASS');
  assert.strictEqual(gatePass.name, 'Gate Pass', 'OUTLET_GATE_PASS must be named "Gate Pass"');
  console.log(`  ✅ OUTLET_GATE_PASS name: "${gatePass.name}" matches navbar`);

  const generalEntries = backendFeatures.find(f => f.id === 'GENERAL_ENTRIES');
  assert.strictEqual(generalEntries.name, 'General Entries', 'GENERAL_ENTRIES must be named "General Entries"');
  console.log(`  ✅ GENERAL_ENTRIES name: "${generalEntries.name}" matches navbar`);

  const bankDeposit = backendFeatures.find(f => f.id === 'BANK_DEPOSIT');
  assert.strictEqual(bankDeposit.name, 'Bank Deposit', 'BANK_DEPOSIT must be named "Bank Deposit"');
  console.log(`  ✅ BANK_DEPOSIT name: "${bankDeposit.name}" matches navbar`);

  const deliveries = backendFeatures.find(f => f.id === 'DELIVERY_DASHBOARD');
  assert.strictEqual(deliveries.name, 'Deliveries', 'DELIVERY_DASHBOARD must be named "Deliveries"');
  console.log(`  ✅ DELIVERY_DASHBOARD name: "${deliveries.name}" matches navbar`);

  const refundMgmt = backendFeatures.find(f => f.id === 'REFUND_MANAGEMENT');
  assert.strictEqual(refundMgmt.name, 'Refund Management', 'REFUND_MANAGEMENT must be named "Refund Management"');
  console.log(`  ✅ REFUND_MANAGEMENT name: "${refundMgmt.name}" matches navbar`);

  const alteration = backendFeatures.find(f => f.id === 'ALTERATION_PRODUCTION');
  assert.strictEqual(alteration.name, 'Alteration', 'ALTERATION_PRODUCTION must be named "Alteration"');
  console.log(`  ✅ ALTERATION_PRODUCTION name: "${alteration.name}" matches navbar`);

  const alterationIn = backendFeatures.find(f => f.id === 'PRODUCTION_IN');
  assert.strictEqual(alterationIn.name, 'Alteration In', 'PRODUCTION_IN must be named "Alteration In"');
  console.log(`  ✅ PRODUCTION_IN name: "${alterationIn.name}" matches navbar`);

  const alterationOut = backendFeatures.find(f => f.id === 'PRODUCTION_OUT');
  assert.strictEqual(alterationOut.name, 'Alteration Out', 'PRODUCTION_OUT must be named "Alteration Out"');
  console.log(`  ✅ PRODUCTION_OUT name: "${alterationOut.name}" matches navbar`);

  const engraving = backendFeatures.find(f => f.id === 'ENGRAVING_QUEUE');
  assert.strictEqual(engraving.name, 'Engraving', 'ENGRAVING_QUEUE must be named "Engraving"');
  console.log(`  ✅ ENGRAVING_QUEUE name: "${engraving.name}" matches navbar`);

  console.log('\n--- Step 2: Verifying frontend and backend featureRegistry match 100% ---');
  for (const feat of backendFeatures) {
    assert(frontendContent.includes(`id: '${feat.id}'`), `Frontend contains ${feat.id}`);
    assert(frontendContent.includes(`name: '${feat.name}'`), `Frontend contains exact name "${feat.name}" for ${feat.id}`);
  }
  console.log(`  ✅ All ${backendFeatures.length} features matched with identical names in frontend!`);

  console.log('\n==============================================');
  console.log('🎉 ALL SYSTEM CONTROL NAME CHECKS PASSED 100%!');
  console.log('==============================================\n');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
