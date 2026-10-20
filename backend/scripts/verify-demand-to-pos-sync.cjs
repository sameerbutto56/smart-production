/**
 * verify-demand-to-pos-sync.cjs
 *
 * Automated verification test suite for Demand-to-POS Inventory product creation,
 * variant mapping, barcode synchronization, and stock movement accuracy.
 *
 * Tests cases A through I from the user specification.
 */

const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();
const { isCategoryGenderApplicable } = require('../src/utils/productConfig');

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

async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING DEMAND-TO-POS INVENTORY VERIFICATION SUITE');
  console.log('===============================================================\n');

  const testSuffix = Date.now().toString(36).toUpperCase();
  const validUser = await prisma.user.findFirst({ where: { role: 'OUTLET' } }) || await prisma.user.findFirst();
  const testUserId = validUser?.id || '938ec42a-414b-4789-b765-043cbfd8df81';
  const testOutlet = 'Johar Town';
  const otherOutlet = 'Jail Road';

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST A: Existing Product in POS Inventory (Case A)
  // When an existing product receives stock, update only the target variant quantity,
  // do not duplicate records, do not change existing barcodes, categories or genders.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- Test A: Existing Product Receiving Stock (Case A) ---');
  const existingMaster = await prisma.inventoryItem.create({
    data: {
      name: `Test Scrub Article A ${testSuffix}`,
      category: 'SCRUBS',
      genderApplicable: true,
      fabric: 'Stretch Poly',
      price: 4500,
      variants: [
        { size: 'M', color: 'Royal Blue', price: 4500, stock: 20, barcode: `WH_A_M_${testSuffix}` },
        { size: 'L', color: 'Royal Blue', price: 4500, stock: 20, barcode: `WH_A_L_${testSuffix}` }
      ]
    }
  });

  // Pre-seed outlet inventory for Article A
  const existingRowM = await prisma.outletInventory.create({
    data: {
      outletName: testOutlet,
      name: existingMaster.name,
      category: 'SCRUBS',
      genderApplicable: true,
      color: 'Royal Blue',
      size: 'M',
      stock: 5,
      price: 4500,
      barcode: `WH_A_M_${testSuffix}`,
      metadata: JSON.stringify({ sourceStoreItemId: existingMaster.id }),
      isActive: true
    }
  });

  const existingRowL = await prisma.outletInventory.create({
    data: {
      outletName: testOutlet,
      name: existingMaster.name,
      category: 'SCRUBS',
      genderApplicable: true,
      color: 'Royal Blue',
      size: 'L',
      stock: 3,
      price: 4500,
      barcode: `WH_A_L_${testSuffix}`,
      metadata: JSON.stringify({ sourceStoreItemId: existingMaster.id }),
      isActive: true
    }
  });

  // Create a Demand delivering 4 units of M and 2 units of L
  const demandA = await prisma.outletDemandRequest.create({
    data: {
      outletId: 'test-outlet-id',
      outletName: testOutlet,
      transferNumber: `TRF-TEST-A-${testSuffix}`,
      status: 'DISPATCHED',
      dispatchedAt: new Date(),
      items: [
        {
          inventoryItemId: existingMaster.id,
          productName: existingMaster.name,
          color: 'Royal Blue',
          size: 'M',
          barcode: `WH_A_M_${testSuffix}`,
          dispatchedQty: 4,
          approvedQty: 4,
          requestedQty: 4
        },
        {
          inventoryItemId: existingMaster.id,
          productName: existingMaster.name,
          color: 'Royal Blue',
          size: 'L',
          barcode: `WH_A_L_${testSuffix}`,
          dispatchedQty: 2,
          approvedQty: 2,
          requestedQty: 2
        }
      ]
    }
  });

  // Call the controller accept simulation
  const { acceptDemandRequest } = require('../src/controllers/outletDemand.controller');
  let acceptResA = null;
  const mockReqA = {
    params: { id: demandA.id },
    user: { id: testUserId, name: 'Tester', role: 'OUTLET' },
    body: {},
    app: { get: () => null }
  };
  const mockResA = {
    status: (code) => ({
      json: (data) => { acceptResA = { code, data }; return data; }
    }),
    json: (data) => { acceptResA = { code: 200, data }; return data; }
  };

  await acceptDemandRequest(mockReqA, mockResA);
  assert(acceptResA.code === 200, 'Demand A accepted successfully');

  // Verify updated stocks
  const updatedRowM = await prisma.outletInventory.findUnique({ where: { id: existingRowM.id } });
  const updatedRowL = await prisma.outletInventory.findUnique({ where: { id: existingRowL.id } });
  assert(updatedRowM.stock === 9, `Size M stock updated from 5 + 4 = 9 (actual: ${updatedRowM.stock})`);
  assert(updatedRowL.stock === 5, `Size L stock updated from 3 + 2 = 5 (actual: ${updatedRowL.stock})`);
  assert(updatedRowM.barcode === `WH_A_M_${testSuffix}`, 'Barcode preserved on Size M');
  assert(updatedRowL.barcode === `WH_A_L_${testSuffix}`, 'Barcode preserved on Size L');

  // Check no duplicate rows created
  const totalRowsA = await prisma.outletInventory.count({
    where: { outletName: testOutlet, name: existingMaster.name }
  });
  assert(totalRowsA === 2, `No duplicate records created (total rows: ${totalRowsA})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST B: Completely New Master Product (Case B)
  // When an article does not exist in POS Inventory, create all required missing
  // size variants using warehouse info, exact warehouse barcodes, category and gender.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test B: Completely New Product Receiving Stock (Case B) ---');
  const newMaster = await prisma.inventoryItem.create({
    data: {
      name: `New Article Men ${testSuffix}`,
      category: 'SCRUBS',
      genderApplicable: true,
      fabric: 'Four-Way Spandex',
      price: 5200,
      variants: [
        { size: 'XS', color: 'Steel Blue', price: 5200, stock: 10, barcode: `WH_B_XS_${testSuffix}` },
        { size: 'S', color: 'Steel Blue', price: 5200, stock: 10, barcode: `WH_B_S_${testSuffix}` },
        { size: 'M', color: 'Steel Blue', price: 5200, stock: 10, barcode: `WH_B_M_${testSuffix}` },
        { size: 'L', color: 'Steel Blue', price: 5200, stock: 10, barcode: `WH_B_L_${testSuffix}` },
        { size: 'XL', color: 'Steel Blue', price: 5200, stock: 10, barcode: `WH_B_XL_${testSuffix}` }
      ]
    }
  });

  // Demand delivers only size M (3 units)
  const demandB = await prisma.outletDemandRequest.create({
    data: {
      outletId: 'test-outlet-id',
      outletName: testOutlet,
      transferNumber: `TRF-TEST-B-${testSuffix}`,
      status: 'DISPATCHED',
      dispatchedAt: new Date(),
      items: [
        {
          inventoryItemId: newMaster.id,
          productName: newMaster.name,
          color: 'Steel Blue',
          size: 'M',
          barcode: `WH_B_M_${testSuffix}`,
          dispatchedQty: 3,
          approvedQty: 3,
          requestedQty: 3
        }
      ]
    }
  });

  let acceptResB = null;
  const mockReqB = {
    params: { id: demandB.id },
    user: { id: testUserId, name: 'Tester', role: 'OUTLET' },
    body: {},
    app: { get: () => null }
  };
  const mockResB = {
    status: (code) => ({
      json: (data) => { acceptResB = { code, data }; return data; }
    }),
    json: (data) => { acceptResB = { code: 200, data }; return data; }
  };

  await acceptDemandRequest(mockReqB, mockResB);
  assert(acceptResB.code === 200, 'Demand B accepted successfully');

  // Verify that all 5 size variants exist at the outlet
  const outletVariantsB = await prisma.outletInventory.findMany({
    where: { outletName: testOutlet, name: newMaster.name }
  });
  assert(outletVariantsB.length === 5, `All 5 size variants created at outlet (actual: ${outletVariantsB.length})`);

  // Target size M must have stock 3, others must have stock 0
  const rowBM = outletVariantsB.find(r => r.size === 'M');
  const rowBXS = outletVariantsB.find(r => r.size === 'XS');
  const rowBL = outletVariantsB.find(r => r.size === 'L');
  assert(rowBM && rowBM.stock === 3, `Received size M has stock 3 (actual: ${rowBM?.stock})`);
  assert(rowBXS && rowBXS.stock === 0, `Unreceived size XS has stock 0 (actual: ${rowBXS?.stock})`);
  assert(rowBL && rowBL.stock === 0, `Unreceived size L has stock 0 (actual: ${rowBL?.stock})`);

  // Verify exact warehouse barcodes
  assert(rowBM.barcode === `WH_B_M_${testSuffix}`, `Size M has exact warehouse barcode (actual: ${rowBM.barcode})`);
  assert(rowBXS.barcode === `WH_B_XS_${testSuffix}`, `Size XS has exact warehouse barcode (actual: ${rowBXS.barcode})`);
  assert(rowBL.barcode === `WH_B_L_${testSuffix}`, `Size L has exact warehouse barcode (actual: ${rowBL.barcode})`);

  // Verify category and gender
  assert(rowBM.category === 'SCRUBS', `Category is SCRUBS (actual: ${rowBM.category})`);
  assert(rowBM.genderApplicable === true, 'genderApplicable is true for SCRUBS');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST D: Men's and Women's Articles in the Same Demand
  // Both articles must remain strictly isolated without cross-contamination.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test D: Men's and Women's Products Isolation ---");
  const menMaster = await prisma.inventoryItem.create({
    data: {
      name: `Apollo Scrub Men ${testSuffix}`,
      category: 'SCRUBS',
      genderApplicable: true,
      price: 5000,
      variants: [
        { size: 'M', color: 'Navy', price: 5000, stock: 15, barcode: `WH_APOLLO_M_M_${testSuffix}` },
        { size: 'L', color: 'Navy', price: 5000, stock: 15, barcode: `WH_APOLLO_M_L_${testSuffix}` }
      ]
    }
  });

  const womenMaster = await prisma.inventoryItem.create({
    data: {
      name: `Athena Scrub Women ${testSuffix}`,
      category: 'SCRUBS',
      genderApplicable: true,
      price: 5000,
      variants: [
        { size: 'M', color: 'Navy', price: 5000, stock: 15, barcode: `WH_ATHENA_W_M_${testSuffix}` },
        { size: 'L', color: 'Navy', price: 5000, stock: 15, barcode: `WH_ATHENA_W_L_${testSuffix}` }
      ]
    }
  });

  const demandD = await prisma.outletDemandRequest.create({
    data: {
      outletId: 'test-outlet-id',
      outletName: testOutlet,
      transferNumber: `TRF-TEST-D-${testSuffix}`,
      status: 'DISPATCHED',
      dispatchedAt: new Date(),
      items: [
        {
          inventoryItemId: menMaster.id,
          productName: menMaster.name,
          color: 'Navy',
          size: 'M',
          barcode: `WH_APOLLO_M_M_${testSuffix}`,
          dispatchedQty: 4,
          approvedQty: 4,
          requestedQty: 4
        },
        {
          inventoryItemId: womenMaster.id,
          productName: womenMaster.name,
          color: 'Navy',
          size: 'L',
          barcode: `WH_ATHENA_W_L_${testSuffix}`,
          dispatchedQty: 7,
          approvedQty: 7,
          requestedQty: 7
        }
      ]
    }
  });

  let acceptResD = null;
  const mockReqD = {
    params: { id: demandD.id },
    user: { id: testUserId, name: 'Tester', role: 'OUTLET' },
    body: {},
    app: { get: () => null }
  };
  const mockResD = {
    status: (code) => ({
      json: (data) => { acceptResD = { code, data }; return data; }
    }),
    json: (data) => { acceptResD = { code: 200, data }; return data; }
  };

  await acceptDemandRequest(mockReqD, mockResD);
  assert(acceptResD.code === 200, 'Demand D accepted successfully');

  // Verify Men's product
  const menRowM = await prisma.outletInventory.findFirst({
    where: { outletName: testOutlet, name: menMaster.name, size: 'M' }
  });
  const menRowL = await prisma.outletInventory.findFirst({
    where: { outletName: testOutlet, name: menMaster.name, size: 'L' }
  });
  assert(menRowM && menRowM.stock === 4, `Men's M stock is exactly 4 (actual: ${menRowM?.stock})`);
  assert(menRowL && menRowL.stock === 0, `Men's L stock is 0 (actual: ${menRowL?.stock})`);
  assert(menRowM.barcode === `WH_APOLLO_M_M_${testSuffix}`, "Men's M has correct barcode");

  // Verify Women's product
  const womenRowM = await prisma.outletInventory.findFirst({
    where: { outletName: testOutlet, name: womenMaster.name, size: 'M' }
  });
  const womenRowL = await prisma.outletInventory.findFirst({
    where: { outletName: testOutlet, name: womenMaster.name, size: 'L' }
  });
  assert(womenRowL && womenRowL.stock === 7, `Women's L stock is exactly 7 (actual: ${womenRowL?.stock})`);
  assert(womenRowM && womenRowM.stock === 0, `Women's M stock is 0 (actual: ${womenRowM?.stock})`);
  assert(womenRowL.barcode === `WH_ATHENA_W_L_${testSuffix}`, "Women's L has correct barcode");

  // Verify complete separation
  assert(menRowM.name.includes('Men') && !menRowM.name.includes('Women'), "Men's record name preserved");
  assert(womenRowL.name.includes('Women') && !womenRowL.name.includes('Men'), "Women's record name preserved");

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST E: Barcode Accuracy & Scanning Verification
  // Scanning each received warehouse barcode must find the exact article and size.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test E: Barcode Accuracy & POS Scanning ---');
  const scannedMenM = await prisma.outletInventory.findFirst({
    where: { outletName: testOutlet, barcode: `WH_APOLLO_M_M_${testSuffix}` }
  });
  assert(scannedMenM && scannedMenM.name === menMaster.name && scannedMenM.size === 'M', 'Barcode scanner finds exact Men M variant');

  const scannedWomenL = await prisma.outletInventory.findFirst({
    where: { outletName: testOutlet, barcode: `WH_ATHENA_W_L_${testSuffix}` }
  });
  assert(scannedWomenL && scannedWomenL.name === womenMaster.name && scannedWomenL.size === 'L', 'Barcode scanner finds exact Women L variant');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST F: Quantity Accuracy & Partial Deliveries
  // Final outlet stock = Previous outlet stock + Actual received quantity.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test F: Quantity Accuracy & Partial Delivery ---');
  // Send partial delivery for Men's article: dispatched 5, but outlet accepts only 3
  const demandF = await prisma.outletDemandRequest.create({
    data: {
      outletId: 'test-outlet-id',
      outletName: testOutlet,
      transferNumber: `TRF-TEST-F-${testSuffix}`,
      status: 'DISPATCHED',
      dispatchedAt: new Date(),
      items: [
        {
          inventoryItemId: menMaster.id,
          productName: menMaster.name,
          color: 'Navy',
          size: 'M',
          barcode: `WH_APOLLO_M_M_${testSuffix}`,
          dispatchedQty: 5,
          approvedQty: 5,
          requestedQty: 5
        }
      ]
    }
  });

  let acceptResF = null;
  const mockReqF = {
    params: { id: demandF.id },
    user: { id: testUserId, name: 'Tester', role: 'OUTLET' },
    body: {
      items: [
        {
          inventoryItemId: menMaster.id,
          productName: menMaster.name,
          color: 'Navy',
          size: 'M',
          acceptedQty: 3 // Partial acceptance: 3 out of 5
        }
      ]
    },
    app: { get: () => null }
  };
  const mockResF = {
    status: (code) => ({
      json: (data) => { acceptResF = { code, data }; return data; }
    }),
    json: (data) => { acceptResF = { code: 200, data }; return data; }
  };

  await acceptDemandRequest(mockReqF, mockResF);
  assert(acceptResF.code === 200, 'Partial Demand F accepted');

  const menRowMAfterPartial = await prisma.outletInventory.findUnique({ where: { id: menRowM.id } });
  // Previous stock was 4, accepted 3 -> must be exactly 7
  assert(menRowMAfterPartial.stock === 7, `Stock accurately incremented by accepted qty: 4 + 3 = 7 (actual: ${menRowMAfterPartial.stock})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST G: Idempotency & Duplicate Prevention
  // Retrying an already completed demand acceptance must return HTTP 409 and not duplicate.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test G: Idempotency & Duplicate Prevention ---');
  let acceptResG = null;
  const mockResG = {
    status: (code) => ({
      json: (data) => { acceptResG = { code, data }; return data; }
    }),
    json: (data) => { acceptResG = { code: 200, data }; return data; }
  };

  await acceptDemandRequest(mockReqF, mockResG);
  assert(acceptResG.code === 409, `Duplicate acceptance rejected with HTTP 409 (actual: ${acceptResG.code})`);

  const menRowMAfterRetry = await prisma.outletInventory.findUnique({ where: { id: menRowM.id } });
  assert(menRowMAfterRetry.stock === 7, `Stock was NOT duplicated on retry (remains ${menRowMAfterRetry.stock})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST H: Multiple Outlets Independence
  // Receiving stock at Johar Town must not affect Jail Road.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test H: Multiple Outlets Independence ---');
  const jailStockBefore = await prisma.outletInventory.findFirst({
    where: { outletName: otherOutlet, name: menMaster.name, size: 'M' }
  });
  assert(jailStockBefore === null, 'Product does not exist at Jail Road yet');

  // Deliver 8 units of Men M to Jail Road
  const demandH = await prisma.outletDemandRequest.create({
    data: {
      outletId: 'test-outlet-id-jail',
      outletName: otherOutlet,
      transferNumber: `TRF-TEST-H-${testSuffix}`,
      status: 'DISPATCHED',
      dispatchedAt: new Date(),
      items: [
        {
          inventoryItemId: menMaster.id,
          productName: menMaster.name,
          color: 'Navy',
          size: 'M',
          barcode: `WH_APOLLO_M_M_${testSuffix}`,
          dispatchedQty: 8,
          approvedQty: 8,
          requestedQty: 8
        }
      ]
    }
  });

  let acceptResH = null;
  const mockReqH = {
    params: { id: demandH.id },
    user: { id: testUserId, name: 'Tester', role: 'OUTLET' },
    body: {},
    app: { get: () => null }
  };
  const mockResH = {
    status: (code) => ({
      json: (data) => { acceptResH = { code, data }; return data; }
    }),
    json: (data) => { acceptResH = { code: 200, data }; return data; }
  };

  await acceptDemandRequest(mockReqH, mockResH);
  assert(acceptResH.code === 200, 'Demand H accepted at Jail Road');

  const jailStockAfter = await prisma.outletInventory.findFirst({
    where: { outletName: otherOutlet, name: menMaster.name, size: 'M' }
  });
  const joharStockAfter = await prisma.outletInventory.findUnique({ where: { id: menRowM.id } });

  assert(jailStockAfter && jailStockAfter.stock === 8, `Jail Road has independent stock 8 (actual: ${jailStockAfter?.stock})`);
  assert(joharStockAfter && joharStockAfter.stock === 7, `Johar Town stock remained unchanged at 7 (actual: ${joharStockAfter?.stock})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST I: POS Inventory & Products Visibility
  // Newly received products must be immediately returned by getPosInventory and getProducts.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test I: POS Inventory & Products Visibility ---');
  const { getProducts, getPosInventory } = require('../src/controllers/pos.controller');

  let posProductsRes = null;
  const mockReqPOS = {
    user: { role: 'OUTLET', name: testOutlet },
    query: { outlet: testOutlet, skipCache: 'true' }
  };
  const mockResPOS = {
    status: (code) => ({
      json: (data) => { posProductsRes = { code, data }; return data; }
    }),
    json: (data) => { posProductsRes = { code: 200, data }; return data; }
  };

  await getProducts(mockReqPOS, mockResPOS);
  assert(posProductsRes.code === 200, 'getProducts returned HTTP 200');

  const posItems = posProductsRes.data;
  const foundMenInPOS = posItems.find(p => p.name === menMaster.name);
  const foundWomenInPOS = posItems.find(p => p.name === womenMaster.name);
  assert(foundMenInPOS != null, "Men's article immediately visible in POS products");
  assert(foundWomenInPOS != null, "Women's article immediately visible in POS products");
  assert(foundMenInPOS.genderApplicable === true, 'genderApplicable is true on POS product payload');

  let posInvRes = null;
  const mockResInv = {
    status: (code) => ({
      json: (data) => { posInvRes = { code, data }; return data; }
    }),
    json: (data) => { posInvRes = { code: 200, data }; return data; }
  };

  await getPosInventory(mockReqPOS, mockResInv);
  assert(posInvRes.code === 200, 'getPosInventory returned HTTP 200');
  const invItems = posInvRes.data;
  const foundMenInv = invItems.find(i => i.name === menMaster.name && i.size === 'M');
  assert(foundMenInv && foundMenInv.stock === 7, `POS inventory displays correct stock 7 (actual: ${foundMenInv?.stock})`);

  // Clean up test data
  await prisma.outletInventory.deleteMany({
    where: {
      name: { in: [existingMaster.name, newMaster.name, menMaster.name, womenMaster.name] }
    }
  });
  await prisma.inventoryMovementLog.deleteMany({
    where: {
      referenceId: { in: [`TRF-TEST-A-${testSuffix}`, `TRF-TEST-B-${testSuffix}`, `TRF-TEST-D-${testSuffix}`, `TRF-TEST-F-${testSuffix}`, `TRF-TEST-H-${testSuffix}`] }
    }
  });
  await prisma.outletDemandRequest.deleteMany({
    where: {
      transferNumber: { in: [`TRF-TEST-A-${testSuffix}`, `TRF-TEST-B-${testSuffix}`, `TRF-TEST-D-${testSuffix}`, `TRF-TEST-F-${testSuffix}`, `TRF-TEST-H-${testSuffix}`] }
    }
  });
  await prisma.inventoryItem.deleteMany({
    where: {
      id: { in: [existingMaster.id, newMaster.id, menMaster.id, womenMaster.id] }
    }
  });

  console.log('\n===============================================================');
  console.log(`ALL VERIFICATION TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log('===============================================================');
}

runTests()
  .catch(err => {
    console.error('\nVerification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
