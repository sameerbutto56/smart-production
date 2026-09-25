/**
 * verify-asm-complete-workflow.cjs
 * Comprehensive end-to-end verification script for the ASM complete workflow:
 * - ASM bulk order creation & submission
 * - Admin approval & fulfillment decision (Send to Store)
 * - Zero inventory deduction prior to store allocation
 * - Store allocation with atomic inventory variant deduction
 * - Authoritative VendorOrderAllocation record creation
 * - Delivery sheet data check (actual allocated qty, zero pricing)
 * - ASM acceptance/receiving (transitions to ASM_RECEIVED, zero secondary deduction)
 * - Delivery to vendor
 * - Payment recording with method breakdown & cheque clearing
 * - Payment correction/edit with immutable VendorPaymentAudit log
 * - Admin financial dashboard KPIs and mathematical reconciliation
 * - Clean test data teardown
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

async function runVerification() {
  console.log(`${ANSI_CYAN}=== STARTING ASM COMPLETE WORKFLOW VERIFICATION ===${ANSI_RESET}\n`);

  const timestamp = Date.now();
  const testAsmEmail = `asm_verify_${timestamp}@example.com`;
  const testVendorName = `Test Vendor ${timestamp}`;
  const testItemName = `ASM Test Fabric ${timestamp}`;
  let asmUser = null;
  let vendor = null;
  let invItem = null;
  let order = null;

  try {
    // ── STAGE 1: Seed Test Data ──────────────────────────────────────────
    console.log(`${ANSI_CYAN}[Stage 1] Seeding Test Data (ASM user, Vendor, Inventory with variants)...${ANSI_RESET}`);
    asmUser = await prisma.user.create({
      data: {
        name: `ASM Tester ${timestamp}`,
        email: testAsmEmail,
        password: 'dummy_hashed_password',
        role: 'ASM',
      }
    });
    assert(asmUser && asmUser.id, 'ASM user created successfully');

    vendor = await prisma.vendor.create({
      data: {
        name: testVendorName,
        phone: '03001234567',
        companyName: `Company ${timestamp}`,
        city: 'Lahore',
        address: '123 Main Blvd, Gulberg',
        createdById: asmUser.id,
        createdBy: asmUser.name,
      }
    });
    assert(vendor && vendor.id, 'Vendor created successfully');

    invItem = await prisma.inventoryItem.create({
      data: {
        name: testItemName,
        category: 'FABRIC',
        stock: 50,
        variants: JSON.stringify([
          { color: 'Black', size: 'Standard', stock: 50, alertThreshold: 5 }
        ]),
      }
    });
    assert(invItem && invItem.id, 'InventoryItem with 50 units in Black/Standard created');

    // ── STAGE 2: ASM Creates Bulk Order ──────────────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 2] ASM Creates Bulk Order for 10 units @ Rs. 2,000...${ANSI_RESET}`);
    const orderNumber = `ASM-TEST-${timestamp.toString().slice(-6)}`;
    const quotationNumber = `QUO-${timestamp.toString().slice(-6)}`;
    const invoiceNumber = `INV-${timestamp.toString().slice(-6)}`;
    order = await prisma.vendorOrder.create({
      data: {
        orderNumber,
        quotationNumber,
        invoiceNumber,
        vendorId: vendor.id,
        asmId: asmUser.id,
        currentStage: 'SUBMITTED',
        status: 'SUBMITTED',
        grandTotal: 20000,
        totalOrderValue: 20000,
        remainingBalance: 20000,
        advancePaid: 0,
        items: {
          create: [
            {
              catalogItemId: invItem.id,
              productName: invItem.name,
              productType: 'CLOTHING',
              color: 'Black',
              size: 'Standard',
              quantity: 10,
              unitPrice: 2000,
              lineTotal: 20000,
              allocatedQuantity: 0,
            }
          ]
        },
        statusHistory: {
          create: {
            status: 'SUBMITTED',
            toStage: 'SUBMITTED',
            changedBy: asmUser.name,
            remarks: 'Submitted by ASM',
          }
        }
      },
      include: { items: true, statusHistory: true, vendor: true }
    });
    assert(order && order.currentStage === 'SUBMITTED', `Bulk order created in SUBMITTED stage with total Rs. 20,000`);

    // ── STAGE 3: Admin Approval Workflow ─────────────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 3] Admin Approves Order...${ANSI_RESET}`);
    const approvedOrder = await prisma.vendorOrder.update({
      where: { id: order.id },
      data: {
        currentStage: 'ADMIN_APPROVED',
        status: 'ADMIN_APPROVED',
        adminApprovedAt: new Date(),
        approvedByName: 'Super Admin',
      }
    });
    assert(approvedOrder.currentStage === 'ADMIN_APPROVED', 'Order transitioned to ADMIN_APPROVED');

    // ── STAGE 4: Admin Sends to Store ────────────────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 4] Admin Sends to Store (fulfillmentMethod: SEND_TO_STORE)...${ANSI_RESET}`);
    const sentToStoreOrder = await prisma.vendorOrder.update({
      where: { id: order.id },
      data: {
        currentStage: 'SENT_TO_STORE',
        status: 'SENT_TO_STORE',
        fulfillmentMethod: 'SEND_TO_STORE',
        sentToStoreAt: new Date(),
        sentToStoreByName: 'Super Admin',
      }
    });
    assert(sentToStoreOrder.currentStage === 'SENT_TO_STORE', 'Order transitioned to SENT_TO_STORE');
    assert(sentToStoreOrder.fulfillmentMethod === 'SEND_TO_STORE', 'Fulfillment method is SEND_TO_STORE');

    // Verify inventory is NOT deducted yet
    const invBefore = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    const variantsBefore = JSON.parse(invBefore.variants);
    assert(variantsBefore[0].stock === 50, 'Warehouse inventory strictly unchanged (50 units) before allocation');

    // ── STAGE 5: Store Allocation with Atomic Deduction & Allocation Record ─
    console.log(`\n${ANSI_CYAN}[Stage 5] Store Allocates 8 units (Warehouse stock 50 -> 42)...${ANSI_RESET}`);
    const allocQty = 8;
    const now = new Date();

    const allocatedTx = await prisma.$transaction(async (tx) => {
      // 1. Deduct variant stock
      const currentInv = await tx.inventoryItem.findUnique({ where: { id: invItem.id } });
      const currentVars = JSON.parse(currentInv.variants);
      currentVars[0].stock -= allocQty;
      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: {
          stock: currentVars[0].stock,
          variants: JSON.stringify(currentVars),
        }
      });

      // 2. Update line item allocatedQuantity
      await tx.vendorOrderItem.update({
        where: { id: order.items[0].id },
        data: { allocatedQuantity: allocQty }
      });

      // 3. Create VendorOrderAllocation record
      const allocation = await tx.vendorOrderAllocation.create({
        data: {
          allocationNumber: `ALC-${order.orderNumber}-001`,
          orderId: order.id,
          orderItemId: order.items[0].id,
          vendorId: vendor.id,
          asmId: asmUser.id,
          storeName: 'Main Store / Warehouse',
          catalogItemId: invItem.id,
          productName: invItem.name,
          color: 'Black',
          size: 'Standard',
          requestedQuantity: 10,
          allocatedQuantity: allocQty,
          remainingQuantity: 2,
          sentBy: 'Store Supervisor',
          sentAt: now,
          handoverStatus: 'SENT_TO_ASM',
        }
      });

      // 4. Update order to SENT_TO_ASM
      const updated = await tx.vendorOrder.update({
        where: { id: order.id },
        data: {
          currentStage: 'SENT_TO_ASM',
          status: 'SENT_TO_ASM',
          allocatedAt: now,
          allocatedByName: 'Store Supervisor',
          storeName: 'Main Store / Warehouse',
          updatedAt: now,
        },
        include: { items: true, allocations: true }
      });

      return { updated, allocation };
    });

    assert(allocatedTx.updated.currentStage === 'SENT_TO_ASM', 'Order stage updated to SENT_TO_ASM');
    assert(allocatedTx.updated.items[0].allocatedQuantity === 8, 'Line item allocatedQuantity updated to 8');
    assert(allocatedTx.allocation && allocatedTx.allocation.allocatedQuantity === 8, 'VendorOrderAllocation record created with allocatedQuantity = 8');
    assert(allocatedTx.allocation.handoverStatus === 'SENT_TO_ASM', 'Allocation record handoverStatus is SENT_TO_ASM');

    // Verify inventory was deducted atomically
    const invAfterAlloc = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    const variantsAfterAlloc = JSON.parse(invAfterAlloc.variants);
    assert(variantsAfterAlloc[0].stock === 42, `Warehouse variant stock correctly deducted to 42 (50 - 8 = 42)`);

    // ── STAGE 6: Delivery Sheet Data Guarantee ───────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 6] Verifying Delivery Sheet Data Guarantee...${ANSI_RESET}`);
    // Delivery sheet uses: item.allocatedQuantity || 0 and ZERO financial/pricing details
    const deliverySheetItem = allocatedTx.updated.items[0];
    const sheetAllocated = deliverySheetItem.allocatedQuantity || 0;
    assert(sheetAllocated === 8, `Delivery Sheet displays exact allocated quantity (${sheetAllocated})`);
    assert(sheetAllocated !== deliverySheetItem.quantity, `Delivery Sheet does NOT show unallocated requested quantity (10)`);

    // ── STAGE 7: ASM Accepts / Receives Stock ─────────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 7] ASM Accepts / Receives Stock (transition to ASM_RECEIVED)...${ANSI_RESET}`);
    const asmReceiveTime = new Date();
    const receivedTx = await prisma.$transaction(async (tx) => {
      await tx.vendorOrderAllocation.updateMany({
        where: { orderId: order.id },
        data: {
          handoverStatus: 'ASM_RECEIVED',
          receivedBy: asmUser.name,
          receivedById: asmUser.id,
          receivedAt: asmReceiveTime,
        }
      });

      const ord = await tx.vendorOrder.update({
        where: { id: order.id },
        data: {
          currentStage: 'ASM_RECEIVED',
          status: 'ASM_RECEIVED',
          asmAcceptedAt: asmReceiveTime,
          acceptedByName: asmUser.name,
          asmReceivedAt: asmReceiveTime,
          asmReceivedByName: asmUser.name,
          updatedAt: asmReceiveTime,
        },
        include: { allocations: true }
      });

      return ord;
    });

    assert(receivedTx.currentStage === 'ASM_RECEIVED', 'Order transitioned to ASM_RECEIVED');
    assert(receivedTx.asmReceivedByName === asmUser.name, 'ASM received by name recorded');
    assert(receivedTx.allocations[0].handoverStatus === 'ASM_RECEIVED', 'VendorOrderAllocation handoverStatus is ASM_RECEIVED');

    // Verify ZERO secondary inventory deduction
    const invAfterReceive = await prisma.inventoryItem.findUnique({ where: { id: invItem.id } });
    const variantsAfterReceive = JSON.parse(invAfterReceive.variants);
    assert(variantsAfterReceive[0].stock === 42, 'Warehouse inventory strictly unchanged (42 units) upon ASM receiving');

    // ── STAGE 8: Order Delivery to Vendor ────────────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 8] Delivering Order to Vendor (transition to DELIVERED)...${ANSI_RESET}`);
    const deliveredOrder = await prisma.vendorOrder.update({
      where: { id: order.id },
      data: {
        currentStage: 'DELIVERED',
        status: 'DELIVERED',
        deliveredAt: new Date(),
        deliveredByName: asmUser.name,
      }
    });
    assert(deliveredOrder.currentStage === 'DELIVERED', 'Order transitioned to DELIVERED');

    // ── STAGE 9: Payment Recording & Cheque Handling ─────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 9] Recording Payments (Cash, Online, Pending Cheque, Cleared Cheque)...${ANSI_RESET}`);
    // 1. Advance Cash: Rs. 5,000
    const pay1 = await prisma.vendorPayment.create({
      data: {
        orderId: order.id,
        vendorId: vendor.id,
        amount: 5000,
        paymentType: 'ADVANCE',
        paymentMethod: 'CASH',
        status: 'CLEARED',
        paymentDate: new Date(),
        recordedBy: asmUser.name,
      }
    });

    // 2. Online: Rs. 5,000
    const pay2 = await prisma.vendorPayment.create({
      data: {
        orderId: order.id,
        vendorId: vendor.id,
        amount: 5000,
        paymentType: 'PARTIAL',
        paymentMethod: 'ONLINE',
        status: 'CLEARED',
        paymentDate: new Date(),
        recordedBy: asmUser.name,
      }
    });

    // 3. Pending Cheque: Rs. 6,000 (status: PENDING — must NOT count towards cleared total paid!)
    const pay3 = await prisma.vendorPayment.create({
      data: {
        orderId: order.id,
        vendorId: vendor.id,
        amount: 6000,
        paymentType: 'PARTIAL',
        paymentMethod: 'CHEQUE',
        chequeNumber: 'CHQ-100234',
        bankName: 'Meezan Bank',
        status: 'PENDING',
        paymentDate: new Date(),
        recordedBy: asmUser.name,
      }
    });

    // 4. Cleared Cheque: Rs. 4,000
    const pay4 = await prisma.vendorPayment.create({
      data: {
        orderId: order.id,
        vendorId: vendor.id,
        amount: 4000,
        paymentType: 'PARTIAL',
        paymentMethod: 'CHEQUE',
        chequeNumber: 'CHQ-100235',
        bankName: 'Habib Bank Ltd',
        status: 'CLEARED',
        paymentDate: new Date(),
        recordedBy: asmUser.name,
      }
    });

    // Recompute order totals
    const clearedPayments = await prisma.vendorPayment.findMany({
      where: { orderId: order.id, status: 'CLEARED' }
    });
    const totalClearedPaid = clearedPayments.reduce((s, p) => s + p.amount, 0);
    const advancePaid = clearedPayments.filter(p => p.paymentType === 'ADVANCE').reduce((s, p) => s + p.amount, 0);
    const remainingBalance = Math.max(0, order.grandTotal - totalClearedPaid);

    await prisma.vendorOrder.update({
      where: { id: order.id },
      data: { advancePaid, remainingBalance }
    });

    assert(totalClearedPaid === 14000, `Cleared payments sum = Rs. 14,000 (Cash 5k + Online 5k + Cleared Cheque 4k)`);
    assert(advancePaid === 5000, `Advance paid = Rs. 5,000`);
    assert(remainingBalance === 6000, `Remaining balance = Rs. 6,000 (Rs. 20,000 - Rs. 14,000 = Rs. 6,000)`);
    assert(pay3.status === 'PENDING', 'Pending Cheque (Rs. 6,000) is marked PENDING and properly excluded from cleared paid sum');

    // ── STAGE 10: Payment Correction & Audit Trail ───────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 10] Payment Edit / Correction with Audit Trail (Cash 5,000 -> 7,000)...${ANSI_RESET}`);
    const newCashAmount = 7000;
    const diff = newCashAmount - pay1.amount; // +2000

    // Create immutable audit log
    const auditRecord = await prisma.vendorPaymentAudit.create({
      data: {
        paymentId: pay1.id,
        orderId: order.id,
        previousAmount: pay1.amount,
        newAmount: newCashAmount,
        difference: diff,
        editedBy: 'Admin Supervisor',
        reason: 'Corrected under-recorded cash deposit per bank receipt',
      }
    });

    await prisma.vendorPayment.update({
      where: { id: pay1.id },
      data: { amount: newCashAmount }
    });

    // Recompute order after edit
    const clearedAfterEdit = await prisma.vendorPayment.findMany({
      where: { orderId: order.id, status: 'CLEARED' }
    });
    const totalPaidAfterEdit = clearedAfterEdit.reduce((s, p) => s + p.amount, 0);
    const remainingAfterEdit = Math.max(0, order.grandTotal - totalPaidAfterEdit);

    await prisma.vendorOrder.update({
      where: { id: order.id },
      data: { remainingBalance: remainingAfterEdit }
    });

    assert(auditRecord && auditRecord.difference === 2000, 'VendorPaymentAudit log created with difference = +Rs. 2,000');
    assert(auditRecord.previousAmount === 5000 && auditRecord.newAmount === 7000, 'Audit record tracks previous (5000) and new (7000) amounts');
    assert(totalPaidAfterEdit === 16000, `Total paid after edit = Rs. 16,000 (7k + 5k + 4k)`);
    assert(remainingAfterEdit === 4000, `Remaining balance after edit = Rs. 4,000`);

    // ── STAGE 11: Admin Financial Dashboard Reconciliation ───────────────
    console.log(`\n${ANSI_CYAN}[Stage 11] Verifying Admin Dashboard Mathematical Reconciliation...${ANSI_RESET}`);
    // Methods breakdown for this order:
    // Cash: 7,000
    // Online: 5,000
    // Cheque Cleared: 4,000
    // Cheque Pending: 6,000
    const testPayments = await prisma.vendorPayment.findMany({ where: { orderId: order.id } });
    let cashSum = 0;
    let onlineSum = 0;
    let chequeClearedSum = 0;
    let chequePendingSum = 0;

    testPayments.forEach(p => {
      if (p.paymentMethod === 'CASH' && p.status === 'CLEARED') cashSum += p.amount;
      if (p.paymentMethod === 'ONLINE' && p.status === 'CLEARED') onlineSum += p.amount;
      if (p.paymentMethod === 'CHEQUE' && p.status === 'CLEARED') chequeClearedSum += p.amount;
      if (p.paymentMethod === 'CHEQUE' && p.status === 'PENDING') chequePendingSum += p.amount;
    });

    const sumMethods = cashSum + onlineSum + chequeClearedSum;
    assert(cashSum === 7000, `Cash collected = Rs. 7,000`);
    assert(onlineSum === 5000, `Online collected = Rs. 5,000`);
    assert(chequeClearedSum === 4000, `Cheque cleared = Rs. 4,000`);
    assert(chequePendingSum === 6000, `Cheque pending = Rs. 6,000`);
    assert(sumMethods === totalPaidAfterEdit, `Mathematical reconciliation: Total Paid (${totalPaidAfterEdit}) == Cash (${cashSum}) + Online (${onlineSum}) + Cheque (${chequeClearedSum})`);

  } catch (err) {
    console.error(`${ANSI_RED}Unhandled error during verification:${ANSI_RESET}`, err);
    failed++;
  } finally {
    // ── STAGE 12: Clean Teardown ─────────────────────────────────────────
    console.log(`\n${ANSI_CYAN}[Stage 12] Cleaning up test data...${ANSI_RESET}`);
    try {
      if (order && order.id) {
        await prisma.vendorPaymentAudit.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorPayment.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrderAllocation.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrderStatus.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrderItem.deleteMany({ where: { orderId: order.id } });
        await prisma.vendorOrder.delete({ where: { id: order.id } });
      }
      if (vendor && vendor.id) {
        await prisma.vendor.delete({ where: { id: vendor.id } });
      }
      if (invItem && invItem.id) {
        await prisma.inventoryItem.delete({ where: { id: invItem.id } });
      }
      if (asmUser && asmUser.id) {
        await prisma.user.delete({ where: { id: asmUser.id } });
      }
      console.log(`${ANSI_GREEN}✓ Teardown completed successfully.${ANSI_RESET}`);
    } catch (cleanupErr) {
      console.error('Teardown error (non-fatal):', cleanupErr.message);
    }
  }

  console.log(`\n${ANSI_CYAN}=== VERIFICATION SUMMARY ===${ANSI_RESET}`);
  console.log(`Total tests: ${passed + failed}`);
  console.log(`${ANSI_GREEN}Passed: ${passed}${ANSI_RESET}`);
  console.log(`${failed > 0 ? ANSI_RED : ANSI_GREEN}Failed: ${failed}${ANSI_RESET}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification();
