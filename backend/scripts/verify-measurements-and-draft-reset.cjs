/**
 * Verification Test Suite:
 * Customer Measurements, Urdu Size Chart, Product Special Notes & Order Draft Reset
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Verification Test Suite...\n');

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

// 1. Read files
const measurementUtilsPath = path.resolve(__dirname, '../../frontend/src/utils/measurementUtils.js');
const clientRegPath = path.resolve(__dirname, '../../frontend/src/pages/ClientRegistration.jsx');
const outletOrderEntryPath = path.resolve(__dirname, '../../frontend/src/pages/OutletOrderEntry.jsx');

const measurementUtilsSrc = fs.readFileSync(measurementUtilsPath, 'utf8');
const clientRegSrc = fs.readFileSync(clientRegPath, 'utf8');
const outletOrderEntrySrc = fs.readFileSync(outletOrderEntryPath, 'utf8');

// Compile measurementUtils using eval or module mock
// Since measurementUtils uses ES exports, create a commonjs wrapper
const cjsModuleCode = measurementUtilsSrc
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  + '\nmodule.exports = { SHIRT_MEASUREMENT_FIELDS, TROUSER_MEASUREMENT_FIELDS, OPTIONAL_MEASUREMENT_FIELDS, normalizeCustomerMeasurements, formatUrduMeasurementNote, mergeMeasurementSpecialNote, getProductMeasurementType };';

const tempCjsPath = path.resolve(__dirname, 'temp-measurement-utils.cjs');
fs.writeFileSync(tempCjsPath, cjsModuleCode);
const utils = require(tempCjsPath);

// ==========================================
// Test 1: Field definitions and Urdu labels
// ==========================================
test('SHIRT_MEASUREMENT_FIELDS has 6 standard fields with correct Urdu labels', () => {
  assert.strictEqual(utils.SHIRT_MEASUREMENT_FIELDS.length, 6);
  const keys = utils.SHIRT_MEASUREMENT_FIELDS.map(f => f.key);
  assert.deepStrictEqual(keys, ['shirtLength', 'shoulder', 'sleevesLength', 'chest', 'shirtWaist', 'bottom']);
  
  const urduMap = Object.fromEntries(utils.SHIRT_MEASUREMENT_FIELDS.map(f => [f.key, f.labelUrdu]));
  assert.strictEqual(urduMap.shirtLength, 'شرٹ لمبائی');
  assert.strictEqual(urduMap.shoulder, 'کندھا');
  assert.strictEqual(urduMap.sleevesLength, 'بازو لمبائی');
  assert.strictEqual(urduMap.chest, 'چیسٹ');
  assert.strictEqual(urduMap.shirtWaist, 'کمر');
  assert.strictEqual(urduMap.bottom, 'باٹم');
});

test('TROUSER_MEASUREMENT_FIELDS has 5 standard fields with correct Urdu labels', () => {
  assert.strictEqual(utils.TROUSER_MEASUREMENT_FIELDS.length, 5);
  const keys = utils.TROUSER_MEASUREMENT_FIELDS.map(f => f.key);
  assert.deepStrictEqual(keys, ['trouserLength', 'trouserWaist', 'thighs', 'pancha', 'trouserQamar']);

  const urduMap = Object.fromEntries(utils.TROUSER_MEASUREMENT_FIELDS.map(f => [f.key, f.labelUrdu]));
  assert.strictEqual(urduMap.trouserLength, 'لمبائی');
  assert.strictEqual(urduMap.trouserWaist, 'ویسٹ');
  assert.strictEqual(urduMap.thighs, 'تھائی');
  assert.strictEqual(urduMap.pancha, 'پانچا');
  assert.strictEqual(urduMap.trouserQamar, 'کمر');
});

// ==========================================
// Test 2: Normalization of Customer Measurements
// ==========================================
test('normalizeCustomerMeasurements preserves decimal values and separates shirtWaist and trouserWaist and trouserQamar', () => {
  const sample = {
    shirtLength: '28',
    shoulder: '17',
    sleevesLength: '18',
    chest: '23.5',
    shirtWaist: '21.5',
    bottom: '25',
    trouserLength: '39.5',
    trouserWaist: '40',
    thighs: '28',
    pancha: '24',
    trouserQamar: '21.5'
  };

  const normalized = utils.normalizeCustomerMeasurements(sample);
  assert.strictEqual(normalized.shirtLength, '28');
  assert.strictEqual(normalized.chest, '23.5');
  assert.strictEqual(normalized.shirtWaist, '21.5');
  assert.strictEqual(normalized.trouserLength, '39.5');
  assert.strictEqual(normalized.trouserWaist, '40');
  assert.strictEqual(normalized.trouserQamar, '21.5');
});

test('normalizeCustomerMeasurements handles legacy single waist and length correctly', () => {
  const legacy = {
    chest: '24',
    waist: '38',
    length: '40',
    qamar: '22'
  };
  const normalized = utils.normalizeCustomerMeasurements(legacy);
  assert.strictEqual(normalized.chest, '24');
  assert.strictEqual(normalized.trouserWaist, '38');
  assert.strictEqual(normalized.trouserLength, '40');
  assert.strictEqual(normalized.trouserQamar, '22');
});

test('normalizeCustomerMeasurements parses JSON string input without throwing', () => {
  const jsonStr = JSON.stringify({
    shirtLength: '28.5',
    trouserLength: '41'
  });
  const normalized = utils.normalizeCustomerMeasurements(jsonStr);
  assert.strictEqual(normalized.shirtLength, '28.5');
  assert.strictEqual(normalized.trouserLength, '41');
});

// ==========================================
// Test 3: Formatting Urdu Measurement Notes
// ==========================================
test('formatUrduMeasurementNote formats Shirt measurements with exact Urdu labels', () => {
  const measurements = {
    shirtLength: '28',
    shoulder: '17',
    sleevesLength: '18',
    chest: '23.5',
    shirtWaist: '21.5',
    bottom: '25'
  };

  const note = utils.formatUrduMeasurementNote(measurements, 'shirt');
  assert.ok(note.includes('کسٹم سائز (انچ میں)'));
  assert.ok(note.includes('شرٹ'));
  assert.ok(note.includes('شرٹ لمبائی: 28'));
  assert.ok(note.includes('کندھا: 17'));
  assert.ok(note.includes('بازو لمبائی: 18'));
  assert.ok(note.includes('چیسٹ: 23.5'));
  assert.ok(note.includes('کمر: 21.5'));
  assert.ok(note.includes('باٹم: 25'));
  assert.ok(!note.includes('ٹراؤزر'));
});

test('formatUrduMeasurementNote formats Trouser measurements with exact Urdu labels', () => {
  const measurements = {
    trouserLength: '39.5',
    trouserWaist: '40',
    thighs: '28',
    pancha: '24',
    trouserQamar: '21.5'
  };

  const note = utils.formatUrduMeasurementNote(measurements, 'trouser');
  assert.ok(note.includes('کسٹم سائز (انچ میں)'));
  assert.ok(note.includes('ٹراؤزر'));
  assert.ok(note.includes('لمبائی: 39.5'));
  assert.ok(note.includes('ویسٹ: 40'));
  assert.ok(note.includes('تھائی: 28'));
  assert.ok(note.includes('پانچا: 24'));
  assert.ok(note.includes('کمر: 21.5'));
  assert.ok(!note.includes('شرٹ'));
});

test('formatUrduMeasurementNote formats Both Shirt and Trouser for full suits', () => {
  const measurements = {
    shirtLength: '28',
    trouserLength: '39.5'
  };
  const note = utils.formatUrduMeasurementNote(measurements, 'both');
  assert.ok(note.includes('کسٹم سائز (انچ میں)'));
  assert.ok(note.includes('شرٹ'));
  assert.ok(note.includes('شرٹ لمبائی: 28'));
  assert.ok(note.includes('ٹراؤزر'));
  assert.ok(note.includes('لمبائی: 39.5'));
});

test('formatUrduMeasurementNote does not generate phantom zeros for empty measurements', () => {
  const empty = {};
  const note = utils.formatUrduMeasurementNote(empty, 'both');
  assert.strictEqual(note, '');
});

// ==========================================
// Test 4: Merging Product Special Notes
// ==========================================
test('mergeMeasurementSpecialNote updates measurement block without duplicating notes and preserves user remarks', () => {
  const initialNote = 'Please use double stitch on pockets.\nUrgent delivery requested.';
  const measurementNote = 'کسٹم سائز (انچ میں) - شرٹ:\nشرٹ لمبائی: 28 | چیسٹ: 23.5';

  const merged = utils.mergeMeasurementSpecialNote(initialNote, measurementNote);
  assert.ok(merged.includes('Please use double stitch on pockets.'));
  assert.ok(merged.includes('Urgent delivery requested.'));
  assert.ok(merged.includes('شرٹ لمبائی: 28'));

  // Updating again with revised measurements should replace the measurement block, not duplicate
  const updatedMeasurementNote = 'کسٹم سائز (انچ میں) - شرٹ:\nشرٹ لمبائی: 29 | چیسٹ: 24';
  const mergedAgain = utils.mergeMeasurementSpecialNote(merged, updatedMeasurementNote);
  
  assert.ok(mergedAgain.includes('Please use double stitch on pockets.'));
  assert.ok(mergedAgain.includes('شرٹ لمبائی: 29'));
  assert.ok(!mergedAgain.includes('شرٹ لمبائی: 28'));
  // Count occurrences of header
  const count = (mergedAgain.match(/کسٹم سائز \(انچ میں\) - شرٹ:/g) || []).length;
  assert.strictEqual(count, 1, 'Header must not be duplicated');
});

// ==========================================
// Test 5: getProductMeasurementType detection
// ==========================================
test('getProductMeasurementType detects shirt vs trouser vs both correctly', () => {
  assert.strictEqual(utils.getProductMeasurementType('Scrub Top'), 'shirt');
  assert.strictEqual(utils.getProductMeasurementType('Shirt'), 'shirt');
  assert.strictEqual(utils.getProductMeasurementType('Doctor Coat (Lab Coat)'), 'shirt');
  
  assert.strictEqual(utils.getProductMeasurementType('Scrub Trouser'), 'trouser');
  assert.strictEqual(utils.getProductMeasurementType('Pants'), 'trouser');
  assert.strictEqual(utils.getProductMeasurementType('Warm-up Trouser'), 'trouser');

  assert.strictEqual(utils.getProductMeasurementType('Custom Scrub Suit'), 'both');
  assert.strictEqual(utils.getProductMeasurementType('Two-piece Uniform Set'), 'both');
});

// ==========================================
// Test 6: ClientRegistration.jsx verification
// ==========================================
test('ClientRegistration.jsx imports and uses normalizeCustomerMeasurements', () => {
  assert.ok(clientRegSrc.includes('import {'), 'Imports present');
  assert.ok(clientRegSrc.includes('SHIRT_MEASUREMENT_FIELDS'), 'SHIRT_MEASUREMENT_FIELDS imported');
  assert.ok(clientRegSrc.includes('TROUSER_MEASUREMENT_FIELDS'), 'TROUSER_MEASUREMENT_FIELDS imported');
  assert.ok(clientRegSrc.includes('normalizeCustomerMeasurements'), 'normalizeCustomerMeasurements imported');
  assert.ok(clientRegSrc.includes('normalizeCustomerMeasurements(client.sizeDetails)'), 'Normalizes sizeDetails on client load');
});

test('ClientRegistration.jsx renders Urdu labels for shirt and trouser measurements', () => {
  assert.ok(clientRegSrc.includes('کسٹم شرٹ سائز (انچ میں)'), 'Urdu header for shirt present');
  assert.ok(clientRegSrc.includes('کسٹم ٹراؤزر سائز (انچ میں)'), 'Urdu header for trouser present');
  assert.ok(clientRegSrc.includes('field.labelUrdu'), 'field.labelUrdu rendered in form');
});

// ==========================================
// Test 7: OutletOrderEntry.jsx verification
// ==========================================
test('OutletOrderEntry.jsx renders Urdu Custom Measurement Chart in Step 2', () => {
  assert.ok(outletOrderEntrySrc.includes('کسٹم سائز (انچ میں)'), 'Step 2 renders Urdu chart header');
  assert.ok(outletOrderEntrySrc.includes('Apply to Special Notes (کسٹم سائز اپلائی کریں)'), 'Action button present');
  assert.ok(outletOrderEntrySrc.includes('شرٹ کا کسٹم ناپ'), 'Shirt custom measurements subheader present');
  assert.ok(outletOrderEntrySrc.includes('ٹراؤزر کا کسٹم ناپ'), 'Trouser custom measurements subheader present');
});

test('OutletOrderEntry.jsx selectClient does NOT overwrite customer measurements with orders[0].sizeData', () => {
  assert.ok(outletOrderEntrySrc.includes('normalizeCustomerMeasurements(client.sizeDetails)'), 'Client measurements normalized');
  assert.ok(outletOrderEntrySrc.includes('!loaded && orders && orders.length > 0 && orders[0].sizeData'), 'Only falls back if no client measurements exist');
  assert.ok(outletOrderEntrySrc.includes('if (hasCustom) setSizingMode(\'custom\')'), 'Defaults to custom mode when custom measurements exist');
});

test('OutletOrderEntry.jsx clears draft and URL query params on successful order submission and reset', () => {
  assert.ok(outletOrderEntrySrc.includes('sessionStorage.setItem(\'enamels_last_completed_order\', orderNumber)'), 'Stores last completed order in session');
  assert.ok(outletOrderEntrySrc.includes('window.history.replaceState({}, \'\', window.location.pathname)'), 'Clears URL query params');
  assert.ok(outletOrderEntrySrc.includes('lastCompleted && parsed.orderNumber && parsed.orderNumber.trim() === lastCompleted.trim()'), 'readDraft prevents reviving submitted order');
});

test('OutletOrderEntry.jsx passes clientMeasurements in sizeData for order payload and thermal slip', () => {
  assert.ok(outletOrderEntrySrc.includes('Object.keys(clientMeasurements).length > 0 ? clientMeasurements : null'), 'clientMeasurements included in sizeData');
});

// Cleanup temp file
try { fs.unlinkSync(tempCjsPath); } catch {}

console.log(`\n🎉 Verification Completed: ${passedTests} of ${totalTests} tests passed (100%)\n`);
assert.strictEqual(passedTests, totalTests, 'All tests must pass');
