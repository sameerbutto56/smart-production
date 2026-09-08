/**
 * Automated Verification Script for POS Print Layouts
 * Validates Balance Clearance, Return/Refund, Replacement/Exchange, and Normal POS Print configurations.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const posPrintPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'POSPrint.js');
const content = fs.readFileSync(posPrintPath, 'utf8');

console.log('--- 1. Testing Master 80mm Thermal Printer Configuration ---');
// Must declare 80mm roll width and zero margin
assert.ok(content.includes('@page { margin: 0; size: 80mm auto; }'), 'Missing @page 80mm directive');
// Must declare Noto Naskh Arabic font
assert.ok(content.includes("'Noto Naskh Arabic'"), 'Missing Noto Naskh Arabic font declaration');
// Base font must be readable (16px)
assert.ok(content.includes('font-size: 16px'), 'Missing readable base font size 16px');
// Colors must be #000 (no faint gray text)
assert.ok(content.includes('color: #000'), 'Missing #000 high contrast text color');
// Dividers must be solid 2px black rules (no faint #ccc or dashed gray)
assert.ok(content.includes('border-top: 2px solid #000'), 'Missing solid 2px black dividing rules');
console.log('✓ Master 80mm Thermal CSS tokens confirmed.');

console.log('\n--- 2. Testing Balance Clearance Print Requirements ---');
// printBalanceReceipt must be exported
assert.ok(content.includes('export async function printBalanceReceipt'), 'printBalanceReceipt not exported as async function');
// Must include BALANCE CLEARANCE header
assert.ok(content.includes('BALANCE CLEARANCE'), 'Missing BALANCE CLEARANCE header in POSPrint.js');
// Must format and display all required fields:
assert.ok(content.includes('Clearance Receipt #:'), 'Missing Clearance Receipt # field');
assert.ok(content.includes('Original Invoice #:'), 'Missing Original Invoice # field');
assert.ok(content.includes('Order #:'), 'Missing Order # field');
assert.ok(content.includes('Previous Balance'), 'Missing Previous Balance field');
assert.ok(content.includes('Amount Cleared'), 'Missing Amount Cleared field');
assert.ok(content.includes('Payment Method'), 'Missing Payment Method field');
assert.ok(content.includes('Remaining Balance'), 'Missing Remaining Balance field');
assert.ok(content.includes('Clearance Date:'), 'Missing Clearance Date field');
assert.ok(content.includes('FULLY PAID — BALANCE CLEARED'), 'Missing fully paid badge');
assert.ok(content.includes('PARTIAL PAYMENT — BALANCE REMAINING'), 'Missing partial payment badge');
// Must use getThermalMasterCSS()
const balanceReceiptDef = content.slice(content.indexOf('printBalanceReceipt'), content.indexOf('printBalanceGatePass'));
assert.ok(balanceReceiptDef.includes('getThermalMasterCSS()'), 'printBalanceReceipt does not use getThermalMasterCSS');
assert.ok(!balanceReceiptDef.includes('width:300px'), 'printBalanceReceipt still contains arbitrary width:300px desktop clamp');
assert.ok(!balanceReceiptDef.includes('#ccc'), 'printBalanceReceipt still contains faint #ccc colors');
console.log('✓ Balance Clearance print inherits 80mm master layout and all required fields.');

console.log('\n--- 3. Testing Balance Clearance Gate Pass ---');
assert.ok(content.includes('export async function printBalanceGatePass'), 'printBalanceGatePass not exported');
const balanceGatePassDef = content.slice(content.indexOf('printBalanceGatePass'), content.indexOf('printReturnReceipt'));
assert.ok(balanceGatePassDef.includes('getThermalMasterCSS()'), 'printBalanceGatePass does not use getThermalMasterCSS');
assert.ok(!balanceGatePassDef.includes('width:300px'), 'printBalanceGatePass still contains arbitrary width:300px clamp');
assert.ok(!balanceGatePassDef.includes('background:#ffd700'), 'printBalanceGatePass still contains low-contrast yellow thermal background');
assert.ok(balanceGatePassDef.includes('Authorised Signature'), 'Missing signature line on Gate Pass');
console.log('✓ Balance Gate Pass updated to master 80mm standard.');

console.log('\n--- 4. Testing Return / Refund Receipt ---');
assert.ok(content.includes('export async function printReturnReceipt'), 'printReturnReceipt not exported');
const returnReceiptDef = content.slice(content.indexOf('printReturnReceipt'), content.indexOf('printCloseBook'));
assert.ok(returnReceiptDef.includes('RETURN / REFUND RECEIPT'), 'Missing RETURN / REFUND RECEIPT banner');
assert.ok(returnReceiptDef.includes('getThermalMasterCSS()'), 'printReturnReceipt does not use getThermalMasterCSS');
assert.ok(returnReceiptDef.includes('Invoice #:'), 'Missing invoice number in return receipt');
assert.ok(returnReceiptDef.includes('Return Reason:'), 'Missing return reason in return receipt');
assert.ok(returnReceiptDef.includes('Refund Mode:'), 'Missing refund mode in return receipt');
assert.ok(returnReceiptDef.includes('Total Amount Refunded'), 'Missing Total Amount Refunded field');
assert.ok(returnReceiptDef.includes('RETURNED ITEMS'), 'Missing RETURNED ITEMS section');
console.log('✓ Return / Refund Receipt layout confirmed.');

console.log('\n--- 5. Testing Exchange / Replacement Layout in Master POS Print ---');
const printReceiptDef = content.slice(content.indexOf('export async function printReceipt'), content.indexOf('printBalanceReceipt'));
assert.ok(printReceiptDef.includes('EXCHANGE / REPLACEMENT RECEIPT'), 'Missing EXCHANGE / REPLACEMENT banner');
assert.ok(printReceiptDef.includes('NEW / REPLACEMENT ITEMS'), 'Missing NEW / REPLACEMENT ITEMS section');
assert.ok(printReceiptDef.includes('RETURNED / EXCHANGED ITEMS'), 'Missing RETURNED / EXCHANGED ITEMS section');
assert.ok(printReceiptDef.includes('Exchange Credit'), 'Missing Exchange Credit deduction line in summary');
assert.ok(printReceiptDef.includes('GATE PASS'), 'Gate pass included');
console.log('✓ Exchange / Replacement order layout verified.');

console.log('\n--- 6. Checking Component Integration in Outlet and POS ---');
const invoiceHistoryPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'OutletInvoiceHistory.jsx');
const invoiceHistoryContent = fs.readFileSync(invoiceHistoryPath, 'utf8');
assert.ok(invoiceHistoryContent.includes("import { printReceipt, printBalanceReceipt, printBalanceGatePass, printReturnReceipt } from '../utils/POSPrint'"), 'OutletInvoiceHistory does not import all print functions');
assert.ok(!invoiceHistoryContent.includes('const printReceipt = async (sale) =>'), 'OutletInvoiceHistory still contains duplicate local printReceipt implementation');

const posContextPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'context', 'POSContext.jsx');
const posContextContent = fs.readFileSync(posContextPath, 'utf8');
assert.ok(posContextContent.includes("import { printReturnReceipt } from '../utils/POSPrint'"), 'POSContext does not import printReturnReceipt');
assert.ok(posContextContent.includes('printReturnReceipt(refundedSale)'), 'POSContext does not trigger printReturnReceipt on invoice refund');

const posReturnsPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'POSReturns.jsx');
const posReturnsContent = fs.readFileSync(posReturnsPath, 'utf8');
assert.ok(posReturnsContent.includes('printReturnReceipt(lookedUpReturnSale)'), 'POSReturns does not offer printReturnReceipt on refunded invoices');

console.log('✓ Component integration verified across OutletInvoiceHistory, POSContext, and POSReturns.');
console.log('\nALL 6 VERIFICATION SUITES PASSED (100%).');
