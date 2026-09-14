const prisma = require('../src/prisma');
const { acceptTransfer } = require('../src/controllers/transfer.controller');
const { mergeOutletDuplicates, detectOutletDuplicates } = require('../src/controllers/pos.controller');
const { mergeWarehouseDuplicates, detectWarehouseDuplicates } = require('../src/controllers/warehouse.controller');

// Mock express response
function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('=== RUNNING TESTS FOR INVENTORY TRANSFER FIX & DUPLICATE MERGE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const createdOutletInventoryIds = [];
  const createdInventoryItemIds = [];
  const createdTransferIds = [];

  const adminUser = { id: 'admin-test-user', name: 'Admin', role: 'ADMIN' };

  try {
    // -------------------------------------------------------------
    // TEST 1: OUTLET_WAREHOUSE Transfer Acceptance & Stock Consolidation
    // -------------------------------------------------------------
    console.log('--- 1. Testing OUTLET_WAREHOUSE Transfer Acceptance ---');

    // Create a canonical Warehouse InventoryItem
    const whItem = await prisma.inventoryItem.create({
      data: {
        name: 'TEST-TRANSFER-SHIRT-' + Date.now(),
        category: 'Apparel',
        stock: 10,
        price: 2500,
        variants: JSON.stringify([
          { color: 'Black', size: 'M', stock: 5, price: 2500 },
          { color: 'Black', size: 'L', stock: 5, price: 2500 }
        ])
      }
    });
    createdInventoryItemIds.push(whItem.id);

    // Create a transfer from Johar Town to Warehouse for 3 units of Black M
    const transfer1 = await prisma.outletTransfer.create({
      data: {
        transferNumber: 'TRF-TEST-' + Date.now(),
        type: 'OUTLET_WAREHOUSE',
        fromOutlet: 'Johar Town',
        toOutlet: 'Warehouse',
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        items: {
          create: [
            {
              barcode: 'TRF-BC-1',
              productName: whItem.name,
              color: 'Black',
              size: 'M',
              quantity: 3,
              unitPrice: 2500
            }
          ]
        }
      },
      include: { items: true }
    });
    createdTransferIds.push(transfer1.id);

    // Accept the transfer
    const req1 = {
      params: { id: transfer1.id },
      user: adminUser
    };
    const res1 = createMockRes();
    await acceptTransfer(req1, res1);

    assert(res1.statusCode === 200, `Transfer accepted with HTTP 200 (got ${res1.statusCode})`);

    // Verify whItem stock
    const updatedWhItem = await prisma.inventoryItem.findUnique({ where: { id: whItem.id } });
    const rawWhVars = updatedWhItem.variants;
    const updatedVariants = typeof rawWhVars === 'string' ? JSON.parse(rawWhVars) : rawWhVars;
    const blackM = updatedVariants.find(v => v.color.toLowerCase() === 'black' && v.size.toLowerCase() === 'm');

    assert(blackM.stock === 8, `Variant Black M stock incremented from 5 to 8 (got ${blackM?.stock})`);
    assert(updatedWhItem.stock === 13, `Total InventoryItem stock incremented from 10 to 13 (got ${updatedWhItem.stock})`);

    // Verify no new InventoryItem duplicate was created
    const countWhItems = await prisma.inventoryItem.count({ where: { name: whItem.name } });
    assert(countWhItems === 1, `Exactly 1 InventoryItem exists for name (no duplicates created: got ${countWhItems})`);

    // -------------------------------------------------------------
    // TEST 2: Idempotency Guard on acceptTransfer
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing acceptTransfer Idempotency Guard ---');
    const res2 = createMockRes();
    await acceptTransfer(req1, res2);
    assert(res2.statusCode === 400, `Second acceptTransfer blocked with HTTP 400 (got ${res2.statusCode})`);
    assert(res2.data?.message?.includes('DISPATCHED') || res2.data?.message?.includes('already'), `Returns appropriate error message (got "${res2.data?.message}")`);

    // -------------------------------------------------------------
    // TEST 3: OUTLET_OUTLET Transfer Acceptance & Stock Consolidation
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing OUTLET_OUTLET Transfer Acceptance ---');

    // Create target OutletInventory in Jail Road
    const targetOutletItem = await prisma.outletInventory.create({
      data: {
        outletName: 'Jail Road',
        name: 'TEST-OUTLET-KURTA-' + Date.now(),
        color: 'Navy Blue',
        size: 'Large',
        stock: 4,
        price: 3200,
        category: 'Kurtas'
      }
    });
    createdOutletInventoryIds.push(targetOutletItem.id);

    // Create transfer from Johar Town to Jail Road
    const transfer3 = await prisma.outletTransfer.create({
      data: {
        transferNumber: 'TRF-OO-' + Date.now(),
        type: 'OUTLET_OUTLET',
        fromOutlet: 'Johar Town',
        toOutlet: 'Jail Road',
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        items: {
          create: [
            {
              barcode: 'TRF-BC-2',
              productName: targetOutletItem.name,
              color: 'navy blue', // test case-insensitive match
              size: 'LARGE',      // test case-insensitive match
              quantity: 5,
              unitPrice: 3200
            }
          ]
        }
      },
      include: { items: true }
    });
    createdTransferIds.push(transfer3.id);

    const req3 = {
      params: { id: transfer3.id },
      user: adminUser
    };
    const res3 = createMockRes();
    await acceptTransfer(req3, res3);

    assert(res3.statusCode === 200, `OUTLET_OUTLET transfer accepted with HTTP 200 (got ${res3.statusCode})`);

    const updatedTargetOutletItem = await prisma.outletInventory.findUnique({ where: { id: targetOutletItem.id } });
    assert(updatedTargetOutletItem.stock === 9, `Target OutletInventory stock incremented from 4 to 9 (got ${updatedTargetOutletItem.stock})`);

    const totalMatchingPos = await prisma.outletInventory.count({
      where: {
        outletName: 'Jail Road',
        name: targetOutletItem.name
      }
    });
    assert(totalMatchingPos === 1, `Exactly 1 OutletInventory item exists in Jail Road (no duplicate created: got ${totalMatchingPos})`);

    // -------------------------------------------------------------
    // TEST 4: mergeOutletDuplicates (POS Outlet inventory)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing mergeOutletDuplicates ---');

    const duplicateOutletName = 'Abbottabad';
    const dupProdName = 'TEST-DUP-SUIT-' + Date.now();

    // Create canonical item
    const primaryOutletItem = await prisma.outletInventory.create({
      data: {
        outletName: duplicateOutletName,
        name: dupProdName,
        color: 'Maroon',
        size: 'XL',
        stock: 5,
        price: 4500,
        category: 'Suits'
      }
    });
    createdOutletInventoryIds.push(primaryOutletItem.id);

    // Create duplicate item
    const secondaryOutletItem = await prisma.outletInventory.create({
      data: {
        outletName: duplicateOutletName,
        name: dupProdName,
        color: 'maroon', // lowercase variation
        size: 'xl',      // lowercase variation
        stock: 7,
        price: 4500,
        category: 'Suits'
      }
    });
    createdOutletInventoryIds.push(secondaryOutletItem.id);

    // Detect duplicates endpoint
    const detectReq = { query: { outletName: duplicateOutletName } };
    const detectRes = createMockRes();
    await detectOutletDuplicates(detectReq, detectRes);
    assert(detectRes.statusCode === 200, `detectOutletDuplicates returns HTTP 200`);
    assert(detectRes.data?.duplicateGroups >= 1, `detectOutletDuplicates detects at least 1 duplicate group (got ${detectRes.data?.duplicateGroups})`);

    // Execute merge
    const mergeReq = {
      body: { outletName: duplicateOutletName },
      user: adminUser
    };
    const mergeRes = createMockRes();
    await mergeOutletDuplicates(mergeReq, mergeRes);
    assert(mergeRes.statusCode === 200, `mergeOutletDuplicates returns HTTP 200 (got ${mergeRes.statusCode})`);
    assert(mergeRes.data?.mergedGroups >= 1, `Merged at least 1 group (got ${mergeRes.data?.mergedGroups})`);

    // Check surviving item
    const survivingItems = await prisma.outletInventory.findMany({
      where: { outletName: duplicateOutletName, name: dupProdName }
    });
    assert(survivingItems.length === 1, `Duplicate OutletInventory rows consolidated into 1 (got ${survivingItems.length})`);
    assert(survivingItems[0].stock === 12, `Consolidated OutletInventory stock is 5 + 7 = 12 (got ${survivingItems[0].stock})`);

    // -------------------------------------------------------------
    // TEST 5: mergeWarehouseDuplicates (Warehouse inventory)
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing mergeWarehouseDuplicates ---');

    const whDupName = 'TEST-WH-DUP-' + Date.now();

    const whDup1 = await prisma.inventoryItem.create({
      data: {
        name: whDupName,
        category: 'Fabrics',
        stock: 10,
        price: 1800,
        variants: JSON.stringify([
          { color: 'Grey', size: 'Standard', stock: 10, price: 1800 }
        ])
      }
    });
    createdInventoryItemIds.push(whDup1.id);

    const whDup2 = await prisma.inventoryItem.create({
      data: {
        name: whDupName,
        category: 'Fabrics',
        stock: 15,
        price: 1800,
        variants: JSON.stringify([
          { color: 'Grey', size: 'Standard', stock: 5, price: 1800 },
          { color: 'Black', size: 'Standard', stock: 10, price: 1800 }
        ])
      }
    });
    createdInventoryItemIds.push(whDup2.id);

    // Detect duplicates
    const whDetectReq = {};
    const whDetectRes = createMockRes();
    await detectWarehouseDuplicates(whDetectReq, whDetectRes);
    assert(whDetectRes.statusCode === 200, `detectWarehouseDuplicates returns HTTP 200`);
    assert(whDetectRes.data?.duplicateGroups >= 1, `detectWarehouseDuplicates detects warehouse duplicates (got ${whDetectRes.data?.duplicateGroups})`);

    // Execute merge
    const whMergeReq = {
      user: adminUser
    };
    const whMergeRes = createMockRes();
    await mergeWarehouseDuplicates(whMergeReq, whMergeRes);
    assert(whMergeRes.statusCode === 200, `mergeWarehouseDuplicates returns HTTP 200`);
    assert(whMergeRes.data?.mergedGroups >= 1, `Merged at least 1 warehouse group (got ${whMergeRes.data?.mergedGroups})`);

    const survivingWhItems = await prisma.inventoryItem.findMany({
      where: { name: whDupName }
    });
    assert(survivingWhItems.length === 1, `Duplicate InventoryItems consolidated into 1 (got ${survivingWhItems.length})`);
    assert(survivingWhItems[0].stock === 25, `Total stock consolidated to 10 + 15 = 25 (got ${survivingWhItems[0].stock})`);

    const rawVariants = survivingWhItems[0].variants;
    const mergedWhVariants = typeof rawVariants === 'string' ? JSON.parse(rawVariants) : rawVariants;
    const greyVariant = mergedWhVariants.find(v => v.color.toLowerCase() === 'grey');
    const blackVariant = mergedWhVariants.find(v => v.color.toLowerCase() === 'black');
    assert(greyVariant.stock === 15, `Grey variant stock combined 10 + 5 = 15 (got ${greyVariant?.stock})`);
    assert(blackVariant.stock === 10, `Black variant stock preserved = 10 (got ${blackVariant?.stock})`);

  } finally {
    console.log('\n--- Cleaning up test records ---');
    if (createdTransferIds.length > 0) {
      await prisma.outletTransferItem.deleteMany({ where: { transferId: { in: createdTransferIds } } });
      await prisma.outletTransfer.deleteMany({ where: { id: { in: createdTransferIds } } });
    }
    if (createdOutletInventoryIds.length > 0) {
      await prisma.outletInventory.deleteMany({ where: { id: { in: createdOutletInventoryIds } } });
    }
    if (createdInventoryItemIds.length > 0) {
      await prisma.inventoryItem.deleteMany({ where: { id: { in: createdInventoryItemIds } } });
    }
    console.log('Cleanup finished.');
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
