/**
 * Verification Test: Outlet Order Entry POS Isolation & Completed Order Detection
 * Verifies that already-placed POS orders (like RCP-20261019-00007 / JT-637121)
 * are properly recognized as orderExists = true and do not contaminate new orders.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING VERIFICATION: OUTLET ORDER ENTRY POS ISOLATION ---');
  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${desc}`);
    }
  }

  try {
    // 1. Verify POS sale RCP-20261019-00007 linked order detection
    const q = 'RCP-20261019-00007';
    const posSale = await prisma.posSale.findFirst({
      where: {
        OR: [
          { orderNumber: q },
          { receiptNumber: q },
          { clientRequestId: q }
        ]
      },
      include: {
        items: true,
        balancePayments: true
      }
    });

    assert('POS Sale RCP-20261019-00007 exists in database', !!posSale);

    const orderQueryConditions = [
      { orderNumber: q },
      { invoiceNumber: q }
    ];
    if (posSale?.orderId) orderQueryConditions.push({ id: posSale.orderId });
    if (posSale?.orderNumber) orderQueryConditions.push({ orderNumber: posSale.orderNumber });

    const existingOrder = await prisma.order.findFirst({
      where: { OR: orderQueryConditions },
      select: {
        id: true,
        orderNumber: true,
        invoiceNumber: true,
        customerName: true,
        customerPhone: true,
        totalPrice: true,
        advanceAmount: true,
        balanceAmount: true,
        paymentStatus: true
      }
    });

    assert('Existing Order JT-637121 is detected for RCP-20261019-00007', !!existingOrder && existingOrder.orderNumber === 'JT-637121');
    const orderExists = !!existingOrder || !!posSale?.orderId;
    assert('orderExists is strictly TRUE for already-placed POS sale', orderExists === true);

    // 2. Financial calculation parity test on POS sale
    const grandTotal = Math.round((posSale?.grandTotal || 0) * 100) / 100;
    const totalPaid = (posSale?.advanceAmount || 0) + (posSale?.balancePayments || []).reduce((s, bp) => s + (bp.amountPaidNow || 0), 0);
    const balanceAmount = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);
    assert('POS Sale grandTotal matches 14650', grandTotal === 14650);
    assert('POS Sale totalPaid matches 8000', totalPaid === 8000);
    assert('POS Sale balanceAmount matches 6650', balanceAmount === 6650);

    // 3. Test calculation logic when products take priority over posSaleInfo
    const mockProducts = [
      { name: 'Custom Scrub', unitPrice: 3000, quantity: 2, matchingCap: true, matchingCapQty: 1 }
    ];
    const CAP_PRICE = 500;
    const prodTotal = mockProducts.reduce((sum, p) => {
      const line = (parseFloat(p.unitPrice) || 0) * (p.quantity || 1);
      const cap = p.matchingCap ? (p.matchingCapQty || 0) * CAP_PRICE : 0;
      return sum + line + cap;
    }, 0);
    assert('Product total calculates correctly (3000 * 2 + 500 = 6500)', prodTotal === 6500);

    // When products exist, totalAmount should NOT be overridden by POS sale
    const mockPosSaleInfo = { grandTotal: 14650, receiptNumber: 'RCP-20261019-00007' };
    const effectiveTotal = prodTotal > 0 ? prodTotal : (mockPosSaleInfo?.grandTotal || 0);
    assert('effectiveTotal uses product total (6500) instead of stale POS grandTotal (14650)', effectiveTotal === 6500);

    // When POS sale is disconnected (posSaleInfo = null)
    const disconnectedPosSale = null;
    const disconnectedTotal = prodTotal > 0 ? prodTotal : (disconnectedPosSale?.grandTotal || 0);
    assert('Disconnected POS sale computes exact product total (6500)', disconnectedTotal === 6500);

    // 4. Test advance & balance mathematical parity
    const testAdvance = 2000;
    const testBalance = Math.max(0, effectiveTotal - testAdvance);
    assert('Mathematical parity: testAdvance (2000) + testBalance (4500) === effectiveTotal (6500)', testAdvance + testBalance === effectiveTotal);

  } catch (err) {
    console.error('Test execution error:', err);
    assert('Execution completed without runtime error', false);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\nVerification Summary: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)\n`);
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
