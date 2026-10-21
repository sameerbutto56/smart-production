const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/prisma');

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING COMPREHENSIVE BARCODE & DEMAND POS TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // Test 1: Global Barcode Uniqueness in InventoryItem
    // ----------------------------------------------------
    console.log('Test Group 1: Master Barcode Global Uniqueness');
    const masterItems = await prisma.inventoryItem.findMany({
      where: { isActive: { not: false } },
      select: { id: true, name: true, category: true, genderApplicable: true, variants: true }
    });

    const barcodeMap = new Map();
    for (const item of masterItems) {
      const vars = Array.isArray(item.variants) ? item.variants : [];
      for (const v of vars) {
        if (!v || !v.barcode) continue;
        const bc = String(v.barcode).trim().toUpperCase();
        if (!barcodeMap.has(bc)) barcodeMap.set(bc, []);
        barcodeMap.get(bc).push({ itemId: item.id, name: item.name, size: v.size, color: v.color });
      }
    }

    const duplicates = [];
    for (const [bc, list] of barcodeMap.entries()) {
      if (list.length > 1) duplicates.push({ bc, list });
    }

    assert(duplicates.length === 0, 'Zero duplicate barcodes exist across all active InventoryItem variants',
      `Found ${duplicates.length} duplicates: ${JSON.stringify(duplicates)}`);
    assert(barcodeMap.size > 100, `Registered ${barcodeMap.size} unique master barcodes (> 100)`);

    // ----------------------------------------------------
    // Test 2: Gender & Article Barcode Disambiguation
    // ----------------------------------------------------
    console.log('\nTest Group 2: Gender and Article Barcode Disambiguation');
    
    // Check Sprinter Women New vs Sprinter Men New vs Sprinter Navy Collar-Men
    const womenNew = masterItems.find(m => m.name.trim() === 'Sprinter Women New');
    const menNew = masterItems.find(m => m.name.trim() === 'Sprinter Men New');
    const navyCollarMen = masterItems.find(m => m.name.trim() === 'Sprinter Navy Collar-Men');
    const espressoWomen = masterItems.find(m => m.name.trim() === 'Sprinter Espresso Strike Wide Leg- Women');
    const espressoMen = masterItems.find(m => m.name.trim() === 'Sprinter Espresso Strike Men');

    assert(Boolean(womenNew && menNew && navyCollarMen), 'Target Men and Women master products exist');

    if (womenNew && menNew && navyCollarMen) {
      const womenBarcodes = new Set((womenNew.variants || []).map(v => String(v.barcode).trim().toUpperCase()));
      const menBarcodes = new Set((menNew.variants || []).map(v => String(v.barcode).trim().toUpperCase()));
      const navyMenBarcodes = new Set((navyCollarMen.variants || []).map(v => String(v.barcode).trim().toUpperCase()));

      let womenMenOverlap = 0;
      for (const bc of womenBarcodes) {
        if (menBarcodes.has(bc)) womenMenOverlap++;
      }
      assert(womenMenOverlap === 0, 'Sprinter Women New and Sprinter Men New have 0 shared barcodes', `Overlap: ${womenMenOverlap}`);

      let womenNavyOverlap = 0;
      for (const bc of womenBarcodes) {
        if (navyMenBarcodes.has(bc)) womenNavyOverlap++;
      }
      assert(womenNavyOverlap === 0, 'Sprinter Women New and Sprinter Navy Collar-Men have 0 shared barcodes', `Overlap: ${womenNavyOverlap}`);
    }

    if (espressoWomen && espressoMen) {
      const ewBarcodes = new Set((espressoWomen.variants || []).map(v => String(v.barcode).trim().toUpperCase()));
      const emBarcodes = new Set((espressoMen.variants || []).map(v => String(v.barcode).trim().toUpperCase()));
      let espressoOverlap = 0;
      for (const bc of ewBarcodes) {
        if (emBarcodes.has(bc)) espressoOverlap++;
      }
      assert(espressoOverlap === 0, 'Sprinter Espresso Strike Women and Men have 0 shared barcodes', `Overlap: ${espressoOverlap}`);
    }

    // ----------------------------------------------------
    // Test 3: Outlet Inventory Barcode Alignment & Cleanliness
    // ----------------------------------------------------
    console.log('\nTest Group 3: Outlet Inventory Barcode Parity and Cleanliness');

    const activeOutletRows = await prisma.outletInventory.findMany({
      where: { isActive: { not: false } },
      select: { id: true, barcode: true, name: true, outletName: true }
    });

    const suffixedActiveRows = activeOutletRows.filter(r => {
      const bc = String(r.barcode || '').trim();
      return bc.endsWith('_JR') || bc.endsWith('_JT') || bc.includes('_JR_') || bc.includes('_JT_') || bc.includes('_archived');
    });

    assert(suffixedActiveRows.length === 0, 'Zero active OutletInventory rows have _JR, _JT or _archived suffixes',
      `Found ${suffixedActiveRows.length} suffixed active rows: ${suffixedActiveRows.map(r => r.barcode).join(', ')}`);

    // Verify Sprinter Women New in Johar Town and Jail Road
    const womenOutletRows = await prisma.outletInventory.findMany({
      where: { name: 'Sprinter Women New', isActive: { not: false } }
    });

    const womenMasterVariants = Array.isArray(womenNew?.variants) ? womenNew.variants : [];
    const jtRows = womenOutletRows.filter(r => r.outletName === 'Johar Town');
    const jrRows = womenOutletRows.filter(r => r.outletName === 'Jail Road');

    assert(jtRows.length >= womenMasterVariants.length, `Johar Town has all ${womenMasterVariants.length} variants for Sprinter Women New (found ${jtRows.length})`);
    assert(jrRows.length >= womenMasterVariants.length, `Jail Road has all ${womenMasterVariants.length} variants for Sprinter Women New (found ${jrRows.length})`);

    let barcodeMismatches = 0;
    for (const row of womenOutletRows) {
      const mv = womenMasterVariants.find(v => 
        String(v.size || '').trim().toLowerCase() === String(row.size || '').trim().toLowerCase() &&
        String(v.color || '').trim().toLowerCase() === String(row.color || '').trim().toLowerCase()
      );
      if (mv && String(mv.barcode).trim().toUpperCase() !== String(row.barcode).trim().toUpperCase()) {
        barcodeMismatches++;
      }
    }
    assert(barcodeMismatches === 0, 'All OutletInventory rows for Sprinter Women New match warehouse master barcodes exactly',
      `Found ${barcodeMismatches} mismatches`);

    // ----------------------------------------------------
    // Test 4: Barcode Lookup Fast Indexed Performance
    // ----------------------------------------------------
    console.log('\nTest Group 4: Barcode Lookup Performance');

    if (womenMasterVariants.length > 0) {
      const sampleBarcode = womenMasterVariants[0].barcode;
      // Warm up connection
      await prisma.outletInventory.findFirst({
        where: { barcode: sampleBarcode, outletName: 'Johar Town' }
      });

      const t0 = performance.now();
      const lookedUp = await prisma.outletInventory.findFirst({
        where: { barcode: sampleBarcode, outletName: 'Johar Town' }
      });
      const t1 = performance.now();
      const elapsed = t1 - t0;

      assert(Boolean(lookedUp), `Lookup for sample barcode [${sampleBarcode}] succeeded`);
      assert(lookedUp?.name === 'Sprinter Women New', `Looked up row matches Sprinter Women New (found: ${lookedUp?.name})`);
      assert(elapsed < 600, `Indexed barcode query execution time over network is within limit: ${elapsed.toFixed(2)}ms (< 600ms)`);
    }

    // ----------------------------------------------------
    // Test 5: Demand Acceptance Barcode Sync Simulation
    // ----------------------------------------------------
    console.log('\nTest Group 5: Demand Acceptance Barcode Synchronization Logic');

    // Verify that for any item receiving demand, if master has a barcode, outlet row inherits the master barcode
    const navyMasterVariant = womenMasterVariants.find(v => v.color === 'Navy' && v.size === 'S');
    if (navyMasterVariant) {
      const jrNavyS = await prisma.outletInventory.findFirst({
        where: { outletName: 'Jail Road', name: 'Sprinter Women New', color: 'Navy', size: 'S' }
      });
      assert(jrNavyS?.barcode === navyMasterVariant.barcode, `Jail Road Navy S has master barcode ${navyMasterVariant.barcode} (found: ${jrNavyS?.barcode})`);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
