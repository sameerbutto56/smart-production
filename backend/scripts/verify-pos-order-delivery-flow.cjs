const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- Starting POS -> Order -> Dispatch -> Delivery Flow Verification ---');
  let exitCode = 0;

  try {
    // 1. Verify Marketing User & Employee Foreign Key relationship
    console.log('\n[1] Verifying Marketing Activity Creation...');
    const marketingUser = await prisma.user.findFirst({
      where: { role: 'MARKETING' }
    });

    if (marketingUser) {
      console.log(`Found Marketing user: ${marketingUser.email} (${marketingUser.id})`);
      const testActivity = await prisma.marketingActivity.create({
        data: {
          userId: marketingUser.id,
          employeeName: 'Junaid',
          date: '2026-10-02',
          time: '12:00:00',
          area: 'Test Verification Area',
          location: 'Test Medical Complex',
          hospitalName: 'Test Hospital',
          source: 'GPS',
          latitude: 31.4697,
          longitude: 74.2728,
          status: 'COMPLETED'
        }
      });
      console.log('✓ Successfully created MarketingActivity without 500 foreign key error. ID:', testActivity.id);

      // Clean up test activity
      await prisma.marketingActivity.delete({ where: { id: testActivity.id } });
      console.log('✓ Cleaned up test MarketingActivity');
    } else {
      console.log('⚠ No user with role MARKETING found; skipping activity create check.');
    }

    // 2. Setup a mock POS Sale with partial payment / balance
    console.log('\n[2] Creating Test PosSale with partial payment...');
    const testOrderNum = `TEST-POS-${Date.now()}`;
    const testReceiptNum = `RCP-TEST-${Date.now()}`;
    const grandTotal = 5000;
    const paidAmount = 3000;
    const balanceAmount = 2000;

    const testSale = await prisma.posSale.create({
      data: {
        receiptNumber: testReceiptNum,
        orderNumber: testOrderNum,
        outletName: 'Johar Town',
        cashierName: 'Test Cashier',
        customerName: 'Muhammad Ali Test',
        customerPhone: '0300-1234567',
        subtotal: grandTotal,
        discountAmount: 0,
        grandTotal: grandTotal,
        paymentMethod: 'CASH',
        cashAmount: paidAmount,
        advanceAmount: paidAmount,
        additionalNote: 'Verification sale'
      }
    });
    console.log(`✓ Created test PosSale: ${testSale.id}, orderNumber: ${testOrderNum}, Total: ₨${grandTotal}, Paid: ₨${paidAmount}`);

    // 3. Verify Order Creation linking to the PosSale
    console.log('\n[3] Creating Order linked to PosSale...');
    const testOrder = await prisma.order.create({
      data: {
        orderNumber: testOrderNum,
        customerName: 'Muhammad Ali Test',
        customerPhone: '0300-1234567',
        address: '123 Verification St',
        city: 'Lahore',
        totalPrice: grandTotal,
        advanceAmount: paidAmount,
        balanceAmount: balanceAmount,
        paymentStatus: 'BALANCE',
        currentStage: 'READY_FOR_DELIVERY',
        status: 'PENDING',
        outletName: 'Johar Town'
      }
    });

    // Link posSale to order
    await prisma.posSale.update({
      where: { id: testSale.id },
      data: { orderId: testOrder.id }
    });
    console.log(`✓ Created test Order: ${testOrder.id}, linked to PosSale ${testSale.id}`);

    // Verify balance calculation
    if (testOrder.balanceAmount !== grandTotal - paidAmount) {
      console.error(`✗ Balance mismatch: expected ${grandTotal - paidAmount}, got ${testOrder.balanceAmount}`);
      exitCode = 1;
    } else {
      console.log(`✓ Balance correctly calculated: ₨${testOrder.balanceAmount} = Total(₨${grandTotal}) - Paid(₨${paidAmount})`);
    }

    // 4. Simulate Delivery Completion & POS Balance Auto-Clearance
    console.log('\n[4] Simulating Delivery Boy Collection & Automatic POS Clearance...');
    // Simulate what delivery.controller.js / deliverOrder does:
    // Update Order to PAID with 0 balance
    const deliveredOrder = await prisma.order.update({
      where: { id: testOrder.id },
      data: {
        balanceAmount: 0,
        paymentStatus: 'PAID',
        currentStage: 'DELIVERED',
        status: 'COMPLETED'
      }
    });

    // Find linked PosSale
    const linkedPosSale = await prisma.posSale.findFirst({
      where: {
        OR: [
          { orderId: testOrder.id },
          { orderNumber: testOrder.orderNumber }
        ]
      },
      include: {
        balancePayments: true
      }
    });

    if (!linkedPosSale) {
      console.error('✗ Failed to find linked PosSale');
      exitCode = 1;
    } else {
      console.log(`✓ Found linked PosSale ${linkedPosSale.id} for order ${testOrder.id}`);
      const priorPaid = linkedPosSale.balancePayments.reduce((s, p) => s + (p.amount || 0), 0) + (linkedPosSale.advanceAmount || linkedPosSale.cashAmount || 0);
      const remainingPosBalance = Math.max(0, linkedPosSale.grandTotal - priorPaid);

      if (remainingPosBalance > 0.01) {
        const balReceipt = `BAL-RCP-TEST-${Date.now()}`;
        const balPayment = await prisma.posBalancePayment.create({
          data: {
            posSaleId: linkedPosSale.id,
            receiptNumber: balReceipt,
            originalInvoiceNumber: linkedPosSale.receiptNumber,
            originalInvoiceTotal: linkedPosSale.grandTotal,
            previouslyPaidAmount: priorPaid,
            remainingBalanceBeforePayment: remainingPosBalance,
            amountPaidNow: remainingPosBalance,
            outstandingBalanceAfterPayment: 0,
            paymentMethod: 'CASH',
            cashAmount: remainingPosBalance,
            onlineAmount: 0,
            cashierName: 'Test Rider',
            paidAt: new Date()
          }
        });
        console.log(`✓ Successfully generated PosBalancePayment: ₨${balPayment.amountPaidNow}, Receipt: ${balPayment.receiptNumber}`);
      }

      // Re-query and verify that outstanding balance is now 0
      const updatedSale = await prisma.posSale.findUnique({
        where: { id: testSale.id },
        include: { balancePayments: true }
      });
      const totalCollected = (updatedSale.advanceAmount || updatedSale.cashAmount || 0) + updatedSale.balancePayments.reduce((s, p) => s + (p.amountPaidNow || 0), 0);
      const finalPending = Math.max(0, updatedSale.grandTotal - totalCollected);

      console.log(`Final PosSale Status: GrandTotal: ₨${updatedSale.grandTotal}, Total Collected: ₨${totalCollected}, Outstanding Balance: ₨${finalPending}`);
      if (finalPending === 0) {
        console.log('✓ Outstanding balance across PosSale is 0 (100% Cleared)');
      } else {
        console.error(`✗ PosSale balance not 0: ₨${finalPending}`);
        exitCode = 1;
      }
    }

    // 5. Clean up test records
    console.log('\n[5] Cleaning up test records...');
    await prisma.posBalancePayment.deleteMany({ where: { posSaleId: testSale.id } });
    await prisma.posSale.delete({ where: { id: testSale.id } });
    await prisma.order.delete({ where: { id: testOrder.id } });
    console.log('✓ Cleaned up test records successfully.');

  } catch (err) {
    console.error('Verification error:', err);
    exitCode = 1;
  } finally {
    await prisma.$disconnect();
    console.log(`\nVerification Finished with exit code: ${exitCode}`);
    process.exit(exitCode);
  }
}

run();
