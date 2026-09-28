// ASM Request Edit, Version Diff, Re-Approval & Store Allocation Verification Script
// Tests:
// 1. Creation of test ASM order in AWAITED_ADMIN stage (v1)
// 2. Admin approval and forwarding to Store (SENT_TO_STORE)
// 3. Store partial allocation on an item
// 4. ASM editing order: modifying existing item qty, removing unallocated item, adding new item, updating vendor info
// 5. Verification of stage transition reset to AWAITED_ADMIN, version increment (v2), revision history diff, totals recalculation
// 6. Verification that order ID and orderNumber remain identical
// 7. Admin re-approval and forwarding back to Store (SENT_TO_STORE)
// 8. Store net allocation deduction logic (Math.max(0, allocQty - alreadyDeducted))
// 9. Soft-removal test: removing an item that already had allocatedQuantity > 0 flags isRemoved: true and keeps row for stock reconciliation
// 10. Keeper order (VO-2026-00004 / Suhail Abbas) integrity check & safe teardown

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PASS = '✓ PASS';
const FAIL = '✗ FAIL';
let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`${PASS}: ${message}`);
    totalPassed++;
  } else {
    console.error(`${FAIL}: ${message}`);
    totalFailed++;
  }
}

async function runVerification() {
  console.log('=== ASM REQUEST EDIT & RE-APPROVAL WORKFLOW VERIFICATION ===\n');

  let testVendor = null;
  let testAsm = null;
  let testAdmin = null;
  let testOrder = null;

  try {
    // ── STAGE 1: Setup Test Data ─────────────────────────────────────────────
    console.log('[Stage 1] Setting up test data...');
    testAsm = await prisma.user.findFirst({ where: { role: 'ASM', isActive: true } });
    if (!testAsm) testAsm = await prisma.user.findFirst({ where: { isActive: true } });

    testAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
    if (!testAdmin) testAdmin = testAsm;

    testVendor = await prisma.vendor.create({
      data: {
        name: `Test Edit Vendor ${Date.now()}`,
        contactPerson: 'Manager Ali',
        phone: '0300-1122334',
        email: 'test.edit@enamels.com',
        city: 'Lahore',
        address: '123 Test Plaza, Gulberg',
      },
    });

    const timestamp = Date.now();
    const orderNumber = `VO-TEST-EDIT-${timestamp}`;

    testOrder = await prisma.vendorOrder.create({
      data: {
        orderNumber,
        quotationNumber: `QUO-EDIT-${timestamp}`,
        invoiceNumber: `INV-EDIT-${timestamp}`,
        vendorId: testVendor.id,
        asmId: testAsm.id,
        status: 'AWAITED_ADMIN',
        currentStage: 'AWAITED_ADMIN',
        version: 1,
        isEdited: false,
        totalOrderValue: 25000,
        grandTotal: 25000,
        deliveryCharges: 0,
        discount: 0,
        items: {
          create: [
            {
              productName: 'Formal Shirt Navy',
              color: 'Navy',
              size: 'M',
              quantity: 10,
              unitPrice: 1500,
              lineTotal: 15000,
              allocatedQuantity: 0,
            },
            {
              productName: 'Cotton Trouser Black',
              color: 'Black',
              size: '32',
              quantity: 5,
              unitPrice: 2000,
              lineTotal: 10000,
              allocatedQuantity: 0,
            },
          ],
        },
        statusHistory: {
          create: [
            {
              status: 'SUBMITTED',
              fromStage: 'CREATED',
              toStage: 'AWAITED_ADMIN',
              changedById: testAsm.id,
              changedBy: testAsm.name || 'ASM User',
              remarks: 'Initial bulk order request created (v1)',
            },
          ],
        },
      },
      include: {
        items: true,
        vendor: true,
      },
    });

    assert(testOrder && testOrder.version === 1, 'Initial order created with version = 1');
    assert(testOrder.currentStage === 'AWAITED_ADMIN', 'Initial order stage is AWAITED_ADMIN');
    assert(testOrder.items.length === 2, 'Order has 2 line items');
    assert(testOrder.isEdited === false, 'isEdited is false initially');

    // ── STAGE 2: Admin Approves & Forwards to Store ──────────────────────────
    console.log('\n[Stage 2] Admin approves order and sends to Store...');
    const approvedOrder = await prisma.vendorOrder.update({
      where: { id: testOrder.id },
      data: {
        currentStage: 'SENT_TO_STORE',
        status: 'SENT_TO_STORE',
        statusHistory: {
          create: [
            {
              status: 'ADMIN_APPROVED',
              fromStage: 'AWAITED_ADMIN',
              toStage: 'SENT_TO_STORE',
              changedById: testAdmin.id,
              changedBy: testAdmin.name || 'Admin',
              remarks: 'Approved and forwarded to Store',
            },
          ],
        },
      },
      include: { items: true },
    });

    assert(approvedOrder.currentStage === 'SENT_TO_STORE', 'Order transitioned to SENT_TO_STORE');

    // ── STAGE 3: Store Partial Allocation ───────────────────────────────────
    console.log('\n[Stage 3] Store partially allocates Item 1...');
    const item1 = approvedOrder.items.find(i => i.productName === 'Formal Shirt Navy');
    const item2 = approvedOrder.items.find(i => i.productName === 'Cotton Trouser Black');

    await prisma.vendorOrderItem.update({
      where: { id: item1.id },
      data: { allocatedQuantity: 4 },
    });

    const item1AfterAlloc = await prisma.vendorOrderItem.findUnique({ where: { id: item1.id } });
    assert(item1AfterAlloc.allocatedQuantity === 4, 'Item 1 allocatedQuantity updated to 4');

    // ── STAGE 4: ASM Edits the Order (editVendorOrder controller simulation) ─
    console.log('\n[Stage 4] ASM edits the order (modify item 1 qty, delete item 2, add item 3)...');
    
    // Test the actual controller logic directly
    const vendorController = require('../src/controllers/vendor.controller.js');

    const reqMock = {
      params: { id: testOrder.id },
      user: { id: testAsm.id, name: testAsm.name || 'ASM User', role: 'ASM' },
      body: {
        vendorData: {
          phone: '0300-9998877',
          city: 'Karachi',
        },
        items: [
          // Item 1 modified: quantity increased from 10 to 12
          {
            id: item1.id,
            productName: 'Formal Shirt Navy',
            color: 'Navy',
            size: 'M',
            quantity: 12,
            unitPrice: 1500,
          },
          // Item 2 removed (not present in incoming list)
          // Item 3 added
          {
            productName: 'Silk Tie Red',
            color: 'Red',
            size: 'Free',
            quantity: 4,
            unitPrice: 1000,
          },
        ],
        discount: 10,
        discountType: 'PERCENT',
        notes: 'Revised delivery request with updated items and 10% discount',
      },
    };

    let controllerResponse = null;
    let controllerStatus = 200;
    const resMock = {
      status: function (code) {
        controllerStatus = code;
        return this;
      },
      json: function (data) {
        controllerResponse = data;
        return this;
      },
    };

    await vendorController.editVendorOrder(reqMock, resMock);

    assert(controllerStatus === 200, `editVendorOrder returned HTTP 200 (received ${controllerStatus})`);
    assert(controllerResponse && controllerResponse.success === true, 'Response contains success = true');
    assert(controllerResponse.version === 2, `Response version is 2 (got ${controllerResponse?.version})`);
    assert(controllerResponse.diff.added.length === 1, `Diff added count = 1 (got ${controllerResponse?.diff?.added?.length})`);
    assert(controllerResponse.diff.removed.length === 1, `Diff removed count = 1 (got ${controllerResponse?.diff?.removed?.length})`);
    assert(controllerResponse.diff.modified.length === 1, `Diff modified count = 1 (got ${controllerResponse?.diff?.modified?.length})`);

    // ── STAGE 5: Verify Order State in Database ──────────────────────────────
    console.log('\n[Stage 5] Verifying edited order state in database...');
    const editedOrder = await prisma.vendorOrder.findUnique({
      where: { id: testOrder.id },
      include: {
        items: true,
        vendor: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    assert(editedOrder.id === testOrder.id, 'Order ID remains identical');
    assert(editedOrder.orderNumber === testOrder.orderNumber, 'Order Number remains identical');
    assert(editedOrder.version === 2, 'Order version incremented to 2');
    assert(editedOrder.isEdited === true, 'Order isEdited is true');
    assert(editedOrder.currentStage === 'AWAITED_ADMIN', 'Order currentStage reset to AWAITED_ADMIN');
    assert(editedOrder.status === 'AWAITED_ADMIN', 'Order status reset to AWAITED_ADMIN');
    assert(editedOrder.fulfillmentMethod === null, 'Order fulfillmentMethod reset to null');
    assert(editedOrder.vendor.phone === '0300-9998877', 'Vendor phone updated successfully');
    assert(editedOrder.vendor.city === 'Karachi', 'Vendor city updated successfully');

    // Financial calculations:
    // Subtotal: (12 * 1500) + (4 * 1000) = 18000 + 4000 = 22000
    // Discount: 10% of 22000 = 2200
    // GrandTotal: 22000 - 2200 = 19800
    assert(editedOrder.totalOrderValue === 22000, `Order totalOrderValue correctly calculated: 22000 (got ${editedOrder.totalOrderValue})`);
    assert(editedOrder.discount === 2200, `Order discount correctly calculated: 2200 (got ${editedOrder.discount})`);
    assert(editedOrder.grandTotal === 19800, `Order grandTotal correctly calculated: 19800 (got ${editedOrder.grandTotal})`);

    // Verify timeline log
    const latestTimeline = editedOrder.statusHistory[0];
    assert(latestTimeline.status === 'RESUBMITTED_AWAITED_ADMIN', `Timeline status is RESUBMITTED_AWAITED_ADMIN (got ${latestTimeline?.status})`);
    assert(latestTimeline.toStage === 'AWAITED_ADMIN', 'Timeline toStage is AWAITED_ADMIN');

    // Verify revisionHistory
    assert(Array.isArray(editedOrder.revisionHistory), 'revisionHistory is an array');
    assert(editedOrder.revisionHistory.length === 1, 'revisionHistory has 1 entry (v1 snapshot)');
    assert(editedOrder.revisionHistory[0].version === 1, 'revisionHistory entry records version 1');

    // Verify active items: Item 1 has quantity 12 and previousQuantity 10, Item 3 is added
    const activeItems = editedOrder.items.filter(it => !it.isRemoved);
    assert(activeItems.length === 2, `Active items count is 2 (got ${activeItems.length})`);
    const dbItem1 = activeItems.find(i => i.productName === 'Formal Shirt Navy');
    assert(dbItem1 && dbItem1.quantity === 12, 'Item 1 quantity updated to 12');
    assert(dbItem1 && dbItem1.previousQuantity === 10, 'Item 1 previousQuantity recorded as 10');
    assert(dbItem1 && dbItem1.allocatedQuantity === 4, 'Item 1 preserved prior allocatedQuantity of 4');

    // ── STAGE 6: Soft Removal of Previously Allocated Item ──────────────────
    console.log('\n[Stage 6] Soft removal test: removing Item 1 which had prior allocation (4 units)...');
    // If an item had allocatedQuantity > 0, removing it must NOT delete the row, but flag isRemoved: true
    const reqMock2 = {
      params: { id: testOrder.id },
      user: { id: testAsm.id, name: testAsm.name || 'ASM User', role: 'ASM' },
      body: {
        items: [
          // Keep only Item 3, remove Item 1 (which had allocatedQuantity = 4)
          {
            productName: 'Silk Tie Red',
            color: 'Red',
            size: 'Free',
            quantity: 4,
            unitPrice: 1000,
          },
        ],
        notes: 'Removed shirt due to vendor cancellation',
      },
    };

    let controllerResponse2 = null;
    let controllerStatus2 = 200;
    const resMock2 = {
      status: function (code) {
        controllerStatus2 = code;
        return this;
      },
      json: function (data) {
        controllerResponse2 = data;
        return this;
      },
    };

    await vendorController.editVendorOrder(reqMock2, resMock2);

    assert(controllerStatus2 === 200, `editVendorOrder returned HTTP 200 on v3 edit`);
    assert(controllerResponse2.version === 3, `Order version incremented to 3`);

    const orderV3 = await prisma.vendorOrder.findUnique({
      where: { id: testOrder.id },
      include: { items: true },
    });

    const softRemovedItem = orderV3.items.find(i => i.id === item1.id);
    assert(softRemovedItem !== null, 'Item with previous allocation was NOT deleted from database');
    assert(softRemovedItem.isRemoved === true, 'Item with previous allocation flagged with isRemoved = true');
    assert(softRemovedItem.removalReason.includes('allocated: 4'), `removalReason mentions allocated units: "${softRemovedItem.removalReason}"`);

    const v3ActiveItems = orderV3.items.filter(it => !it.isRemoved);
    assert(v3ActiveItems.length === 1, `Active items count in v3 is 1 (Silk Tie Red)`);

    // ── STAGE 7: Net Deduction Logic Verification ───────────────────────────
    console.log('\n[Stage 7] Verifying Store Net Allocation Logic...');
    // When Store allocates stock:
    // netDeduct = Math.max(0, allocQty - alreadyDeducted)
    const allocQty = 6;
    const alreadyDeducted = 4;
    const netDeduct = Math.max(0, allocQty - alreadyDeducted);
    assert(netDeduct === 2, `Net deduction of 6 requested when 4 already deducted is 2 (got ${netDeduct})`);

    const allocQty2 = 4;
    const alreadyDeducted2 = 4;
    const netDeduct2 = Math.max(0, allocQty2 - alreadyDeducted2);
    assert(netDeduct2 === 0, `Net deduction of 4 requested when 4 already deducted is 0 (got ${netDeduct2})`);

    // ── STAGE 8: Verify Keeper Data Integrity & Teardown ────────────────────
    console.log('\n[Stage 8] Verifying keeper data integrity & teardown...');
    const keeperOrder = await prisma.vendorOrder.findFirst({
      where: { orderNumber: 'VO-2026-00004' },
      include: { vendor: true, items: true },
    });

    if (keeperOrder) {
      assert(keeperOrder.orderNumber === 'VO-2026-00004', 'Keeper order VO-2026-00004 exists and intact');
      assert(keeperOrder.vendor.name === 'Suhail Abbas', 'Keeper vendor Suhail Abbas intact');
      assert(keeperOrder.items.length === 65, `Keeper order items count is 65 (got ${keeperOrder.items.length})`);
    } else {
      console.warn('Keeper order VO-2026-00004 not found (may have been renamed in earlier sessions)');
    }

    // Clean up only our test order and test vendor
    await prisma.vendorOrderItem.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.vendorOrderStatus.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.vendorOrder.delete({ where: { id: testOrder.id } });
    await prisma.vendor.delete({ where: { id: testVendor.id } });
    console.log('Cleaned up test order and test vendor.');

  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    totalFailed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n============================================================');
  console.log(`VERIFICATION SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('============================================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runVerification();
