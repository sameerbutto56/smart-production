/**
 * Comprehensive Automated Verification Suite for:
 * Admin Profile -> Product Data: Inventory Stock Report
 */

const { getInventoryStockReport, getProductDataSummary } = require('../src/controllers/productData.controller');
const prisma = require('../src/prisma');

async function run() {
  console.log('================================================================');
  console.log('STARTING INVENTORY STOCK REPORT VERIFICATION');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`✅ PASS: ${message}`);
      passed++;
    }
  }

  // 1. All Locations query
  console.log('\n--- Test 1: Combined All Locations Calculation ---');
  let resAll = null;
  await getInventoryStockReport({ query: { location: 'All Locations', preset: 'today' } }, {
    json(d) { resAll = d; },
    status() { return this; }
  });

  assert(resAll && resAll.summary, 'All Locations response returned summary');
  assert(resAll.summary.totalStock > 0, `Total stock calculated: ${resAll.summary.totalStock}`);
  assert(resAll.summary.totalVariants > 0, `Total variants calculated: ${resAll.summary.totalVariants}`);
  assert(
    resAll.summary.totalStock === (resAll.summary.warehouseStock + resAll.summary.outletStock),
    `Total stock (${resAll.summary.totalStock}) equals Warehouse (${resAll.summary.warehouseStock}) + Outlets (${resAll.summary.outletStock})`
  );

  // 2. Acceptance Test 1: Warehouse Stock isolation
  console.log('\n--- Test 2: Warehouse Stock Isolation ---');
  let resWh = null;
  await getInventoryStockReport({ query: { location: 'Warehouse', preset: 'today' } }, {
    json(d) { resWh = d; },
    status() { return this; }
  });

  assert(resWh && resWh.summary, 'Warehouse response returned summary');
  assert(
    resWh.summary.totalStock === resAll.summary.warehouseStock,
    `Warehouse scope totalStock (${resWh.summary.totalStock}) strictly equals warehouseStock (${resAll.summary.warehouseStock})`
  );
  assert(resWh.summary.outletStock === 0, 'Warehouse scope has 0 outlet stock');

  // 3. Acceptance Test 2: Individual Outlet isolation
  console.log('\n--- Test 3: Individual Outlet Isolation ---');
  const configuredOutlets = resAll.configuredOutlets || [];
  assert(configuredOutlets.length > 0, `Configured outlets found: ${configuredOutlets.join(', ')}`);

  const testOutlet = configuredOutlets[0]; // e.g. Johar Town
  let resOutlet = null;
  await getInventoryStockReport({ query: { location: testOutlet, preset: 'today' } }, {
    json(d) { resOutlet = d; },
    status() { return this; }
  });

  assert(resOutlet && resOutlet.summary, `${testOutlet} response returned summary`);
  assert(resOutlet.summary.totalStock > 0, `${testOutlet} stock is positive: ${resOutlet.summary.totalStock}`);
  assert(
    resOutlet.summary.totalStock === resOutlet.summary.outletStock,
    `${testOutlet} totalStock (${resOutlet.summary.totalStock}) equals outletStock (${resOutlet.summary.outletStock})`
  );

  // 4. Acceptance Test 4: Category totals match underlying products
  console.log('\n--- Test 4: Category Totals Match Product Ledger ---');
  const catTotalSum = resAll.categoriesBreakdown.reduce((s, c) => s + c.totalStock, 0);
  assert(
    catTotalSum === resAll.summary.totalStock,
    `Category totals sum (${catTotalSum}) strictly equals summary totalStock (${resAll.summary.totalStock})`
  );
  assert(resAll.categoriesBreakdown.length > 0, `Total categories found: ${resAll.categoriesBreakdown.length}`);

  // 5. Acceptance Test 5 & 6: Product search & Variant distinction
  console.log('\n--- Test 5: Search & Variant Distinction ---');
  let resSearch = null;
  await getInventoryStockReport({ query: { location: 'All Locations', search: 'Velora', preset: 'today' } }, {
    json(d) { resSearch = d; },
    status() { return this; }
  });

  assert(resSearch.variants.length > 0, `Search for 'Velora' returned ${resSearch.variants.length} variant rows`);
  const distinctSizes = new Set(resSearch.variants.map(v => v.size));
  const distinctColors = new Set(resSearch.variants.map(v => v.color));
  assert(distinctSizes.size > 1, `Multiple sizes distinguished: ${Array.from(distinctSizes).join(', ')}`);
  assert(distinctColors.size >= 1, `Colors distinguished: ${Array.from(distinctColors).join(', ')}`);

  // Verify location breakdown presence
  const sampleVariant = resSearch.variants[0];
  assert(Array.isArray(sampleVariant.locationBreakdown), 'Variant contains locationBreakdown array');
  assert(sampleVariant.locationBreakdown.length >= 2, `Location breakdown covers locations: ${sampleVariant.locationBreakdown.map(l => l.location).join(', ')}`);

  // 6. Acceptance Test 10: Zero Stock visibility
  console.log('\n--- Test 6: Zero Stock Product Visibility ---');
  let resZero = null;
  await getInventoryStockReport({ query: { location: 'All Locations', status: 'out_of_stock', preset: 'today' } }, {
    json(d) { resZero = d; },
    status() { return this; }
  });

  assert(resZero.variants.length > 0, `Out of stock filter returned ${resZero.variants.length} items`);
  const allZero = resZero.variants.every(v => v.physicalStock === 0);
  assert(allZero, 'All items in out_of_stock filter have physicalStock === 0');

  // 7. Acceptance Test 11: Export Data Agreement
  console.log('\n--- Test 7: Export Dataset Fullness & Agreement ---');
  let resExport = null;
  await getInventoryStockReport({ query: { location: 'All Locations', limit: 'all', preset: 'today' } }, {
    json(d) { resExport = d; },
    status() { return this; }
  });

  assert(resExport.variants.length === resAll.pagination.total, `Export all returned all ${resExport.variants.length} variants without truncation`);
  const exportStockSum = resExport.variants.reduce((s, v) => s + v.physicalStock, 0);
  assert(exportStockSum === resAll.summary.totalStock, `Export physical stock sum (${exportStockSum}) strictly matches summary (${resAll.summary.totalStock})`);

  // 8. Acceptance Test 12: Existing Product Data Summary Unchanged
  console.log('\n--- Test 8: Existing Product Data Summary Compatibility ---');
  let resSummary = null;
  await getProductDataSummary({ query: { outlet: 'All Outlets', preset: 'today' } }, {
    json(d) { resSummary = d; },
    status() { return this; }
  });

  assert(resSummary && resSummary.summary, 'Existing getProductDataSummary returns valid summary');
  assert(Array.isArray(resSummary.productSales), 'Existing productSales array is preserved and functional');
  assert(Array.isArray(resSummary.employeeBreakdown), 'Existing employeeBreakdown is preserved and functional');

  console.log('\n================================================================');
  console.log(`ALL TESTS PASSED: ${passed}/${passed + failed} CHECKS SUCCESSFUL`);
  console.log('================================================================');
}

run()
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
