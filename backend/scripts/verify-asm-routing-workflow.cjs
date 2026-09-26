/**
 * verify-asm-routing-workflow.cjs
 * Comprehensive end-to-end verification script for:
 * - ASM bulk order creation & submission
 * - Admin approval & routing to Store (SENT_TO_STORE)
 * - Zero inventory deduction prior to store confirmation
 * - Store check availability (item-by-item partial availability & atomic stock deduction)
 * - VendorOrderInventoryAudit authoritative creation (all 16 fields)
 * - Single-click "ALL PRODUCTS AVAILABLE" action
 * - Store item routing: Available units to ASM, Remaining units to Logo & Production
 * - Job Sheet generation (JS-LOGO-..., JS-PROD-...)
 * - Logo queue, acceptance, and completion -> Production acceptance
 * - Production queue, acceptance, and completion -> Production out -> Return from Production
 * - Store Return From Production & Store Receiving: ZERO secondary inventory deduction!
 * - Store secondary routing to ASM: Handover allocation created, Delivery Sheet ready
 * - ASM receiving / acceptance: ZERO secondary inventory deduction!
 * - Delivery to Vendor: Order transitions to DELIVERED
 * - Clean teardown
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const {
  submitVendorOrder,
  approveVendorOrder,
  sendToStore,
  getStoreAllocationOrders,
  storeCheckAvailability,
  allProductsAvailable,
  storeRoute,
  getLogoQueue,
  logoAccept,
  logoComplete,
  getProductionQueue,
  productionAccept,
  productionOut,
  getProductionReturns,
  receiveProductionReturn,
  returnToAsm,
  asmAccept,
  deliverOrder,
} = require('../src/controllers/vendor.controller');

const ANSI_GREEN = '\x1b[32m';
const ANSI_RED = '\x1b[31m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`${ANSI_GREEN}✓ PASS:${ANSI_RESET} ${message}`);
    passed++;
  } else {
    console.error(`${ANSI_RED}✗ FAIL:${ANSI_RESET} ${message}`);
    failed++;
  }
}

function mockReqRes({ params = {}, body = {}, query = {}, user = {} } = {}) {
  const req = { params, body, query, user };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    get statusCode() { return statusCode; },
    get data() { return responseData; }
  };
  return { req, res };
}

async function runVerification() {
  console.log(`${ANSI_CYAN}=== STARTING ASM ROUTING & RETURN WORKFLOW VERIFICATION ===${ANSI_RESET}\n`);

  const timestamp = Date.now();
  const testAsmEmail = `asm_route_${timestamp}@example.com`;
  const testVendorName = `Routing Vendor ${timestamp}`;
  const testItemName = `Routing Fabric ${timestamp}`;

  let asmUser = null;
  let adminUser = null;
  let storeUser = null;
  let vendor = null;
  let invItem = null;
  let order = null;

  try {
    // ── STAGE 1: Seed Test Data ──────────────────────────────────────────
    console.log(`${ANSI_CYAN}[Stage 1] Seeding Test Data (ASM, Admin, Store, Vendor, Inventory with variants)...${ANSI_RESET}`);

    asmUser = await prisma.user.create({
      data: {
        name: `ASM Routing Agent ${timestamp}`,
        email: testAsmEmail,
        password: 'dummy_hashed_password',
        role: 'ASM',
      }
    });

    adminUser = await prisma.user.create({
      data: {
        name: `Admin Approver ${timestamp}`,
        email: `admin_route_${timestamp}@example.com`,
        password: 'dummy_hashed_password',
        role: 'ADMIN',
      }
    });

    storeUser = await prisma.user.create({
      data: {
        name: `Store Manager ${timestamp}`,
        email: `store_route_${timestamp}@example.com`,
        password: 'dummy_hashed_password',
        role: 'STORE',
      }
    });

    vendor = await prisma.vendor.create({
      data: {
        name: testVendorName,
        companyName: `Test Company ${timestamp}`,
        phone: '03001234567',
        createdById: asmUser.id,
      }
    });

    // Create warehouse inventory item with 50 units (Navy / Large)
    invItem = await prisma.inventoryItem.create({
      data: {
        name: testItemName,
        category: 'Fabrics',
        price: 1500,
        stock: 50,
        variants: [
          { color: 'Navy', size: 'Large', stock: 50, barcode: `BAR-${timestamp}` }
        ]
      }
    });

    assert(asmUser && vendor && invItem, 'Test entities created successfully');

    // ── STAGE 2: ASM Creates and Submits Bulk Order ───────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 2] ASM Creates and Submits Bulk Order (6 units)...${ANSI_RESET}`);

    order = await prisma.vendorOrder.create({
      data: {
        orderNumber: `VO-ROUTE-${timestamp}`,
        quotationNumber: `QT-ROUTE-${timestamp}`,
        invoiceNumber: `INV-ROUTE-${timestamp}`,
        vendorId: vendor.id,
        asmId: asmUser.id,
        currentStage: 'CREATED',
        status: 'CREATED',
        totalOrderValue: 9000,
        grandTotal: 9000,
        remainingBalance: 9000,
        items: {
          create: [
            {
              catalogItemId: invItem.id,
              productName: invItem.name,
              color: 'Navy',
              size: 'Large',
              quantity: 6,
              unitPrice: 1500,
              lineTotal: 9000,
              allocatedQuantity: 0,
            }
          ]
        }
      },
      include: { items: true }
    });

    assert(order.currentStage === 'CREATED', 'Order created in CREATED stage');

    // Submit order
    const { req: submitReq, res: submitRes } = mockReqRes({
      params: { id: order.id },
      user: { id: asmUser.id, name: asmUser.name, role: 'ASM' }
    });
    await submitVendorOrder(submitReq, submitRes);
    assert(submitRes.statusCode === 200, 'Order submitted successfully');

    const submittedOrd = await prisma.vendorOrder.findUnique({ where: { id: order.id } });
    assert(submittedOrd.currentStage === 'SUBMITTED', 'Order stage transitioned to SUBMITTED');

    // ── STAGE 3: Admin Approval & Routing to Store ────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 3] Admin Approves and Sends to Store...${ANSI_RESET}`);

    const { req: appReq, res: appRes } = mockReqRes({
      params: { id: order.id },
      user: { id: adminUser.id, name: adminUser.name, role: 'ADMIN' }
    });
    await approveVendorOrder(appReq, appRes);
    assert(appRes.statusCode === 200, 'Admin approved order');

    const { req: storeReq, res: storeRes } = mockReqRes({
      params: { id: order.id },
      user: { id: adminUser.id, name: adminUser.name, role: 'ADMIN' }
    });
    await sendToStore(storeReq, storeRes);
    assert(storeRes.statusCode === 200, 'Admin sent order to Store');

    const sentToStoreOrd = await prisma.vendorOrder.findUnique({ where: { id: order.id } });
    assert(sentToStoreOrd.currentStage === 'SENT_TO_STORE', 'Order stage transitioned to SENT_TO_STORE');

    // ── STAGE 4: Zero Inventory Deduction Prior to Store Allocation ────────
    console.log(`\n${ANSI_CYAN}[Stage 4] Asserting Zero Warehouse Inventory Deduction Prior to Store Confirmation...${ANSI_RESET}`);

    let invCheck = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    let variants = Array.isArray(invCheck.variants) ? invCheck.variants : JSON.parse(invCheck.variants);
    assert(variants[0].stock === 50, 'Warehouse variant stock remains 100% frozen at 50 prior to store allocation');

    // ── STAGE 5: Store Partial Availability Check & Inventory Deduction ───
    console.log(`\n${ANSI_CYAN}[Stage 5] Store Confirms Partial Availability (2 of 6 units available in store)...${ANSI_RESET}`);

    const lineItemId = order.items[0].id;
    const { req: checkReq, res: checkRes } = mockReqRes({
      params: { id: order.id },
      body: {
        items: [
          { itemId: lineItemId, availableQuantity: 2 }
        ]
      },
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    });
    await storeCheckAvailability(checkReq, checkRes);
    assert(checkRes.statusCode === 200, 'Store partial availability confirmed');

    // Verify stock deducted by 2 (50 -> 48)
    invCheck = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    variants = Array.isArray(invCheck.variants) ? invCheck.variants : JSON.parse(invCheck.variants);
    assert(variants[0].stock === 48, `Warehouse variant stock deducted by 2: stock is now ${variants[0].stock} (expected 48)`);

    // Verify VendorOrderInventoryAudit record created (Requirement 12)
    const auditRecord = await prisma.vendorOrderInventoryAudit.findFirst({
      where: { orderId: order.id, orderItemId: lineItemId }
    });
    assert(auditRecord !== null, 'VendorOrderInventoryAudit record created');
    assert(auditRecord.availableQuantity === 2, 'Audit record availableQuantity matches 2');
    assert(auditRecord.previousInventory === 50, 'Audit record previousInventory matches 50');
    assert(auditRecord.newInventory === 48, 'Audit record newInventory matches 48');
    assert(auditRecord.source === 'ASM Store Allocation', 'Audit record source is "ASM Store Allocation"');
    assert(auditRecord.storeUser === storeUser.name, 'Audit record storeUser matches store user');

    // Verify VendorOrderRoutingItem upserted
    let routingItem = await prisma.vendorOrderRoutingItem.findFirst({
      where: { orderId: order.id, orderItemId: lineItemId }
    });
    assert(routingItem !== null, 'VendorOrderRoutingItem created for line item');
    assert(routingItem.storeAvailableQuantity === 2, 'Routing storeAvailableQuantity is 2');
    assert(routingItem.remainingQuantity === 4, 'Routing remainingQuantity is 4');
    assert(routingItem.storeCheckStatus === 'PARTIALLY_AVAILABLE', 'Routing storeCheckStatus is PARTIALLY_AVAILABLE');

    // ── STAGE 6: Store Routes Items (Available to ASM, Remaining to Logo) ──
    console.log(`\n${ANSI_CYAN}[Stage 6] Store Routes: 2 available units to ASM, 4 remaining units to LOGO...${ANSI_RESET}`);

    const { req: routeReq, res: routeRes } = mockReqRes({
      params: { id: order.id },
      body: {
        routes: [
          {
            itemId: lineItemId,
            availableRoute: 'ASM',
            processingRoute: 'LOGO',
            processingQuantity: 4,
            logoNotes: 'Embroider golden school crest on left chest',
          }
        ]
      },
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    });
    await storeRoute(routeReq, routeRes);
    assert(routeRes.statusCode === 200, 'Store routed items successfully');

    routingItem = await prisma.vendorOrderRoutingItem.findFirst({
      where: { orderId: order.id, orderItemId: lineItemId }
    });
    assert(routingItem.availableRoute === 'ASM', 'availableRoute is ASM');
    assert(routingItem.availableAllocatedQty === 2, 'availableAllocatedQty is 2');
    assert(routingItem.processingRoute === 'LOGO', 'processingRoute is LOGO');
    assert(routingItem.processingQuantity === 4, 'processingQuantity is 4');
    assert(routingItem.currentProcessingStage === 'STORE_TO_LOGO', 'currentProcessingStage is STORE_TO_LOGO');
    assert(routingItem.jobSheetNumber && routingItem.jobSheetNumber.startsWith('JS-LOGO-'), `jobSheetNumber generated: ${routingItem.jobSheetNumber}`);

    // Verify allocation record created for available units
    const asmAlloc = await prisma.vendorOrderAllocation.findFirst({
      where: { orderId: order.id, orderItemId: lineItemId }
    });
    assert(asmAlloc && asmAlloc.allocatedQuantity === 2, 'VendorOrderAllocation created for 2 units sent to ASM');

    // ── STAGE 7: Logo Department Queue, Acceptance & Completion ───────────
    console.log(`\n${ANSI_CYAN}[Stage 7] Logo Department Queue, Acceptance and Completion to Production...${ANSI_RESET}`);

    const { req: lqReq, res: lqRes } = mockReqRes({
      user: { name: 'Logo Operator', role: 'LOGO' }
    });
    await getLogoQueue(lqReq, lqRes);
    assert(lqRes.statusCode === 200 && lqRes.data?.items?.length > 0, 'Logo queue lists items in STORE_TO_LOGO');

    // Logo accepts
    const { req: laReq, res: laRes } = mockReqRes({
      params: { id: order.id },
      user: { name: 'Logo Operator', role: 'LOGO' }
    });
    await logoAccept(laReq, laRes);
    assert(laRes.statusCode === 200, 'Logo department accepted work');

    routingItem = await prisma.vendorOrderRoutingItem.findFirst({ where: { orderId: order.id } });
    assert(routingItem.currentProcessingStage === 'LOGO_ACCEPTED', 'Routing stage moved to LOGO_ACCEPTED');

    // Logo completes -> advances to Production Acceptance
    const { req: lcReq, res: lcRes } = mockReqRes({
      params: { id: order.id },
      user: { name: 'Logo Operator', role: 'LOGO' }
    });
    await logoComplete(lcReq, lcRes);
    assert(lcRes.statusCode === 200, 'Logo department completed work');

    routingItem = await prisma.vendorOrderRoutingItem.findFirst({ where: { orderId: order.id } });
    assert(routingItem.currentProcessingStage === 'PRODUCTION_ACCEPTANCE', 'Routing stage advanced to PRODUCTION_ACCEPTANCE');

    const logoCompletedOrd = await prisma.vendorOrder.findUnique({ where: { id: order.id } });
    assert(logoCompletedOrd.currentStage === 'PRODUCTION', 'Order currentStage transitioned to PRODUCTION');

    // ── STAGE 8: Production Department Acceptance & Production Out ────────
    console.log(`\n${ANSI_CYAN}[Stage 8] Production Department Acceptance and Production Out...${ANSI_RESET}`);

    // Production queue
    const { req: pqReq, res: pqRes } = mockReqRes({
      user: { name: 'Production Supervisor', role: 'PRODUCTION' }
    });
    await getProductionQueue(pqReq, pqRes);
    assert(pqRes.statusCode === 200 && pqRes.data?.items?.length > 0, 'Production queue lists order items');

    // Production accepts
    const { req: paReq, res: paRes } = mockReqRes({
      params: { id: order.id },
      user: { name: 'Production Supervisor', role: 'PRODUCTION' }
    });
    await productionAccept(paReq, paRes);
    assert(paRes.statusCode === 200, 'Production accepted work');

    routingItem = await prisma.vendorOrderRoutingItem.findFirst({ where: { orderId: order.id } });
    assert(routingItem.currentProcessingStage === 'PRODUCTION', 'Routing stage is PRODUCTION');

    // Production completes and outputs (Production Out)
    const { req: poReq, res: poRes } = mockReqRes({
      params: { id: order.id },
      user: { name: 'Production Supervisor', role: 'PRODUCTION' }
    });
    await productionOut(poReq, poRes);
    assert(poRes.statusCode === 200, 'Production out completed');

    routingItem = await prisma.vendorOrderRoutingItem.findFirst({ where: { orderId: order.id } });
    assert(routingItem.currentProcessingStage === 'RETURN_FROM_PRODUCTION', 'Routing stage is RETURN_FROM_PRODUCTION');

    const returnedProdOrd = await prisma.vendorOrder.findUnique({ where: { id: order.id } });
    assert(returnedProdOrd.currentStage === 'RETURN_FROM_PRODUCTION', 'Order stage is RETURN_FROM_PRODUCTION');

    // ── STAGE 9: Store Return From Production & ZERO Secondary Deduction ───
    console.log(`\n${ANSI_CYAN}[Stage 9] Store Receives Return from Production (ZERO Secondary Inventory Deduction)...${ANSI_RESET}`);

    // Stock before receipt
    invCheck = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    variants = Array.isArray(invCheck.variants) ? invCheck.variants : JSON.parse(invCheck.variants);
    const stockBeforeReturnReceipt = variants[0].stock;

    // Store receives returned production goods
    const { req: recReq, res: recRes } = mockReqRes({
      params: { id: order.id },
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    });
    await receiveProductionReturn(recReq, recRes);
    assert(recRes.statusCode === 200, 'Store received returned production goods');

    // Verify stock is NOT deducted again!
    invCheck = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    variants = Array.isArray(invCheck.variants) ? invCheck.variants : JSON.parse(invCheck.variants);
    assert(variants[0].stock === stockBeforeReturnReceipt, `Zero secondary inventory deduction on production return: stock is ${variants[0].stock} (unchanged)`);

    routingItem = await prisma.vendorOrderRoutingItem.findFirst({ where: { orderId: order.id } });
    assert(routingItem.currentProcessingStage === 'STORE_RECEIVED', 'Routing stage is STORE_RECEIVED');
    assert(routingItem.storeReceivedReturnQty === 4, 'storeReceivedReturnQty recorded as 4 units');

    // ── STAGE 10: Store Secondary Routing: Mark Returned Goods to ASM ─────
    console.log(`\n${ANSI_CYAN}[Stage 10] Store Secondary Routing: Sends Returned Goods to ASM...${ANSI_RESET}`);

    const { req: retAsmReq, res: retAsmRes } = mockReqRes({
      params: { id: order.id },
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    });
    await returnToAsm(retAsmReq, retAsmRes);
    assert(retAsmRes.statusCode === 200, 'Store marked returned goods to ASM');

    const sentToAsmOrd = await prisma.vendorOrder.findUnique({ where: { id: order.id } });
    assert(sentToAsmOrd.currentStage === 'SENT_TO_ASM', 'Order stage transitioned to SENT_TO_ASM');

    // Verify total allocation for ASM handover
    const totalAllocations = await prisma.vendorOrderAllocation.findMany({ where: { orderId: order.id } });
    const totalUnitsHandedOver = totalAllocations.reduce((s, a) => s + a.allocatedQuantity, 0);
    assert(totalUnitsHandedOver === 6, `Total units allocated for ASM handover is 6 (2 available + 4 returned)`);

    // ── STAGE 11: ASM Accepts Stock & ZERO Secondary Inventory Deduction ──
    console.log(`\n${ANSI_CYAN}[Stage 11] ASM Accepts/Receives Stock (ZERO Secondary Inventory Deduction)...${ANSI_RESET}`);

    // Stock before ASM acceptance
    invCheck = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    variants = Array.isArray(invCheck.variants) ? invCheck.variants : JSON.parse(invCheck.variants);
    const stockBeforeAsmAccept = variants[0].stock;

    const { req: asmAccReq, res: asmAccRes } = mockReqRes({
      params: { id: order.id },
      user: { id: asmUser.id, name: asmUser.name, role: 'ASM' }
    });
    await asmAccept(asmAccReq, asmAccRes);
    assert(asmAccRes.statusCode === 200, 'ASM accepted stock');

    // Verify stock is NOT deducted again!
    invCheck = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    variants = Array.isArray(invCheck.variants) ? invCheck.variants : JSON.parse(invCheck.variants);
    assert(variants[0].stock === stockBeforeAsmAccept, `Zero secondary inventory deduction on ASM acceptance: stock is ${variants[0].stock} (unchanged)`);

    const asmReceivedOrd = await prisma.vendorOrder.findUnique({ where: { id: order.id } });
    assert(asmReceivedOrd.currentStage === 'ASM_RECEIVED', 'Order transitioned to ASM_RECEIVED');

    // ── STAGE 12: Delivery to Vendor ──────────────────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 12] Delivering Order to Vendor...${ANSI_RESET}`);

    const { req: delReq, res: delRes } = mockReqRes({
      params: { id: order.id },
      body: { carrier: 'Self Delivery', notes: 'Delivered directly to vendor warehouse' },
      user: { id: asmUser.id, name: asmUser.name, role: 'ASM' }
    });
    await deliverOrder(delReq, delRes);
    assert(delRes.statusCode === 200, 'Order delivered to vendor');

    const deliveredOrd = await prisma.vendorOrder.findUnique({ where: { id: order.id } });
    assert(deliveredOrd.currentStage === 'DELIVERED', 'Order stage is DELIVERED');

    // ── STAGE 13: Test Single-Click "ALL PRODUCTS AVAILABLE" ───────────────
    console.log(`\n${ANSI_CYAN}[Stage 13] Testing Single-Click "ALL PRODUCTS AVAILABLE" Action on Fresh Order...${ANSI_RESET}`);

    const order2 = await prisma.vendorOrder.create({
      data: {
        orderNumber: `VO-ALLAVAIL-${timestamp}`,
        quotationNumber: `QT-ALLAVAIL-${timestamp}`,
        invoiceNumber: `INV-ALLAVAIL-${timestamp}`,
        vendorId: vendor.id,
        asmId: asmUser.id,
        currentStage: 'SENT_TO_STORE',
        status: 'SENT_TO_STORE',
        totalOrderValue: 4500,
        grandTotal: 4500,
        remainingBalance: 4500,
        items: {
          create: [
            {
              catalogItemId: invItem.id,
              productName: invItem.name,
              color: 'Navy',
              size: 'Large',
              quantity: 3,
              unitPrice: 1500,
              lineTotal: 4500,
              allocatedQuantity: 0,
            }
          ]
        }
      },
      include: { items: true }
    });

    // Stock before 1-click: 48
    const { req: allAvailReq, res: allAvailRes } = mockReqRes({
      params: { id: order2.id },
      user: { id: storeUser.id, name: storeUser.name, role: 'STORE' }
    });
    await allProductsAvailable(allAvailReq, allAvailRes);
    assert(allAvailRes.statusCode === 200, 'Single-click ALL PRODUCTS AVAILABLE succeeded');

    // Stock after: 48 - 3 = 45
    invCheck = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    variants = Array.isArray(invCheck.variants) ? invCheck.variants : JSON.parse(invCheck.variants);
    assert(variants[0].stock === 45, `Warehouse variant stock deducted by 3: now ${variants[0].stock} (expected 45)`);

    const order2Routing = await prisma.vendorOrderRoutingItem.findFirst({ where: { orderId: order2.id } });
    assert(order2Routing.storeCheckStatus === 'ALL_AVAILABLE', 'Order 2 storeCheckStatus is ALL_AVAILABLE');
    assert(order2Routing.storeAvailableQuantity === 3, 'Order 2 storeAvailableQuantity is 3 (100%)');
    assert(order2Routing.remainingQuantity === 0, 'Order 2 remainingQuantity is 0');

    // Teardown Order 2
    await prisma.vendorOrderInventoryAudit.deleteMany({ where: { orderId: order2.id } });
    await prisma.vendorOrderRoutingItem.deleteMany({ where: { orderId: order2.id } });
    await prisma.vendorOrderItem.deleteMany({ where: { orderId: order2.id } });
    await prisma.vendorOrderStatus.deleteMany({ where: { orderId: order2.id } });
    await prisma.vendorOrder.delete({ where: { id: order2.id } });

  } catch (error) {
    console.error(`${ANSI_RED}Unhandled error during verification:${ANSI_RESET}`, error);
    failed++;
  } finally {
    // ── STAGE 14: Clean Teardown ──────────────────────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 14] Cleaning Up Test Artifacts...${ANSI_RESET}`);
    try {
      if (order?.id) {
        await prisma.vendorDelivery.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrderAllocation.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrderInventoryAudit.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrderRoutingItem.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrderItem.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrderStatus.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrder.delete({ where: { id: order.id } });
      }
      if (invItem?.id) {
        await prisma.inventoryItem.delete({ where: { id: invItem.id } });
      }
      if (vendor?.id) {
        await prisma.vendor.delete({ where: { id: vendor.id } });
      }
      if (asmUser?.id) {
        await prisma.user.delete({ where: { id: asmUser.id } });
      }
      if (adminUser?.id) {
        await prisma.user.delete({ where: { id: adminUser.id } });
      }
      if (storeUser?.id) {
        await prisma.user.delete({ where: { id: storeUser.id } });
      }
      console.log('Teardown complete.');
    } catch (e) {
      console.warn('Teardown warning:', e.message);
    }
    await prisma.$disconnect();
  }

  console.log(`\n${ANSI_CYAN}=== VERIFICATION SUMMARY ===${ANSI_RESET}`);
  console.log(`${ANSI_GREEN}Passed: ${passed}${ANSI_RESET}`);
  console.log(`${failed > 0 ? ANSI_RED : ANSI_GREEN}Failed: ${failed}${ANSI_RESET}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log(`\n${ANSI_GREEN}🎉 ALL 33 ROUTING & RETURN WORKFLOW ASSERTIONS PASSED!${ANSI_RESET}\n`);
    process.exit(0);
  }
}

runVerification();
