const prisma = require('../backend/src/prisma');

async function testAll() {
  // 1. pos.controller.js getSalesDashboard
  const { getSalesDashboard } = require('../backend/src/controllers/pos.controller');
  let posDashboardData = null;
  const reqPos = {
    query: { outlet: 'Jail Road', range: 'today' },
    user: { name: 'Jail Road Outlet', role: 'OUTLET' }
  };
  const mockResPos = {
    json: (d) => { posDashboardData = d; },
    status: () => mockResPos
  };
  await getSalesDashboard(reqPos, mockResPos);
  console.log('\n--- 1. POS DASHBOARD (pos.controller.js) ---');
  if (posDashboardData) {
    console.log('Total Sales:', posDashboardData.totalSales);
    console.log('Payment Breakdown:', posDashboardData.paymentBreakdown);
  }

  // 2. outletDetailed.controller.js getOutletDetailed
  const { getOutletDetailed } = require('../backend/src/controllers/outletDetailed.controller');
  let detailedData = null;
  const mockResDetailed = {
    json: (d) => { detailedData = d; },
    status: () => mockResDetailed
  };
  await getOutletDetailed({ params: { outletName: 'Jail Road' }, query: { range: 'today' } }, mockResDetailed);
  console.log('\n--- 2. ADMIN OUTLET DETAILED (outletDetailed.controller.js) ---');
  if (detailedData) {
    console.log('Total Sales:', detailedData.overview?.totalSales);
    console.log('Payment Breakdown:', detailedData.paymentBreakdown);
  }

  // 3. pos.book.controller.js getBookSummary
  const { getBookSummary } = require('../backend/src/controllers/pos.book.controller');
  let bookData = null;
  const mockResBook = {
    json: (d) => { bookData = d; },
    status: () => mockResBook
  };
  await getBookSummary({ query: { outletName: 'Jail Road' }, user: { role: 'OUTLET', name: 'Jail Road Outlet' } }, mockResBook);
  console.log('\n--- 3. REGISTER SUMMARY (pos.book.controller.js) ---');
  console.log(JSON.stringify(bookData, null, 2));

  // 4. outletOrder.controller.js getOutletDashboard
  const outletController = require('../backend/src/controllers/outletOrder.controller');
  let outletDashboardData = null;
  const mockResOutlet = {
    json: (d) => { outletDashboardData = d; },
    status: () => mockResOutlet
  };
  if (outletController.getOutletDashboard) {
    await outletController.getOutletDashboard({ user: { role: 'OUTLET', name: 'Jail Road Outlet' } }, mockResOutlet);
    console.log('\n--- 4. OUTLET DASHBOARD (outletOrder.controller.js) ---');
    console.log('POS Sales Summary:', outletDashboardData?.posSales);
  } else {
    console.log('\n--- 4. OUTLET DASHBOARD ---');
    console.log('Exports from outletOrder.controller.js:', Object.keys(outletController));
  }
}

testAll().catch(console.error).finally(() => prisma.$disconnect());
