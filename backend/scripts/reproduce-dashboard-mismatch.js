/* READ-ONLY diagnostic: reproduce the POS/Outlet/Admin dashboard mismatch.
 * Compares the four calculation engines for a given day per outlet:
 *   A. getSalesDashboard (pos.controller.js)  — UNIFIED computeUnifiedSalesSummary
 *   B. getOutletAnalytics posSummary (outletOrder) — UNIFIED computeUnifiedSalesSummary
 *   C. getOutletDetailed (outletDetailed)      — UNIFIED computeUnifiedSalesSummary
 *   D. computeBookSummary (pos.book)           — saleRevenue + balancePayments (no cap)
 * Only reads. Does not write.
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { computeUnifiedSalesSummary } = require('../src/utils/posUnified');
const prisma = new PrismaClient();

const saleRevenue = (s) => s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;

async function main() {
  const day = process.argv[2] || '2026-08-08'; // pick a closed-register day
  const outlets = ['Johar Town', 'Jail Road', 'Abbottabad'];
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(`${day}T23:59:59.999Z`);

  for (const outlet of outlets) {
    console.log(`\n========== ${outlet} — ${day} ==========`);

    // --- Engine A: getSalesDashboard → UNIFIED module (non-faisal + balPay on paidAt) ---
    const uA = await computeUnifiedSalesSummary(prisma, { outlet, start, end });
    const aTotal = uA.totalSales;
    console.log(`A. getSalesDashboard : totalSales=${aTotal.toFixed(2)}  (orders=${uA.totalOrders}, returns=${uA.returns.length}, balPay=${uA.balancePayments.length})`);

    // --- Engine B: getOutletAnalytics posSummary → UNIFIED module (same call) ---
    const uB = await computeUnifiedSalesSummary(prisma, { outlet, start, end });
    console.log(`B. Outlet posSummary  : totalSales=${uB.totalSales.toFixed(2)}  count=${uB.totalOrders}  (UNIFIED, non-faisal, balPay on paidAt)`);

    // --- Engine C: getOutletDetailed → UNIFIED module (same call) ---
    const uC = await computeUnifiedSalesSummary(prisma, { outlet, start, end });
    console.log(`C. OutletDetailed     : totalSales=${uC.totalSales.toFixed(2)}  (orders=${uC.totalOrders}, returns=${uC.returns.length})`);

    // --- Engine D: computeBookSummary (saleRevenue ALL incl faisal + balance) ---
    const dAll = await prisma.posSale.findMany({
      where: { outletName: outlet, createdAt: { gte: start, lte: end } },
      select: { id: true, grandTotal: true, advanceAmount: true, faisalTake: true, createdAt: true }
    });
    const aBal = await prisma.posBalancePayment.findMany({
      where: { posSale: { outletName: outlet }, paidAt: { gte: start, lte: end } },
      select: { amountPaidNow: true, paidAt: true }
    });
    const dTotal = dAll.reduce((s, x) => s + saleRevenue(x), 0) + aBal.reduce((s, b) => s + (b.amountPaidNow || 0), 0);
    console.log(`D. Book summary       : totalSales=${dTotal.toFixed(2)}  (saleRevenue ALL ${dAll.length} incl faisal + ${aBal.length} balPay)`);

    // Delta vs the published register value
    const register = { 'Johar Town': 118903, 'Jail Road': 43736 }[outlet];
    if (register !== undefined) {
      console.log(`   register(closed)=${register}  |A-reg|=${Math.abs(aTotal - register).toFixed(2)}  |B-reg|=${Math.abs(uB.totalSales - register).toFixed(2)}  |C-reg|=${Math.abs(uC.totalSales - register).toFixed(2)}  |D-reg|=${Math.abs(dTotal - register).toFixed(2)}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
