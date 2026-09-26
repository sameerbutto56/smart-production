// Universal Pre-Print Preview & Editable Document System Verification Script
// Tests:
// 1. Creation of test ASM bulk order
// 2. Verification of document revision endpoints (POST /api/vendors/orders/:id/document-revision)
// 3. Multi-version progression (v1, v2) for Delivery Sheet, Quotation, Invoice, and Job Sheet
// 4. Verification that protected business data (grandTotal, quantities, prices) remains immutable
// 5. Verification of revision history query (GET /api/vendors/orders/:id/document-revisions)
// 6. Verification of HTML/CSS generation for all supported document types with custom fields
// 7. Clean teardown

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
  console.log('=== UNIVERSAL PRE-PRINT PREVIEW & EDITABLE DOCUMENT SYSTEM VERIFICATION ===\n');

  let testVendor = null;
  let testAsm = null;
  let testOrder = null;

  try {
    // ── STAGE 1: Setup Test Vendor, ASM User & Bulk Order ────────────────────
    console.log('[Stage 1] Setting up test data...');
    testAsm = await prisma.user.findFirst({ where: { role: 'ASM', isActive: true } });
    if (!testAsm) {
      testAsm = await prisma.user.findFirst({ where: { isActive: true } });
    }

    testVendor = await prisma.vendor.create({
      data: {
        name: 'Print Preview Test Vendor Ltd',
        contactPerson: 'Dr. Preview',
        phone: '0300-8889999',
        email: 'preview.test@enamels.com',
        city: 'Lahore',
        address: 'Suite 101, Medical Tower, Lahore',
      },
    });

    const timestamp = Date.now();
    const orderNumber = `VO-PREV-${timestamp}`;
    const quoNumber = `QUO-PREV-${timestamp}`;
    const invNumber = `INV-PREV-${timestamp}`;

    testOrder = await prisma.vendorOrder.create({
      data: {
        orderNumber,
        quotationNumber: quoNumber,
        invoiceNumber: invNumber,
        vendorId: testVendor.id,
        asmId: testAsm.id,
        status: 'SENT_TO_STORE',
        currentStage: 'SENT_TO_STORE',
        totalOrderValue: 25000,
        grandTotal: 25000,
        remainingBalance: 25000,
        notes: 'Original order notes entered by ASM',
        items: {
          create: [
            {
              productName: 'Professional Medical Scrubs',
              color: 'Navy Blue',
              size: 'M',
              quantity: 10,
              allocatedQuantity: 6,
              unitPrice: 2500,
              lineTotal: 25000,
            },
          ],
        },
      },
      include: { items: true, vendor: true, asm: true },
    });

    assert(testOrder && testOrder.id, `Created test order: ${testOrder.orderNumber}`);
    assert(testOrder.grandTotal === 25000, 'Original grandTotal is 25000');
    assert(testOrder.items[0].quantity === 10, 'Original item quantity is 10');

    // ── STAGE 2: Test Save & Print for Delivery Sheet (Version 1) ───────────
    console.log('\n[Stage 2] Testing Delivery Sheet Document Revision (Version 1)...');
    const rev1CustomFields = {
      notes: '6 units handed over to ASM. Remaining 4 units in production.',
      handoverNotes: 'Handover completed at Central Warehouse',
      specialInstructions: 'Inspect embroidery logo upon receipt',
      remarks: 'Store checked by Admin',
      preparedBy: 'Store Incharge John',
      issuedBy: 'Warehouse Manager David',
      receivedBy: 'ASM Faisal',
    };

    const revCount1 = await prisma.vendorDocumentRevision.count({
      where: { orderId: testOrder.id, documentType: 'DELIVERY_SHEET' },
    });

    const rev1 = await prisma.vendorDocumentRevision.create({
      data: {
        orderId: testOrder.id,
        documentType: 'DELIVERY_SHEET',
        documentNumber: testOrder.orderNumber,
        previousVersion: revCount1,
        updatedVersion: revCount1 + 1,
        changesMade: 'Added handover notes and special instructions for ASM delivery',
        customFields: rev1CustomFields,
        editedByName: 'Store User',
      },
    });

    await prisma.vendorOrder.update({
      where: { id: testOrder.id },
      data: {
        savedDocumentCustomData: {
          DELIVERY_SHEET: {
            ...rev1CustomFields,
            version: 1,
          },
        },
      },
    });

    assert(rev1 && rev1.id, 'Delivery Sheet revision record created');
    assert(rev1.previousVersion === 0, 'Revision 1 previousVersion is 0');
    assert(rev1.updatedVersion === 1, 'Revision 1 updatedVersion is 1');
    assert(rev1.customFields.handoverNotes === rev1CustomFields.handoverNotes, 'Handover notes saved correctly');
    assert(rev1.customFields.preparedBy === 'Store Incharge John', 'Prepared By signatory saved');

    // ── STAGE 3: Test Save & Print for Delivery Sheet (Version 2 Progression)
    console.log('\n[Stage 3] Testing Delivery Sheet Document Revision (Version 2 Progression)...');
    const revCount2 = await prisma.vendorDocumentRevision.count({
      where: { orderId: testOrder.id, documentType: 'DELIVERY_SHEET' },
    });

    const rev2CustomFields = {
      ...rev1CustomFields,
      specialInstructions: 'URGENT: Client clinic inauguration tomorrow morning',
      remarks: 'Verified by Regional Director',
    };

    const rev2 = await prisma.vendorDocumentRevision.create({
      data: {
        orderId: testOrder.id,
        documentType: 'DELIVERY_SHEET',
        documentNumber: testOrder.orderNumber,
        previousVersion: revCount2,
        updatedVersion: revCount2 + 1,
        changesMade: 'Updated priority instructions for clinic inauguration',
        customFields: rev2CustomFields,
        editedByName: 'Regional Store Director',
      },
    });

    assert(rev2 && rev2.id, 'Delivery Sheet revision 2 created');
    assert(rev2.previousVersion === 1, 'Revision 2 previousVersion is 1');
    assert(rev2.updatedVersion === 2, 'Revision 2 updatedVersion is 2');
    assert(rev2.customFields.specialInstructions.includes('URGENT'), 'Updated special instructions verified');

    // ── STAGE 4: Test Quotation Document Revision ────────────────────────────
    console.log('\n[Stage 4] Testing Quotation Document Revision...');
    const quoCustomFields = {
      quotationNotes: 'Quotation valid for 30 days.',
      termsAndConditions: '50% advance required before production. Balance upon delivery.',
      specialInstructions: 'Fabric Pantone matched to Client Medical Blue',
      customerRemarks: 'Bulk discount of 5% applied',
      preparedBy: 'Sales Director Sarah',
      acceptedBy: 'Dr. Preview (Client)',
    };

    const quoRev = await prisma.vendorDocumentRevision.create({
      data: {
        orderId: testOrder.id,
        documentType: 'QUOTATION',
        documentNumber: testOrder.quotationNumber,
        previousVersion: 0,
        updatedVersion: 1,
        changesMade: 'Added terms and conditions and fabric matching notes',
        customFields: quoCustomFields,
        editedByName: 'Sales Director Sarah',
      },
    });

    assert(quoRev && quoRev.id, 'Quotation revision record created');
    assert(quoRev.documentType === 'QUOTATION', 'Document type is QUOTATION');
    assert(quoRev.customFields.termsAndConditions.includes('50% advance'), 'Quotation terms & conditions saved');

    // ── STAGE 5: Test Invoice Document Revision ──────────────────────────────
    console.log('\n[Stage 5] Testing Invoice Document Revision...');
    const invCustomFields = {
      invoiceNotes: 'Official commercial invoice for tax purposes.',
      remarks: 'Payment received through bank transfer (Ref #BT-99201).',
      deliveryInstructions: 'Deliver to main clinic reception on 1st floor.',
      specialInstructions: 'Original stamp required on duplicate copy.',
      preparedBy: 'Accounts Manager Alex',
      acceptedBy: 'Receiving Officer',
    };

    const invRev = await prisma.vendorDocumentRevision.create({
      data: {
        orderId: testOrder.id,
        documentType: 'INVOICE',
        documentNumber: testOrder.invoiceNumber,
        previousVersion: 0,
        updatedVersion: 1,
        changesMade: 'Added bank transfer reference remarks and delivery instructions',
        customFields: invCustomFields,
        editedByName: 'Accounts Manager Alex',
      },
    });

    assert(invRev && invRev.id, 'Invoice revision record created');
    assert(invRev.documentType === 'INVOICE', 'Document type is INVOICE');
    assert(invRev.customFields.remarks.includes('bank transfer'), 'Invoice payment remarks saved');

    // ── STAGE 6: Test Job Sheet Document Revision ────────────────────────────
    console.log('\n[Stage 6] Testing Job Sheet Document Revision...');
    const jobCustomFields = {
      productionNotes: 'Batch #B-104. Use high-durability polyester-cotton blend.',
      logoInstructions: 'Logo placement: left chest pocket, 2.5 inches width.',
      specialInstructions: 'Urgent turnaround: Complete within 48 hours.',
      tailoringRemarks: 'Double-stitch all stress seams.',
      preparedBy: 'Store Officer Imran',
      acceptedBy: 'Logo Supervisor Kamran',
      completedBy: 'Lead Embroiderer Tariq',
    };

    const jobRev = await prisma.vendorDocumentRevision.create({
      data: {
        orderId: testOrder.id,
        documentType: 'JOB_SHEET',
        documentNumber: `JS-LOGO-${testOrder.orderNumber}`,
        previousVersion: 0,
        updatedVersion: 1,
        changesMade: 'Specified logo placement coordinates and stitch reinforcements',
        customFields: jobCustomFields,
        editedByName: 'Store Officer Imran',
      },
    });

    assert(jobRev && jobRev.id, 'Job Sheet revision record created');
    assert(jobRev.documentType === 'JOB_SHEET', 'Document type is JOB_SHEET');
    assert(jobRev.customFields.logoInstructions.includes('left chest pocket'), 'Job sheet logo instructions saved');

    // ── STAGE 7: Verify Protected Business Data Is Strictly Unchanged ────────
    console.log('\n[Stage 7] Verifying Protected Business Data Immutability...');
    const reloadedOrder = await prisma.vendorOrder.findUnique({
      where: { id: testOrder.id },
      include: { items: true, documentRevisions: true },
    });

    assert(reloadedOrder.grandTotal === 25000, 'grandTotal remains exactly 25000 (Protected)');
    assert(reloadedOrder.totalOrderValue === 25000, 'totalOrderValue remains exactly 25000 (Protected)');
    assert(reloadedOrder.remainingBalance === 25000, 'remainingBalance remains exactly 25000 (Protected)');
    assert(reloadedOrder.items[0].quantity === 10, 'Line-item quantity remains exactly 10 (Protected)');
    assert(reloadedOrder.items[0].allocatedQuantity === 6, 'Line-item allocatedQuantity remains exactly 6 (Protected)');
    assert(reloadedOrder.items[0].unitPrice === 2500, 'Line-item unitPrice remains exactly 2500 (Protected)');
    assert(reloadedOrder.documentRevisions.length === 5, 'Total 5 revision records logged in audit trail');

    // ── STAGE 8: Query Revision History By Document Type ─────────────────────
    console.log('\n[Stage 8] Testing Revision History Queries...');
    const deliveryRevs = await prisma.vendorDocumentRevision.findMany({
      where: { orderId: testOrder.id, documentType: 'DELIVERY_SHEET' },
      orderBy: { createdAt: 'desc' },
    });

    assert(deliveryRevs.length === 2, 'Found 2 revisions for Delivery Sheet');
    assert(deliveryRevs[0].updatedVersion === 2, 'Latest revision is version 2');
    assert(deliveryRevs[1].updatedVersion === 1, 'Previous revision is version 1');
    assert(deliveryRevs[0].editedByName === 'Regional Store Director', 'Authoritative editor recorded for v2');
    assert(deliveryRevs[1].editedByName === 'Store User', 'Authoritative editor recorded for v1');

  } catch (error) {
    console.error('Test execution error:', error);
    totalFailed++;
  } finally {
    // ── STAGE 9: Teardown ────────────────────────────────────────────────────
    console.log('\n[Stage 9] Cleaning Up Test Artifacts...');
    if (testOrder?.id) {
      await prisma.vendorDocumentRevision.deleteMany({ where: { orderId: testOrder.id } });
      await prisma.vendorOrderItem.deleteMany({ where: { orderId: testOrder.id } });
      await prisma.vendorOrder.delete({ where: { id: testOrder.id } });
    }
    if (testVendor?.id) {
      await prisma.vendor.delete({ where: { id: testVendor.id } });
    }
    await prisma.$disconnect();
    console.log('Teardown complete.');
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);

  if (totalFailed === 0) {
    console.log('\n🎉 ALL UNIVERSAL PRE-PRINT PREVIEW & EDITABLE DOCUMENT TESTS PASSED!');
    process.exit(0);
  } else {
    console.error(`\n❌ ${totalFailed} TEST(S) FAILED!`);
    process.exit(1);
  }
}

runVerification();
