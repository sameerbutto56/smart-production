const assert = require('assert');
const prisma = require('../src/prisma');
const vendorController = require('../src/controllers/vendor.controller');

async function runTests() {
  console.log('🚀 Starting ASM Bulk Order Admin Approval & Workflow Verification...\n');

  const createdOrderIds = [];
  let testVendorId = null;
  let testItemId = null;
  let originalVariantStock = 0;

  try {
    // 1. Create a Test Vendor
    const uniqueSuffix = Date.now().toString().slice(-6);
    const vendor = await prisma.vendor.create({
      data: {
        name: `Test Vendor Approval ${uniqueSuffix}`,
        companyName: `Test Corp ${uniqueSuffix}`,
        phone: `0300${uniqueSuffix}`,
        city: 'Lahore',
      },
    });
    testVendorId = vendor.id;
    console.log(`✅ 1. Created test vendor: ${vendor.name} (${vendor.id})`);

    // 2. Create isolated InventoryItem for allocation testing
    const invItem = await prisma.inventoryItem.create({
      data: {
        name: `Approval Test Product ${uniqueSuffix}`,
        category: 'Scrubs',
        color: 'Navy',
        size: 'M',
        stock: 50,
        variants: [{ color: 'Navy', size: 'M', stock: 50 }],
      },
    });
    testItemId = invItem.id;
    originalVariantStock = 50;
    const variants = invItem.variants;
    console.log(`✅ 2. Created dedicated inventory item: ${invItem.name}, variant stock: ${originalVariantStock}`);

    // Helper for mock req/res
    function mockReq(user, params = {}, body = {}, query = {}) {
      return { user, params, body, query };
    }
    function mockRes() {
      const res = {
        statusCode: 200,
        data: null,
        status(c) { res.statusCode = c; return res; },
        json(d) { res.data = d; return res; },
      };
      return res;
    }

    const adminUser = { id: 'admin-test-id', name: 'Super Admin', role: 'SUPER_ADMIN' };
    const realAsm = await prisma.user.findFirst({ where: { role: 'ASM' } });
    const asmUser = realAsm ? { id: realAsm.id, name: realAsm.name, role: 'ASM' } : { id: null, name: 'Test ASM', role: 'ASM' };

    // 3. Step 1 — ASM creates bulk order (auto-submits to SUBMITTED / AWAITED ADMIN)
    const reqCreate = mockReq(asmUser, {}, {
      vendorId: testVendorId,
      items: [
        {
          catalogItemId: testItemId,
          productName: invItem.name,
          color: variants[0]?.color || 'Navy',
          size: variants[0]?.size || 'M',
          quantity: 10,
          unitPrice: 1500,
        },
      ],
      deliveryCharges: 200,
      notes: 'Test ASM approval bulk order',
    });
    const resCreate = mockRes();
    await vendorController.createVendorOrder(reqCreate, resCreate);
    assert(resCreate.statusCode === 201, `Order creation succeeded with 201 (got ${resCreate.statusCode})`);
    const order1 = resCreate.data.order;
    createdOrderIds.push(order1.id);
    console.log(`✅ 3. ASM created Bulk Order: ${order1.orderNumber} (Stage: ${order1.currentStage}, Status: ${order1.status})`);
    assert(order1.currentStage === 'SUBMITTED', 'Order currentStage is SUBMITTED');
    assert(order1.status === 'SUBMITTED', 'Order status is SUBMITTED');

    // 4. Step 2 — Admin queries order list, verify permission and approval flags
    const reqList = mockReq(adminUser, {}, {}, { status: 'SUBMITTED' });
    const resList = mockRes();
    await vendorController.listVendorOrders(reqList, resList);
    assert(resList.statusCode === 200, 'listVendorOrders returned 200');
    const listedOrder1 = resList.data.orders.find(o => o.id === order1.id);
    assert(listedOrder1, 'Order appears in listVendorOrders');
    assert(listedOrder1.canApprove === true, 'Admin canApprove is true for AWAITED ADMIN order');
    assert(listedOrder1.canSendToStore === false, 'canSendToStore is FALSE before approval');
    assert(listedOrder1.canBuyItself === false, 'canBuyItself is FALSE before approval');
    console.log(`✅ 4. Verified order flags before approval: canApprove=${listedOrder1.canApprove}, canSendToStore=${listedOrder1.canSendToStore}, canBuyItself=${listedOrder1.canBuyItself}`);

    // 5. Step 3 — Guard check: Attempting Send to Store before approval must FAIL
    const reqEarlyStore = mockReq(adminUser, { id: order1.id });
    const resEarlyStore = mockRes();
    await vendorController.sendToStore(reqEarlyStore, resEarlyStore);
    assert(resEarlyStore.statusCode === 400, `Early send-to-store correctly rejected with 400 (got ${resEarlyStore.statusCode})`);
    console.log(`✅ 5. Guard verified: Send to Store before Admin approval was rejected: ${resEarlyStore.data.message}`);

    // 6. Step 4 — Guard check: Attempting Buy Itself before approval must FAIL
    const reqEarlyBuy = mockReq(adminUser, { id: order1.id });
    const resEarlyBuy = mockRes();
    await vendorController.buyItself(reqEarlyBuy, resEarlyBuy);
    assert(resEarlyBuy.statusCode === 400, `Early buy-itself correctly rejected with 400 (got ${resEarlyBuy.statusCode})`);
    console.log(`✅ 6. Guard verified: Buy Itself before Admin approval was rejected: ${resEarlyBuy.data.message}`);

    // 7. Step 5 — Admin Approves the order
    const reqApprove = mockReq(adminUser, { id: order1.id });
    const resApprove = mockRes();
    await vendorController.approveVendorOrder(reqApprove, resApprove);
    assert(resApprove.statusCode === 200, `approveVendorOrder returned 200 (got ${resApprove.statusCode})`);
    const approvedOrder = resApprove.data.order;
    assert(approvedOrder.currentStage === 'ADMIN_APPROVED', 'Order currentStage transitioned to ADMIN_APPROVED');
    assert(approvedOrder.status === 'ADMIN_APPROVED', 'Order status transitioned to ADMIN_APPROVED');
    assert(approvedOrder.adminApprovedAt != null, 'adminApprovedAt timestamp recorded');
    assert(approvedOrder.approvedByName === adminUser.name, `approvedByName recorded as ${adminUser.name}`);

    // Verify audit history was recorded in database
    const auditStatus = await prisma.vendorOrderStatus.findFirst({
      where: { orderId: order1.id, status: 'ADMIN_APPROVED' },
    });
    assert(auditStatus, 'VendorOrderStatus audit record created for ADMIN_APPROVED');
    assert(auditStatus.changedBy === adminUser.name, 'Audit record changedBy is Admin');
    console.log(`✅ 7. Admin approved order: Stage=${approvedOrder.currentStage}, ApprovedBy=${approvedOrder.approvedByName}, Audit=${auditStatus.status}`);

    // 8. Step 6 — Verify order flags after approval: canApprove is now false, canSendToStore & canBuyItself are now true
    const reqGet = mockReq(adminUser, { id: order1.id });
    const resGet = mockRes();
    await vendorController.getVendorOrder(reqGet, resGet);
    assert(resGet.statusCode === 200, 'getVendorOrder returned 200');
    assert(resGet.data.order.canApprove === false, 'canApprove is false after approval');
    assert(resGet.data.order.canSendToStore === true, 'canSendToStore is now TRUE');
    assert(resGet.data.order.canBuyItself === true, 'canBuyItself is now TRUE');
    console.log(`✅ 8. Verified unlocked actions after approval: canSendToStore=${resGet.data.order.canSendToStore}, canBuyItself=${resGet.data.order.canBuyItself}`);

    // 9. Step 7 — Admin selects SEND TO STORE (Workflow Path A)
    const reqSendStore = mockReq(adminUser, { id: order1.id });
    const resSendStore = mockRes();
    await vendorController.sendToStore(reqSendStore, resSendStore);
    assert(resSendStore.statusCode === 200, `sendToStore returned 200 (got ${resSendStore.statusCode})`);
    assert(resSendStore.data.order.currentStage === 'SENT_TO_STORE', 'currentStage is SENT_TO_STORE');
    assert(resSendStore.data.order.fulfillmentMethod === 'SEND_TO_STORE', 'fulfillmentMethod is SEND_TO_STORE');

    // CRITICAL RULE: Verify inventory is NOT deducted yet
    const invCheck1 = await prisma.inventoryItem.findUnique({ where: { id: testItemId } });
    const varCheck1 = Array.isArray(invCheck1.variants)
      ? invCheck1.variants
      : (typeof invCheck1.variants === 'string' ? JSON.parse(invCheck1.variants) : []);
    const stockAfterSend = parseInt(varCheck1[0]?.stock, 10);
    assert(stockAfterSend === originalVariantStock, `Inventory NOT deducted on send-to-store (Stock: ${stockAfterSend} === ${originalVariantStock})`);
    console.log(`✅ 9. Order sent to Store: currentStage=${resSendStore.data.order.currentStage}, Inventory stock remains unchanged: ${stockAfterSend}`);

    // 10. Step 8 — Store Allocation: Store checks available stock and allocates 10 units
    const reqStoreList = mockReq({ role: 'STORE', name: 'Store Keeper' });
    const resStoreList = mockRes();
    await vendorController.getStoreAllocationOrders(reqStoreList, resStoreList);
    assert(resStoreList.statusCode === 200, 'getStoreAllocationOrders returned 200');
    const storeOrder = resStoreList.data.orders.find(o => o.id === order1.id);
    assert(storeOrder, 'Order visible in Store Allocation');
    assert(storeOrder.items[0].availableWarehouseStock != null, 'Item has availableWarehouseStock enriched');

    // Store confirms allocation
    const reqAlloc = mockReq(
      { role: 'STORE', name: 'Store Keeper', id: 'store-user-id' },
      { id: order1.id },
      { allocations: [{ itemId: storeOrder.items[0].id, allocatedQuantity: 10 }] }
    );
    const resAlloc = mockRes();
    await vendorController.storeAllocate(reqAlloc, resAlloc);
    assert(resAlloc.statusCode === 200, `storeAllocate returned 200 (got ${resAlloc.statusCode})`);
    assert(resAlloc.data.order.currentStage === 'SENT_TO_ASM', 'currentStage transitioned to SENT_TO_ASM');

    // CRITICAL RULE: Inventory IS deducted NOW on Store Allocation
    const invCheck2 = await prisma.inventoryItem.findUnique({ where: { id: testItemId } });
    const varCheck2 = Array.isArray(invCheck2.variants)
      ? invCheck2.variants
      : (typeof invCheck2.variants === 'string' ? JSON.parse(invCheck2.variants) : []);
    const stockAfterAlloc = parseInt(varCheck2[0]?.stock, 10);
    assert(stockAfterAlloc === originalVariantStock - 10, `Inventory deducted by 10 on Store Allocation (${originalVariantStock} -> ${stockAfterAlloc})`);
    console.log(`✅ 10. Store allocated 10 units: Stage=${resAlloc.data.order.currentStage}, Inventory stock deducted to: ${stockAfterAlloc}`);

    // 11. Step 9 — ASM receives/accepts stock
    const reqAccept = mockReq(asmUser, { id: order1.id });
    const resAccept = mockRes();
    await vendorController.asmAccept(reqAccept, resAccept);
    assert(resAccept.statusCode === 200, `asmAccept returned 200 (got ${resAccept.statusCode})`);
    assert(resAccept.data.order.currentStage === 'ASM_ACCEPTED', 'currentStage transitioned to ASM_ACCEPTED');
    console.log(`✅ 11. ASM accepted allocated stock: Stage=${resAccept.data.order.currentStage}`);

    // 12. Step 10 — Test BUY ITSELF (Workflow Path B) on a second order
    const reqCreate2 = mockReq(asmUser, {}, {
      vendorId: testVendorId,
      items: [
        {
          catalogItemId: testItemId,
          productName: invItem.name,
          color: variants[0]?.color || 'Navy',
          size: variants[0]?.size || 'M',
          quantity: 5,
          unitPrice: 1500,
        },
      ],
      notes: 'Test Buy Itself workflow',
    });
    const resCreate2 = mockRes();
    await vendorController.createVendorOrder(reqCreate2, resCreate2);
    const order2 = resCreate2.data.order;
    createdOrderIds.push(order2.id);

    // Admin approves order 2
    const reqApprove2 = mockReq(adminUser, { id: order2.id });
    const resApprove2 = mockRes();
    await vendorController.approveVendorOrder(reqApprove2, resApprove2);
    assert(resApprove2.statusCode === 200, 'Order 2 approved');

    // Admin selects BUY ITSELF
    const reqBuy2 = mockReq(adminUser, { id: order2.id });
    const resBuy2 = mockRes();
    await vendorController.buyItself(reqBuy2, resBuy2);
    assert(resBuy2.statusCode === 200, `buyItself returned 200 (got ${resBuy2.statusCode})`);
    assert(resBuy2.data.order.currentStage === 'BUY_ITSELF', 'Order 2 currentStage is BUY_ITSELF');
    assert(resBuy2.data.order.fulfillmentMethod === 'BUY_ITSELF', 'Order 2 fulfillmentMethod is BUY_ITSELF');

    // Verify Buy Itself does NOT deduct warehouse inventory
    const invCheck3 = await prisma.inventoryItem.findUnique({ where: { id: testItemId } });
    const varCheck3 = Array.isArray(invCheck3.variants)
      ? invCheck3.variants
      : (typeof invCheck3.variants === 'string' ? JSON.parse(invCheck3.variants) : []);
    const stockAfterBuyItself = parseInt(varCheck3[0]?.stock, 10);
    assert(stockAfterBuyItself === stockAfterAlloc, `Buy Itself did NOT deduct warehouse stock (${stockAfterBuyItself} === ${stockAfterAlloc})`);
    console.log(`✅ 12. Buy Itself path verified: Stage=${resBuy2.data.order.currentStage}, fulfillmentMethod=${resBuy2.data.order.fulfillmentMethod}, Zero inventory deduction`);

    console.log('\n✨ ALL ASM BULK ORDER APPROVAL & WORKFLOW VERIFICATIONS PASSED (100%)!\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    console.log('--- Cleaning up test records ---');
    if (createdOrderIds.length > 0) {
      await prisma.vendorOrderStatus.deleteMany({ where: { orderId: { in: createdOrderIds } } }).catch(() => {});
      await prisma.vendorOrderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } }).catch(() => {});
      await prisma.vendorPayment.deleteMany({ where: { orderId: { in: createdOrderIds } } }).catch(() => {});
      await prisma.vendorOrder.deleteMany({ where: { id: { in: createdOrderIds } } }).catch(() => {});
      console.log(`✅ Deleted ${createdOrderIds.length} test vendor orders`);
    }
    if (testVendorId) {
      await prisma.vendor.delete({ where: { id: testVendorId } }).catch(() => {});
      console.log('✅ Deleted test vendor');
    }
    if (testItemId) {
      await prisma.inventoryItem.delete({ where: { id: testItemId } }).catch(() => {});
      console.log('✅ Deleted test inventory item');
    }
  }
}

runTests();
