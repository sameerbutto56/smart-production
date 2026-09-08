const prisma = require('../src/prisma');
const { resolvePktDateRange } = require('../src/utils/workingHours');
const { computeUnifiedSalesSummary } = require('../src/utils/posUnified');
const { computeBookSummary } = require('../src/controllers/pos.book.controller');

async function verify() {
  console.log('=== VERIFY FINANCIAL RECONCILIATION ===\n');

  // 1. Check Date Range Calculation for 'yesterday'
  const { start, end } = resolvePktDateRange({ range: 'yesterday' });
  console.log(`1. 'yesterday' UTC range: [${start.toISOString()} -> ${end.toISOString()})`);
  
  // Validate that it covers exactly 24 hours
  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (diffHours !== 24) {
    throw new Error(`Expected 24 hours, got ${diffHours}`);
  }
  console.log('   ✓ Duration is exactly 24 hours (half-open)\n');

  // 2. Compute Unified Sales Summary for Jail Road for Yesterday
  const summary = await computeUnifiedSalesSummary(prisma, {
    outlet: 'Jail Road',
    start,
    end,
    isHalfOpen: true,
  });

  console.log('2. Jail Road Summary for Yesterday:');
  console.log(`   Gross Sales:    ₨${summary.grossSales.toLocaleString()}`);
  console.log(`   Discount:       ₨${summary.totalDiscount.toLocaleString()}`);
  console.log(`   Sales Received: ₨${summary.salesReceived.toLocaleString()}`);
  console.log(`   Total Returns:  ₨${summary.totalReturns.toLocaleString()}`);
  console.log(`   Net Revenue:    ₨${summary.netRevenue.toLocaleString()}`);
  console.log(`   Net Sales:      ₨${summary.netSales.toLocaleString()}`);
  console.log(`   Cash:           ₨${summary.paymentSummary.cash.toLocaleString()}`);
  console.log(`   Card:           ₨${summary.paymentSummary.card.toLocaleString()}`);
  console.log(`   Online:         ₨${summary.paymentSummary.online.toLocaleString()}`);
  console.log(`   Invoices:       ${summary.totalOrders}`);
  console.log(`   Returns Count:  ${summary.returns.length}`);

  // Assertions based on verified data
  // 11 sales invoices: Total Received = 90,038
  // Total Returns on that date = 42,050 (30,750 on 06/09 sale + 11,300 on 07/09 sale)
  // Net Revenue = 90,038 - 42,050 = 47,988
  if (summary.salesReceived !== 90038) {
    throw new Error(`Expected salesReceived=90038, got ${summary.salesReceived}`);
  }
  if (summary.totalReturns !== 42050) {
    throw new Error(`Expected totalReturns=42050, got ${summary.totalReturns}`);
  }
  if (summary.netRevenue !== 47988) {
    throw new Error(`Expected netRevenue=47988, got ${summary.netRevenue}`);
  }
  console.log('   ✓ Unified calculations match ground truth to the rupee!\n');

  // 3. Verify Closed Register for Jail Road
  const session = await prisma.posBookSession.findFirst({
    where: {
      outletName: 'Jail Road',
      openedAt: { gte: start, lt: end },
    },
  });

  if (session) {
    console.log(`3. Found Register Session: ${session.id} (status: ${session.status})`);
    const bookSummary = await computeBookSummary(session);
    console.log(`   Register Net Revenue: ₨${bookSummary.netRevenue.toLocaleString()}`);
    console.log(`   Register Net Sales:   ₨${bookSummary.netSales.toLocaleString()}`);
    console.log(`   Register Returns:     ₨${bookSummary.totalReturns.toLocaleString()}`);
    console.log(`   Register Cash:        ₨${bookSummary.paymentSummary.cash.toLocaleString()}`);
    console.log(`   Register Card:        ₨${bookSummary.paymentSummary.card.toLocaleString()}`);
    console.log(`   Register Online:      ₨${bookSummary.paymentSummary.online.toLocaleString()}`);

    if (bookSummary.netRevenue !== summary.netRevenue) {
      throw new Error(`Register netRevenue (${bookSummary.netRevenue}) does not match unified netRevenue (${summary.netRevenue})`);
    }
    if (bookSummary.totalReturns !== summary.totalReturns) {
      throw new Error(`Register totalReturns (${bookSummary.totalReturns}) does not match unified totalReturns (${summary.totalReturns})`);
    }
    console.log('   ✓ Closed Register matches POS History & Unified Summary identically!\n');

    // Update the saved summary on the closed session so its stored JSON has the reconciled numbers
    await prisma.posBookSession.update({
      where: { id: session.id },
      data: {
        summary: JSON.stringify(bookSummary),
      },
    });
    console.log('   ✓ Saved Register Session summary JSON updated in DB with reconciled figures.\n');
  }

  console.log('=== ALL RECONCILIATION CHECKS PASSED ===');
}

verify()
  .catch(err => {
    console.error('FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
