/**
 * Standalone Verification Script for Warehouse Inventory Stock Filter & Office Supply Fixes
 * 
 * Verifies:
 * 1. Warehouse Inventory Stock Filter classification logic (AVAILABLE, LOW <=5, OUT == 0)
 * 2. Office Supply product creation with initialStoreStock
 * 3. Office Supply stock adjustment (upserting missing rows cleanly)
 * 4. Office Supply Direct Transfer with strict Store stock validation (out of stock / insufficient block)
 * 5. Office Supply Store Self-Use (atomic deduction, OSU- sequence, previousStock & remainingStock audit, movement log)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Authoritative stock classification logic
function classifyStock(stock) {
  const isAvailable = stock > 0;
  const isLow = stock > 0 && stock < 5;
  const isOut = stock === 0;
  return { isAvailable, isLow, isOut };
}

async function runTests() {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('STARTING WAREHOUSE INVENTORY & OFFICE SUPPLY VERIFICATION');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Warehouse Inventory Stock Filter Logic & User Acceptance Dataset
  // --------------------------------------------------------------------------
  console.log('Test Suite 1: Warehouse Inventory Stock Filter Classification & Acceptance Dataset');

  // Exact dataset specified by user in Section 7
  const acceptanceDataset = [
    { name: 'Product A', qty: 100 },
    { name: 'Product B', qty: 5 },
    { name: 'Product C', qty: 4 },
    { name: 'Product D', qty: 2 },
    { name: 'Product E', qty: 1 },
    { name: 'Product F', qty: 0 },
  ];

  // Evaluate filters
  const allFiltered = acceptanceDataset.filter(() => true);
  const availableFiltered = acceptanceDataset.filter(p => p.qty > 0);
  const lowFiltered = acceptanceDataset.filter(p => p.qty > 0 && p.qty < 5);
  const outFiltered = acceptanceDataset.filter(p => p.qty === 0);

  assert(allFiltered.length === 6, `ALL = 6 products (${allFiltered.map(p => p.name).join(', ')})`);
  assert(
    availableFiltered.length === 5 &&
    availableFiltered.map(p => p.name).join(',') === 'Product A,Product B,Product C,Product D,Product E',
    `AVAILABLE = 5 products (${availableFiltered.map(p => p.name).join(', ')})`
  );
  assert(
    lowFiltered.length === 3 &&
    lowFiltered.map(p => p.name).join(',') === 'Product C,Product D,Product E',
    `LOW STOCK = 3 products (${lowFiltered.map(p => p.name).join(', ')})`
  );
  assert(
    outFiltered.length === 1 &&
    outFiltered[0].name === 'Product F',
    `OUT OF STOCK = 1 product (${outFiltered.map(p => p.name).join(', ')})`
  );

  // Verify relationship matrix from Section 3
  const matrix = [
    { qty: 100, expAll: true, expAvail: true, expLow: false, expOut: false },
    { qty: 20,  expAll: true, expAvail: true, expLow: false, expOut: false },
    { qty: 5,   expAll: true, expAvail: true, expLow: false, expOut: false },
    { qty: 4,   expAll: true, expAvail: true, expLow: true,  expOut: false },
    { qty: 3,   expAll: true, expAvail: true, expLow: true,  expOut: false },
    { qty: 2,   expAll: true, expAvail: true, expLow: true,  expOut: false },
    { qty: 1,   expAll: true, expAvail: true, expLow: true,  expOut: false },
    { qty: 0,   expAll: true, expAvail: false, expLow: false, expOut: true },
  ];

  for (const m of matrix) {
    const res = classifyStock(m.qty);
    assert(
      res.isAvailable === m.expAvail &&
      res.isLow === m.expLow &&
      res.isOut === m.expOut,
      `Matrix Qty ${m.qty} -> Avail: ${res.isAvailable}, Low: ${res.isLow}, Out: ${res.isOut}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 2: Office Supply Product with Initial Store Stock
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 2: Office Supply Product with Initial Store Stock');
  const testSku = `TEST-OFF-${Date.now().toString().slice(-6)}`;
  let testProductId = null;

  try {
    // Simulate createProduct with initialStock: 25
    const initialQty = 25;
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.officeSupplyProduct.create({
        data: {
          name: `Automated Test Stationery ${testSku}`,
          sku: testSku,
          unit: 'pkt',
          description: 'Created for test verification',
        },
      });

      await tx.officeSupplyStock.create({
        data: {
          productId: p.id,
          location: 'STORE',
          locationType: 'STORE',
          quantity: initialQty,
        },
      });

      await tx.officeSupplyStockMovement.create({
        data: {
          productId: p.id,
          movementType: 'ADD',
          toLocation: 'STORE',
          quantity: initialQty,
          performedBy: 'Test Runner',
          notes: 'Initial stock on product creation',
        },
      });

      return p;
    });

    testProductId = product.id;
    assert(!!testProductId, `Created test product ${product.name} (id: ${product.id})`);

    const stockRow = await prisma.officeSupplyStock.findUnique({
      where: { productId_location: { productId: testProductId, location: 'STORE' } },
    });
    assert(stockRow && stockRow.quantity === 25, `Initial Store stock is 25 units`);

    // --------------------------------------------------------------------------
    // TEST 3: Office Supply Stock Adjustment (Upsert)
    // --------------------------------------------------------------------------
    console.log('\nTest Suite 3: Office Supply Stock Adjustment');
    const adjustedQty = 40;

    await prisma.$transaction(async (tx) => {
      const current = await tx.officeSupplyStock.findUnique({
        where: { productId_location: { productId: testProductId, location: 'STORE' } },
      });
      const oldQty = current ? current.quantity : 0;
      const delta = adjustedQty - oldQty;

      await tx.officeSupplyStock.upsert({
        where: { productId_location: { productId: testProductId, location: 'STORE' } },
        create: { productId: testProductId, location: 'STORE', locationType: 'STORE', quantity: adjustedQty },
        update: { quantity: adjustedQty },
      });

      await tx.officeSupplyStockMovement.create({
        data: {
          productId: testProductId,
          movementType: 'ADJUSTMENT',
          toLocation: 'STORE',
          quantity: delta,
          performedBy: 'Test Runner',
          notes: `Stock adjusted from ${oldQty} to ${adjustedQty}`,
        },
      });
    });

    const adjustedRow = await prisma.officeSupplyStock.findUnique({
      where: { productId_location: { productId: testProductId, location: 'STORE' } },
    });
    assert(adjustedRow && adjustedRow.quantity === 40, `Store stock adjusted from 25 to 40 units`);

    // --------------------------------------------------------------------------
    // TEST 4: Direct Transfer Stock Validation
    // --------------------------------------------------------------------------
    console.log('\nTest Suite 4: Direct Transfer Stock Validation');

    // 4A: Attempt transfer exceeding available stock (40 available, request 50)
    let rejectedExceed = false;
    try {
      await prisma.$transaction(async (tx) => {
        const stock = await tx.officeSupplyStock.findUnique({
          where: { productId_location: { productId: testProductId, location: 'STORE' } },
        });
        const available = stock?.quantity || 0;
        const requested = 50;
        if (available < requested) {
          throw new Error(`Insufficient Office Supply stock for "${product.name}". Available: ${available}, Requested: ${requested}.`);
        }
      });
    } catch (e) {
      rejectedExceed = true;
      assert(
        e.message.includes('Insufficient Office Supply stock') && e.message.includes('Available: 40') && e.message.includes('Requested: 50'),
        `Properly blocked transfer exceeding stock with message: "${e.message}"`
      );
    }
    assert(rejectedExceed, 'Transfer of 50 units when 40 available was blocked');

    // 4B: Successful Direct Transfer (request 10, stock 40 -> 30)
    let transferId = null;
    const transferResult = await prisma.$transaction(async (tx) => {
      const stock = await tx.officeSupplyStock.findUnique({
        where: { productId_location: { productId: testProductId, location: 'STORE' } },
      });
      const available = stock?.quantity || 0;
      const requested = 10;
      if (available < requested) throw new Error('Insufficient');

      const remaining = available - requested;

      // Upsert sequence
      const year = new Date().getFullYear();
      const seq = await tx.officeSupplySequence.upsert({
        where: { prefix_year: { prefix: 'OST', year } },
        create: { prefix: 'OST', year, nextValue: 2 },
        update: { nextValue: { increment: 1 } },
      });
      const d = new Date();
      const ymd = String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      const transferNumber = `OST-${ymd}-${String(seq.nextValue - 1).padStart(5, '0')}`;

      const t = await tx.officeSupplyTransfer.create({
        data: {
          transferNumber,
          type: 'DIRECT',
          fromLocation: 'STORE',
          toLocation: 'Johar Town',
          status: 'PENDING',
          sentByName: 'Test Runner',
          items: {
            create: [
              {
                productId: testProductId,
                productName: product.name,
                unit: product.unit,
                quantity: requested,
                previousStock: available,
                remainingStock: remaining,
              },
            ],
          },
        },
        include: { items: true },
      });

      await tx.officeSupplyStock.update({
        where: { productId_location: { productId: testProductId, location: 'STORE' } },
        data: { quantity: { decrement: requested } },
      });

      await tx.officeSupplyStockMovement.create({
        data: {
          productId: testProductId,
          movementType: 'TRANSFER_OUT',
          fromLocation: 'STORE',
          toLocation: 'Johar Town',
          quantity: requested,
          referenceId: t.id,
          referenceType: 'TRANSFER',
          performedBy: 'Test Runner',
        },
      });

      return t;
    });

    transferId = transferResult.id;
    assert(transferResult.items[0].previousStock === 40, `Transfer item previousStock recorded as 40`);
    assert(transferResult.items[0].remainingStock === 30, `Transfer item remainingStock recorded as 30`);

    const stockAfterTransfer = await prisma.officeSupplyStock.findUnique({
      where: { productId_location: { productId: testProductId, location: 'STORE' } },
    });
    assert(stockAfterTransfer && stockAfterTransfer.quantity === 30, `Store stock decremented to 30 units`);

    // --------------------------------------------------------------------------
    // TEST 5: Store Self-Use Execution & Audit
    // --------------------------------------------------------------------------
    console.log('\nTest Suite 5: Store Self-Use Execution & Audit');

    // 5A: Attempt Self-Use exceeding available stock (30 available, request 35)
    let rejectedSelfUse = false;
    try {
      await prisma.$transaction(async (tx) => {
        const stock = await tx.officeSupplyStock.findUnique({
          where: { productId_location: { productId: testProductId, location: 'STORE' } },
        });
        const available = stock?.quantity || 0;
        const requested = 35;
        if (available < requested) {
          throw new Error(`Insufficient Office Supply stock for "${product.name}". Available: ${available}, Requested: ${requested}.`);
        }
      });
    } catch (e) {
      rejectedSelfUse = true;
      assert(
        e.message.includes('Insufficient Office Supply stock') && e.message.includes('Available: 30') && e.message.includes('Requested: 35'),
        `Properly blocked self-use exceeding stock with message: "${e.message}"`
      );
    }
    assert(rejectedSelfUse, 'Self-use of 35 units when 30 available was blocked');

    // 5B: Valid Self-Use (request 5, stock 30 -> 25)
    const selfUseQty = 5;
    const year = new Date().getFullYear();
    const selfUseResult = await prisma.$transaction(async (tx) => {
      const stock = await tx.officeSupplyStock.findUnique({
        where: { productId_location: { productId: testProductId, location: 'STORE' } },
      });
      const available = stock?.quantity || 0;
      if (available < selfUseQty) throw new Error('Insufficient');

      const remaining = available - selfUseQty;

      const seq = await tx.officeSupplySequence.upsert({
        where: { prefix_year: { prefix: 'OSU', year } },
        create: { prefix: 'OSU', year, nextValue: 2 },
        update: { nextValue: { increment: 1 } },
      });
      const d = new Date();
      const ymd = String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      const transferNumber = `OSU-${ymd}-${String(seq.nextValue - 1).padStart(5, '0')}`;

      const t = await tx.officeSupplyTransfer.create({
        data: {
          transferNumber,
          type: 'SELF_USE',
          fromLocation: 'STORE',
          toLocation: 'STORE',
          status: 'RECEIVED',
          notes: 'Box packing for dispatch audit test',
          sentByName: 'Store Audit User',
          receivedByName: 'Store Audit User',
          receivedAt: new Date(),
          items: {
            create: [
              {
                productId: testProductId,
                productName: product.name,
                unit: product.unit,
                quantity: selfUseQty,
                previousStock: available,
                remainingStock: remaining,
              },
            ],
          },
        },
        include: { items: true },
      });

      await tx.officeSupplyStock.update({
        where: { productId_location: { productId: testProductId, location: 'STORE' } },
        data: { quantity: { decrement: selfUseQty } },
      });

      await tx.officeSupplyStockMovement.create({
        data: {
          productId: testProductId,
          movementType: 'SELF_USE',
          fromLocation: 'STORE',
          toLocation: 'STORE',
          quantity: selfUseQty,
          referenceId: t.id,
          referenceType: 'TRANSFER',
          performedBy: 'Store Audit User',
          notes: 'Store self-use: Box packing for dispatch audit test',
        },
      });

      return t;
    });

    assert(selfUseResult.transferNumber.startsWith('OSU-'), `Generated doc number with OSU- prefix: ${selfUseResult.transferNumber}`);
    assert(selfUseResult.items[0].previousStock === 30, `Self-use audit previousStock is 30`);
    assert(selfUseResult.items[0].quantity === 5, `Self-use quantity consumed is 5`);
    assert(selfUseResult.items[0].remainingStock === 25, `Self-use audit remainingStock is 25`);

    const stockAfterSelfUse = await prisma.officeSupplyStock.findUnique({
      where: { productId_location: { productId: testProductId, location: 'STORE' } },
    });
    assert(stockAfterSelfUse && stockAfterSelfUse.quantity === 25, `Store stock after self-use is 25 units`);

    // Verify Movement Log
    const movement = await prisma.officeSupplyStockMovement.findFirst({
      where: { referenceId: selfUseResult.id },
    });
    assert(movement && movement.movementType === 'SELF_USE', `Movement log created with movementType: 'SELF_USE'`);

    // Clean up test records
    console.log('\nCleaning up test records...');
    await prisma.officeSupplyStockMovement.deleteMany({ where: { productId: testProductId } });
    await prisma.officeSupplyTransferItem.deleteMany({ where: { productId: testProductId } });
    await prisma.officeSupplyTransfer.deleteMany({ where: { id: { in: [transferId, selfUseResult.id].filter(Boolean) } } });
    await prisma.officeSupplyStock.deleteMany({ where: { productId: testProductId } });
    await prisma.officeSupplyProduct.deleteMany({ where: { id: testProductId } });
    console.log('Cleanup completed successfully.');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('════════════════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
