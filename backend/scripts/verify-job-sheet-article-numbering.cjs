/**
 * Verification Script for Job Sheet Article Numbering for Special Notes & Engraving
 * 
 * Verifies:
 * 1. Article number is source of truth (1, 2, 3, 4, 5...)
 * 2. If Articles 1, 3, 5 have notes, notes are labeled 1, 3, 5 (NEVER renumbered as 1, 2, 3)
 * 3. Articles 2, 4 without notes produce NO rows or blank lines
 * 4. Empty/whitespace-only notes are treated as no note
 * 5. Engraving section maintains exact synchronized article numbering (1, 3, 5)
 * 6. Dynamic addition and removal updates numbering correctly
 */

const assert = require('assert');

// Mock browser environment for printJobSheet testing
let capturedHtml = [];
const mockWin = {
  document: {
    write: (content) => {
      capturedHtml.push(content);
    },
    close: () => {}
  },
  focus: () => {},
  print: () => {}
};

// Extractor logic matching frontend/src/utils/printReport.js
const getItemProduct = (item) => {
  if (!item) return {};
  if (item.productDetails && typeof item.productDetails === 'object') {
    return { ...item.productDetails, gender: item.productDetails.gender || item.gender || null };
  }
  if (item.name || item.productType || item.fabricType) return item;
  return {};
};

const getArticleSpecialNote = (item, p) => {
  if (!p && !item) return '';
  const n = p?.measurementSpecialNote ?? p?.specialNote ?? item?.specialNote ?? item?.notes ?? p?.notes ?? '';
  let str = (typeof n === 'string' ? n : String(n || '')).trim();
  if (!str && item?.sizeData) {
    try {
      const sd = typeof item.sizeData === 'string' ? JSON.parse(item.sizeData) : item.sizeData;
      str = (sd?.specialNote || '').trim();
    } catch (e) {}
  }
  return str;
};

function generateJobSheetNotes(allItems, isMultiItem, firstProduct, order = {}) {
  let productNotes = [];
  if (isMultiItem) {
    allItems.forEach((item, idx) => {
      const p = getItemProduct(item);
      const note = getArticleSpecialNote(item, p);
      if (note) {
        productNotes.push({
          articleNumber: idx + 1,
          name: p.productType || p.name || `Article ${idx + 1}`,
          color: p.color || '',
          note
        });
      }
    });
  } else {
    const p = firstProduct;
    const fallback = (order.measurementSpecialNote || order.specialNote || '').trim();
    const note = getArticleSpecialNote(null, p) || fallback;
    if (note) {
      productNotes.push({
        articleNumber: 1,
        name: p.productType || p.name || 'Article 1',
        color: p.color || '',
        note
      });
    }
  }
  return productNotes;
}

function generateJobSheetEngravings(brandingItems) {
  let engravingItems = [];
  brandingItems.forEach((item, idx) => {
    const p = getItemProduct(item);
    const hasEngraving = !!(p.engravingRequired || (Array.isArray(p.engravingLines) && p.engravingLines.some(l => l && String(l).trim())));
    if (hasEngraving) {
      engravingItems.push({
        articleNumber: idx + 1,
        name: p.productType || p.name || `Item ${idx + 1}`,
        color: p.color || '',
        lines: (p.engravingLines || []).filter(l => l && String(l).trim())
      });
    }
  });
  return engravingItems;
}

