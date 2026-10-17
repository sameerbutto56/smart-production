const prisma = require('../src/prisma');
const cache = require('../src/utils/cache');
const {
  createDemandRequest,
  approveDemandRequest,
  dispatchDemandRequest,
  acceptDemandRequest
} = require('../src/controllers/outletDemand.controller');
const { lookupBarcode, getProducts } = require('../src/controllers/pos.controller');

function mockReq(user, body = {}, params = {}, query = {}) {
  return {
    user,
    body,
    params,
    query,
    app: {
      get: () => ({ emit: () => {} })
    }
  };
}

function mockRes() {
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

async function runVerification() {
  console.log('====================================================');
  console.log(' OUTLET DEMAND & POS INVENTORY SYNC VERIFICATION');
  console.log('====================================================');

  const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const storeUser = await prisma.user.findFirst({ where: { role: 'STORE' } }) || adminUser;
  const existingJt = await prisma.user.findFirst({
    where: { name: { contains: 'Johar', mode: 'insensitive' } }
  });
  const jtUser = existingJt
    ? { ...existingJt, outletName: 'Johar Town' }
    : { id: adminUser.id, name: 'Johar Town Outlet', role: 'OUTLET', outletName: 'Johar Town' };

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Test 1: Sleeves Demand Reconciliation in Johar Town
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- Test 1: Sleeves Demand Reconciliation in Johar Town ---');
  const jtSleeves = await prisma.outletInventory.findMany({
    where: { outletName: 'Johar Town', name: { equals: 'Sleeves', mode: 'insensitive' } }
  });

  assert(jtSleeves.length === 2, `Expected exactly 2 canonical sleeve variants in Johar Town, found ${jtSleeves.length}`);
  
  const blackSleeve = jtSleeves.find(s => s.color === 'Black' && s.size === 'Standard');
  const navySleeve = jtSleeves.find(s => s.color === 'Navy' && s.size === 'Standard');

  assert(blackSleeve !== undefined, 'Black Standard sleeve record exists in Johar Town');
  assert(blackSleeve?.isActive === true, 'Black Standard sleeve is active');
  assert(blackSleeve?.deletedAt === null, 'Black Standard sleeve deletedAt is null');
  assert(blackSleeve?.barcode === 'POS1KACSH5', `Black Standard sleeve has canonical warehouse barcode POS1KACSH5 (got ${blackSleeve?.barcode})`);
  assert(blackSleeve?.stock === 20, `Black Standard sleeve stock is 20 (got ${blackSleeve?.stock})`);

  assert(navySleeve !== undefined, 'Navy Standard sleeve record exists in Johar Town');
  assert(navySleeve?.isActive === true, 'Navy Standard sleeve is active');
  assert(navySleeve?.deletedAt === null, 'Navy Standard sleeve deletedAt is null');
  assert(navySleeve?.barcode === 'POS17085CA', `Navy Standard sleeve has canonical warehouse barcode POS17085CA (got ${navySleeve?.barcode})`);
  assert(navySleeve?.stock === 11, `Navy Standard sleeve stock is 11 (got ${navySleeve?.stock})`);

  // Verify Barcode Lookup in POS controller
  const reqBC = mockReq(jtUser, {}, { barcode: 'POS1KACSH5' });
  const resBC = mockRes();
  await lookupBarcode(reqBC, resBC);
  assert(resBC.statusCode === 200, `Barcode lookup for POS1KACSH5 returned 200 (got ${resBC.statusCode})`);
  assert(resBC.data?.stock === 20, `Barcode lookup for POS1KACSH5 returned stock 20 (got ${resBC.data?.stock})`);

  // ────────────────────────────────────────────────────────────────
  // Test 2: Pre-dispatch Warehouse Stock Validation
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Pre-dispatch Warehouse Stock Validation ---');
  // Find a warehouse product with known stock
  const whItem = await prisma.inventoryItem.findFirst({
    where: { isActive: true, stock: { gt: 0 } }
  });
  assert(whItem !== null, 'Found an active warehouse inventory item for testing');

  let testVariant = null;
  if (Array.isArray(whItem.variants) && whItem.variants.length > 0) {
    testVariant = whItem.variants[0];
  }
  const currentVariantStock = testVariant ? (testVariant.stock || 0) : (whItem.stock || 0);

  // Create a demand requesting currentVariantStock + 9999 (excessive)
  const reqCreateExcess = mockReq(jtUser, {
    items: [{
      inventoryItemId: whItem.id,
      productName: whItem.name,
      color: testVariant?.color || '',
      size: testVariant?.size || '',
      requestedQty: currentVariantStock + 9999
    }]
  });
  const resCreateExcess = mockRes();
  await createDemandRequest(reqCreateExcess, resCreateExcess);
  assert(resCreateExcess.statusCode === 201, 'Created test excess demand');
  const excessDemandId = resCreateExcess.data.id;

  // Approve it
  const reqApproveExcess = mockReq(storeUser, {
    status: 'APPROVED',
    items: [{
      ...resCreateExcess.data.items[0],
      approvedQty: currentVariantStock + 9999
    }]
  }, { id: excessDemandId });
  const resApproveExcess = mockRes();
  await approveDemandRequest(reqApproveExcess, resApproveExcess);
  assert(resApproveExcess.statusCode === 200, 'Approved test excess demand');

  // Attempt dispatch: must fail due to insufficient stock
  const reqDispatchExcess = mockReq(storeUser, { deliveryChannel: 'SELF_DELIVERY' }, { id: excessDemandId });
  const resDispatchExcess = mockRes();
  await dispatchDemandRequest(reqDispatchExcess, resDispatchExcess);
  assert(resDispatchExcess.statusCode === 400, `Excess dispatch blocked with HTTP 400 (got ${resDispatchExcess.statusCode})`);
  assert(resDispatchExcess.data?.message?.includes('Insufficient warehouse stock'), `Correct error message returned: ${resDispatchExcess.data?.message}`);

  // Clean up excess demand
  await prisma.outletDemandRequest.delete({ where: { id: excessDemandId } });

  // ────────────────────────────────────────────────────────────────
  // Test 3: Full Lifecycle (Create -> Approve -> Dispatch -> Accept)
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Full End-to-End Demand Cycle & Stock Sync ---');
  // Pick an item with stock >= 5
  const whTarget = await prisma.inventoryItem.findFirst({
    where: { isActive: true, stock: { gte: 5 } }
  });
  assert(whTarget !== null, 'Found warehouse item with >= 5 stock');

  let chosenVar = null;
  if (Array.isArray(whTarget.variants) && whTarget.variants.length > 0) {
    chosenVar = whTarget.variants.find(v => (v.stock || 0) >= 2) || whTarget.variants[0];
  }
  const startingWhStock = chosenVar ? chosenVar.stock : whTarget.stock;
  const transferQty = 2;

  // Check outlet starting stock for this variant in Johar Town
  const existingOutletRow = await prisma.outletInventory.findFirst({
    where: {
      outletName: 'Johar Town',
      name: { equals: whTarget.name, mode: 'insensitive' },
      ...(chosenVar?.color ? { color: chosenVar.color } : {}),
      ...(chosenVar?.size ? { size: chosenVar.size } : {}),
      isActive: true,
      deletedAt: null
    }
  });
  const startingOutletStock = existingOutletRow ? existingOutletRow.stock : 0;

  // Step A: Create Demand
  const reqCreate = mockReq(jtUser, {
    items: [{
      inventoryItemId: whTarget.id,
      productName: whTarget.name,
      color: chosenVar?.color || '',
      size: chosenVar?.size || '',
      requestedQty: transferQty
    }]
  });
  const resCreate = mockRes();
  await createDemandRequest(reqCreate, resCreate);
  assert(resCreate.statusCode === 201, 'Demand created successfully');
  const demandId = resCreate.data.id;
  assert(resCreate.data.status === 'PENDING', 'Initial demand status is PENDING');
  assert(resCreate.data.items[0].barcode !== undefined, 'Item enriched with barcode');

  // Step B: Approve Demand (warehouse stock must NOT deduct yet!)
  const reqApprove = mockReq(storeUser, {
    status: 'APPROVED',
    items: [{
      ...resCreate.data.items[0],
      approvedQty: transferQty
    }]
  }, { id: demandId });
  const resApprove = mockRes();
  await approveDemandRequest(reqApprove, resApprove);
  assert(resApprove.statusCode === 200, 'Demand approved successfully');

  // Verify warehouse stock is unchanged after approval
  const whAfterApprove = await prisma.inventoryItem.findUnique({ where: { id: whTarget.id } });
  const whStockAfterApprove = chosenVar
    ? whAfterApprove.variants.find(v => v.color === chosenVar.color && v.size === chosenVar.size).stock
    : whAfterApprove.stock;
  assert(whStockAfterApprove === startingWhStock, `Warehouse stock NOT deducted on approval (${whStockAfterApprove} === ${startingWhStock})`);

  // Step C: Dispatch Demand (warehouse stock MUST deduct now!)
  const reqDispatch = mockReq(storeUser, { deliveryChannel: 'SELF_DELIVERY' }, { id: demandId });
  const resDispatch = mockRes();
  await dispatchDemandRequest(reqDispatch, resDispatch);
  assert(resDispatch.statusCode === 200, 'Demand dispatched successfully');

  // Verify demand status is DISPATCHED
  const demandAfterDispatch = await prisma.outletDemandRequest.findUnique({ where: { id: demandId } });
  assert(demandAfterDispatch.status === 'DISPATCHED', `Demand status updated to DISPATCHED (got ${demandAfterDispatch.status})`);
  assert(demandAfterDispatch.dispatchedAt !== null, 'dispatchedAt timestamp recorded');

  // Verify warehouse stock deducted
  const whAfterDispatch = await prisma.inventoryItem.findUnique({ where: { id: whTarget.id } });
  const whStockAfterDispatch = chosenVar
    ? whAfterDispatch.variants.find(v => v.color === chosenVar.color && v.size === chosenVar.size).stock
    : whAfterDispatch.stock;
  assert(whStockAfterDispatch === startingWhStock - transferQty, `Warehouse stock deducted by ${transferQty} on dispatch (${whStockAfterDispatch} === ${startingWhStock - transferQty})`);

  // Step D: Re-dispatch guard (cannot dispatch twice)
  const resDispatch2 = mockRes();
  await dispatchDemandRequest(reqDispatch, resDispatch2);
  assert(resDispatch2.statusCode === 400 || resDispatch2.statusCode === 409, `Duplicate dispatch rejected (status ${resDispatch2.statusCode})`);

  // Step E: Accept Demand by Destination Outlet
  const reqAccept = mockReq(jtUser, {}, { id: demandId });
  const resAccept = mockRes();
  await acceptDemandRequest(reqAccept, resAccept);
  assert(resAccept.statusCode === 200, 'Demand accepted successfully by outlet');

  // Verify demand status is COMPLETED and acceptedAt is set
  const demandAfterAccept = await prisma.outletDemandRequest.findUnique({ where: { id: demandId } });
  assert(demandAfterAccept.status === 'COMPLETED', `Demand status updated to COMPLETED (got ${demandAfterAccept.status})`);
  assert(demandAfterAccept.acceptedAt !== null, 'acceptedAt timestamp recorded');

  // Verify destination outlet POS stock incremented
  const outletRowAfterAccept = await prisma.outletInventory.findFirst({
    where: {
      outletName: 'Johar Town',
      name: { equals: whTarget.name, mode: 'insensitive' },
      ...(chosenVar?.color ? { color: chosenVar.color } : {}),
      ...(chosenVar?.size ? { size: chosenVar.size } : {}),
      isActive: true,
      deletedAt: null
    }
  });
  assert(outletRowAfterAccept !== null, 'Outlet inventory row exists and is active');
  assert(outletRowAfterAccept.stock === startingOutletStock + transferQty, `Outlet POS stock incremented by ${transferQty} (starting ${startingOutletStock} -> new ${outletRowAfterAccept.stock})`);

  // Verify no duplicate row was created
  const matchingRows = await prisma.outletInventory.findMany({
    where: {
      outletName: 'Johar Town',
      name: { equals: whTarget.name, mode: 'insensitive' },
      ...(chosenVar?.color ? { color: chosenVar.color } : {}),
      ...(chosenVar?.size ? { size: chosenVar.size } : {}),
      isActive: true,
      deletedAt: null
    }
  });
  assert(matchingRows.length === 1, `Exactly 1 active row exists in outlet for this variant (found ${matchingRows.length})`);

  // Step F: Idempotency: verify duplicate accept is rejected with 400 or 409
  const resAccept2 = mockRes();
  await acceptDemandRequest(reqAccept, resAccept2);
  assert(resAccept2.statusCode === 400 || resAccept2.statusCode === 409, `Duplicate accept rejected (status ${resAccept2.statusCode})`);

  // Verify warehouse stock was NOT double deducted upon acceptance
  const whFinal = await prisma.inventoryItem.findUnique({ where: { id: whTarget.id } });
  const whFinalStock = chosenVar
    ? whFinal.variants.find(v => v.color === chosenVar.color && v.size === chosenVar.size).stock
    : whFinal.stock;
  assert(whFinalStock === startingWhStock - transferQty, `Warehouse stock was not modified during acceptance (${whFinalStock} === ${startingWhStock - transferQty})`);

  // Revert test stock additions and restore original warehouse and outlet stock
  if (chosenVar) {
    const vars = whFinal.variants.map(v => {
      if (v.color === chosenVar.color && v.size === chosenVar.size) {
        return { ...v, stock: startingWhStock };
      }
      return v;
    });
    const totalStock = vars.reduce((s, v) => s + (v.stock || 0), 0);
    await prisma.inventoryItem.update({
      where: { id: whTarget.id },
      data: { variants: vars, stock: totalStock }
    });
  } else {
    await prisma.inventoryItem.update({
      where: { id: whTarget.id },
      data: { stock: startingWhStock }
    });
  }

  if (existingOutletRow) {
    await prisma.outletInventory.update({
      where: { id: existingOutletRow.id },
      data: { stock: startingOutletStock }
    });
  } else {
    await prisma.outletInventory.delete({
      where: { id: outletRowAfterAccept.id }
    });
  }

  // Clean up test demand
  await prisma.outletDemandRequest.delete({ where: { id: demandId } });
  console.log('Restored test inventory levels and cleaned up test demand.');

  // ────────────────────────────────────────────────────────────────
  // Test 4: Soft-Deleted Variant Reactivation without Duplicate Creation
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: Soft-Deleted Variant Reactivation ---');
  // Create a soft-deleted item in Johar Town
  const testBarcode = `POS_TEST_${Date.now().toString(36).toUpperCase()}`;
  const softDeletedItem = await prisma.outletInventory.create({
    data: {
      outletName: 'Johar Town',
      name: 'Test Demand Scrub Reactivation',
      category: 'SCRUBS',
      color: 'Emerald',
      size: 'Medium',
      stock: 0,
      price: 2500,
      barcode: testBarcode,
      isActive: false,
      deletedAt: new Date('2026-09-01T00:00:00Z')
    }
  });

  // Create a corresponding warehouse item
  const testWhItem = await prisma.inventoryItem.create({
    data: {
      name: 'Test Demand Scrub Reactivation',
      category: 'SCRUBS',
      stock: 10,
      price: 2500,
      variants: [{
        color: 'Emerald',
        size: 'Medium',
        stock: 10,
        price: 2500,
        barcode: testBarcode
      }]
    }
  });

  // Create demand -> approve -> dispatch -> accept
  const reqC4 = mockReq(jtUser, {
    items: [{
      inventoryItemId: testWhItem.id,
      productName: testWhItem.name,
      color: 'Emerald',
      size: 'Medium',
      requestedQty: 3
    }]
  });
  const resC4 = mockRes();
  await createDemandRequest(reqC4, resC4);
  const dem4Id = resC4.data.id;

  const reqA4 = mockReq(storeUser, {
    status: 'APPROVED',
    items: [{ ...resC4.data.items[0], approvedQty: 3 }]
  }, { id: dem4Id });
  await approveDemandRequest(reqA4, mockRes());

  const reqD4 = mockReq(storeUser, { deliveryChannel: 'SELF_DELIVERY' }, { id: dem4Id });
  await dispatchDemandRequest(reqD4, mockRes());

  const reqAcc4 = mockReq(jtUser, {}, { id: dem4Id });
  const resAcc4 = mockRes();
  await acceptDemandRequest(reqAcc4, resAcc4);
  assert(resAcc4.statusCode === 200, 'Soft-deleted item demand accepted');

  // Verify that the soft-deleted item was REACTIVATED and no duplicate was created
  const allRows4 = await prisma.outletInventory.findMany({
    where: {
      outletName: 'Johar Town',
      name: 'Test Demand Scrub Reactivation'
    }
  });
  assert(allRows4.length === 1, `Exactly 1 record exists in outlet (no duplicate created, got ${allRows4.length})`);
  assert(allRows4[0].id === softDeletedItem.id, 'The soft-deleted record was reused/reactivated in place');
  assert(allRows4[0].isActive === true, 'Reactivated record is active');
  assert(allRows4[0].deletedAt === null, 'Reactivated record deletedAt is null');
  assert(allRows4[0].stock === 3, `Reactivated record received accepted stock of 3 (got ${allRows4[0].stock})`);

  // Clean up Test 4 records
  await prisma.outletInventory.delete({ where: { id: softDeletedItem.id } });
  await prisma.inventoryItem.delete({ where: { id: testWhItem.id } });
  await prisma.outletDemandRequest.delete({ where: { id: dem4Id } });

  console.log('\n====================================================');
  console.log(` ALL ${passed} / ${total} CHECKS PASSED SUCCESSFULLY!`);
  console.log('====================================================');
}

runVerification()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Verification failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
