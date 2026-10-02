const prisma = require('../backend/src/prisma');
const { computeUnifiedSalesSummary } = require('../backend/src/utils/posUnified');

async function testJailRoadSummary() {
  // Today's range (2026-08-12 UTC start to end or local day)
  const todayStart = new Date('2026-08-12T00:00:00.000Z');
  const todayEnd = new Date('2026-08-12T23:59:59.999Z');

  const summary = await computeUnifiedSalesSummary(prisma, {
    outlet: 'Jail Road',
    start: todayStart,
    end: todayEnd
  });

  console.log('--- COMPUTE UNIFIED SALES SUMMARY (JAIL ROAD TODAY) ---');
  console.log('Gross Sales:', summary.grossSales);
  console.log('Total Sales:', summary.totalSales);
  console.log('Payment Breakdown:', summary.paymentBreakdown);

  // Let's also check register close summary logic in pos.book.controller.js
  const getBookSummary = require('../backend/src/controllers/pos.book.controller');
}

testJailRoadSummary().catch(console.error).finally(() => prisma.$disconnect());