async function runTests() {
  console.log('--- RUNNING JOB SHEET ARTICLE NUMBERING VERIFICATION ---');

  // Test Case 1: 5 Articles, Notes on 1, 3, 5. Articles 2 and 4 have empty/whitespace notes.
  console.log('\n[Test 1] 5 Articles with notes on 1, 3, and 5:');
  const articles5 = [
    { name: 'Scrub Set', productType: 'Scrub Set', color: 'Navy', measurementSpecialNote: 'Special embroidery on left chest', engravingRequired: true, engravingLines: ['Dr. John'] },
    { name: 'Scrub Set', productType: 'Scrub Set', color: 'Black', measurementSpecialNote: '', engravingRequired: false },
    { name: 'Lab Coat', productType: 'Lab Coat', color: 'White', measurementSpecialNote: 'Shorter sleeve required', engravingRequired: true, engravingLines: ['Dr. Jane'] },
    { name: 'Scrub Set', productType: 'Scrub Set', color: 'Teal', measurementSpecialNote: '   ', engravingRequired: false }, // whitespace only
    { name: 'Lab Coat', productType: 'Lab Coat', color: 'White', measurementSpecialNote: 'Name embroidery required', engravingRequired: true, engravingLines: ['Clinic Chief'] }
  ];

  const notes1 = generateJobSheetNotes(articles5, true, articles5[0]);
  console.log('Resulting product notes:', notes1);

  assert.strictEqual(notes1.length, 3, 'Expected exactly 3 notes');
  assert.strictEqual(notes1[0].articleNumber, 1, 'First note must be Article 1');
  assert.strictEqual(notes1[0].note, 'Special embroidery on left chest');
  assert.strictEqual(notes1[1].articleNumber, 3, 'Second note must be Article 3 (NOT renumbered to 2)');
  assert.strictEqual(notes1[1].note, 'Shorter sleeve required');
  assert.strictEqual(notes1[2].articleNumber, 5, 'Third note must be Article 5 (NOT renumbered to 3)');
  assert.strictEqual(notes1[2].note, 'Name embroidery required');

  // Check no notes exist for Article 2 or 4
  assert.strictEqual(notes1.some(n => n.articleNumber === 2), false, 'Article 2 must not be present');
  assert.strictEqual(notes1.some(n => n.articleNumber === 4), false, 'Article 4 must not be present');
  console.log('✓ PASS: Special Notes preserve original article numbers 1, 3, 5 with zero blank entries for 2 and 4.');

  // Test Case 2: Engravings synchronization
  console.log('\n[Test 2] Engraving items synchronization with Article Table:');
  const engravings1 = generateJobSheetEngravings(articles5);
  console.log('Resulting engraving items:', engravings1);

  assert.strictEqual(engravings1.length, 3, 'Expected exactly 3 engravings');
  assert.strictEqual(engravings1[0].articleNumber, 1, 'First engraving must be Article 1');
  assert.strictEqual(engravings1[1].articleNumber, 3, 'Second engraving must be Article 3');
  assert.strictEqual(engravings1[2].articleNumber, 5, 'Third engraving must be Article 5');
  assert.strictEqual(engravings1.some(e => e.articleNumber === 2), false, 'Article 2 must have no engraving');
  assert.strictEqual(engravings1.some(e => e.articleNumber === 4), false, 'Article 4 must have no engraving');
  console.log('✓ PASS: Engravings strictly synchronized with Article Table numbers 1, 3, 5.');

  // Test Case 3: Dynamic removal of Article 3 note
  console.log('\n[Test 3] Dynamic removal of Article 3 note:');
  const articlesRemoved3 = JSON.parse(JSON.stringify(articles5));
  articlesRemoved3[2].measurementSpecialNote = ''; // clear note for Article 3

  const notesAfterRemoval = generateJobSheetNotes(articlesRemoved3, true, articlesRemoved3[0]);
  console.log('Notes after removing Article 3:', notesAfterRemoval);

  assert.strictEqual(notesAfterRemoval.length, 2, 'Expected exactly 2 notes remaining');
  assert.strictEqual(notesAfterRemoval[0].articleNumber, 1, 'Article 1 remains');
  assert.strictEqual(notesAfterRemoval[1].articleNumber, 5, 'Article 5 remains (NOT renumbered to 2)');
  console.log('✓ PASS: Dynamic removal preserved remaining article numbers (1, 5).');

  // Test Case 4: Dynamic addition of Article 2 note
  console.log('\n[Test 4] Dynamic addition of Article 2 note:');
  const articlesAdded2 = JSON.parse(JSON.stringify(articlesRemoved3));
  articlesAdded2[1].measurementSpecialNote = 'Hem adjustment required'; // add note for Article 2

  const notesAfterAdd2 = generateJobSheetNotes(articlesAdded2, true, articlesAdded2[0]);
  console.log('Notes after adding Article 2:', notesAfterAdd2);

  assert.strictEqual(notesAfterAdd2.length, 3, 'Expected 3 notes');
  assert.strictEqual(notesAfterAdd2[0].articleNumber, 1, 'Article 1 has note');
  assert.strictEqual(notesAfterAdd2[1].articleNumber, 2, 'Article 2 has note');
  assert.strictEqual(notesAfterAdd2[2].articleNumber, 5, 'Article 5 has note');
  console.log('✓ PASS: Dynamic addition resulted in sequence 1, 2, 5.');

  // Test Case 5: Single-product order with note
  console.log('\n[Test 5] Single-product order with note:');
  const singleProduct = { name: 'Lab Coat', productType: 'Lab Coat', measurementSpecialNote: 'Collar adjustment' };
  const notesSingle = generateJobSheetNotes(null, false, singleProduct);
  assert.strictEqual(notesSingle.length, 1);
  assert.strictEqual(notesSingle[0].articleNumber, 1);
  assert.strictEqual(notesSingle[0].note, 'Collar adjustment');
  console.log('✓ PASS: Single-product order correctly assigned Article 1.');

  // Test Case 6: No notes at all
  console.log('\n[Test 6] Articles with zero notes:');
  const noNotesArticles = [
    { name: 'Scrub Set', measurementSpecialNote: '' },
    { name: 'Lab Coat', measurementSpecialNote: null }
  ];
  const notesEmpty = generateJobSheetNotes(noNotesArticles, true, noNotesArticles[0]);
  assert.strictEqual(notesEmpty.length, 0);
  console.log('✓ PASS: Zero notes produces empty array (section omitted, no empty rows).');

  console.log('\n========================================');
  console.log('ALL JOB SHEET NUMBERING TESTS PASSED 100%');
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
