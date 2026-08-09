require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../src/prisma');
const { computeBookSummary } = require('../src/controllers/pos.book.controller');

const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];
const saleRevenue = (s) => (s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal);

async function reconcileOne(session) {
  const outlet = session.outletName;
  const openedAt = new Date(session.openedAt);
  const closed = !!session.closedAt;
  const start = new Date(openedAt);
  start.setHours(0, 0, 0, 0);
  const end = closed ? new Date(start) : new Date();
  if (closed) end.setHours(23, 59, 59, 999);
  const window = { gte: start, lte: end };

  // A) Register summary (actual exported function)
  const reg = await computeBookSummary(session);

  // B) Dashboard-equivalent (getSalesDashboard logic: non-Faisal revenue + balance payments in window)
  const dashSales = await prisma.posSale.findMany({
    where: { outletName: outlet, createdAt: window, faisalTake: { not: true } },
    select: { grandTotal: true, advanceAmount: true },
  });
  const dashBalance = await prisma.posBalancePayment.findMany({
    where: { posSale: { outletName: outlet }, paidAt: window },
    select: { amountPaidNow: true },
  });
  let dashTotal = 0;
  dashSales.forEach((s) => { dashTotal += saleRevenue(s); });
  dashBalance.forEach((bp) => { dashTotal += bp.amountPaidNow || 0; });

  // C) OutletDetailed-equivalent (non-Faisal revenue + balance payments by paidAt)
  //    == same formula as Dashboard; computed identically so it should match by construction.
  const detailSales = await prisma.posSale.findMany({
    where: { outletName: outlet, createdAt: window },
    select: { grandTotal: true, advanceAmount: true, faisalTake: true },
  });
  let detailTotal = 0;
  detailSales.filter((s) => !s.faisalTake).forEach((s) => { detailTotal += saleRevenue(s); });
  detailSales.forEach((s) => { if (s.faisalTake) detailTotal += 0; }); // excluded
  dashBalance.forEach((bp) => { detailTotal += bp.amountPaidNow || 0; });

  // D) History-equivalent (getSales: sum of _amountReceived over sales in window).
  //    NOTE: _amountReceived is a PER-INVOICE running total (advance + all balance
  //    payments on that invoice), so it intentionally excludes balance payments made
  //    in-window on invoices created BEFORE the window — those are date-based revenue
  //    (counted by the Register/Dashboard on their paidAt date).
  const histSales = await prisma.posSale.findMany({
    where: { outletName: outlet, createdAt: window },
    select: { id: true, grandTotal: true, advanceAmount: true, balancePayments: { select: { amountPaidNow: true } } },
  });
  let histReceived = 0;
  histSales.forEach((s) => {
    const adv = s.advanceAmount || 0;
    const bpSum = (s.balancePayments || []).reduce((sum, b) => sum + (b.amountPaidNow || 0), 0);
    const received = adv === 0 && (!s.balancePayments || s.balancePayments.length === 0) ? (s.grandTotal || 0) : (adv + bpSum);
    histReceived += received;
  });
  const histSaleIds = histSales.map((s) => s.id);

  // Today's Balance Collections = balance payments PAID in-window (on any invoice).
  const collections = await prisma.posBalancePayment.findMany({
    where: { posSale: { outletName: outlet }, paidAt: window },
    select: { posSaleId: true, amountPaidNow: true },
  });
  const totalCollections = collections.reduce((s, b) => s + (b.amountPaidNow || 0), 0);
  // Cross-day portion: paid in-window on invoices created BEFORE the window
  // (in Register/Dashboard but NOT in History's per-invoice _amountReceived sum).
  const crossDayBP = collections
    .filter((b) => !histSaleIds.includes(b.posSaleId))
    .reduce((s, b) => s + (b.amountPaidNow || 0), 0);

  const faisalRev = detailSales.filter((s) => s.faisalTake).reduce((sum, s) => sum + saleRevenue(s), 0);

  console.log('==========================================================');
  console.log(`${outlet} | session ${session.id?.slice(0, 8)} | ${closed ? 'CLOSED' : 'OPEN'} | opened ${openedAt.toISOString()}`);
  console.log(`  window: ${start.toISOString()} -> ${end.toISOString()}`);
  console.log(`  A) Register paymentSummary.grandTotal  : ${reg.paymentSummary.grandTotal}`);
  console.log(`     Register netSales                    : ${reg.netSales}`);
  console.log(`     Register totalFaisalTake             : ${reg.totalFaisalTake}`);
  console.log(`     Register availableCash               : ${reg.availableCash}`);
  console.log(`     Register invoiceCount (totalSales)   : ${reg.totalSales}`);
  console.log(`  B) Dashboard totalSales (non-Faisal)    : ${dashTotal}`);
  console.log(`  C) OutletDetailed totalSales (non-Fais) : ${detailTotal}`);
  console.log(`  D) History sum(_amountReceived)         : ${histReceived}`);
  console.log(`  Balance collections paid in-window      : ${totalCollections}  (cross-day on older invoices: ${crossDayBP})`);
  console.log(`  Faisal revenue in window (excluded B/C) : ${faisalRev}`);
  console.log(`  CHECK B==C        : ${dashTotal === detailTotal ? 'PASS' : 'FAIL ' + (dashTotal - detailTotal)}`);
  console.log(`  CHECK B+Faisal==A : ${(dashTotal + faisalRev).toFixed(2) === reg.paymentSummary.grandTotal.toFixed(2) ? 'PASS' : 'FAIL ' + ((dashTotal + faisalRev) - reg.paymentSummary.grandTotal)}`);
  // Reconciliation formula: History per-invoice revenue + cross-day balance collections == Register
  // (Register = actual POS transactions + valid balance collections − applicable returns).
  const recFormula = histReceived + crossDayBP;
  console.log(`  CHECK D+crossBP==A: ${recFormula.toFixed(2) === reg.paymentSummary.grandTotal.toFixed(2) ? 'PASS' : 'FAIL ' + (recFormula - reg.paymentSummary.grandTotal)}`);
}

async function withRetry(fn, attempts = 5, delayMs = 3000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (String(e.message || '').includes('Can.t reach database')) {
        console.error(`  pooler unreachable (attempt ${i + 1}/${attempts}), retrying...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function run() {
  for (const outlet of OUTLETS) {
    const closedSessions = await withRetry(() => prisma.posBookSession.findMany({
      where: { outletName: outlet, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take: 5,
    }));
    const openSession = await withRetry(() => prisma.posBookSession.findFirst({
      where: { outletName: outlet, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    }));
    const toRun = [...closedSessions];
    if (openSession) toRun.push(openSession);
    for (const s of toRun) {
      try { await reconcileOne(s); } catch (e) { console.error(`  ERROR on ${outlet} session ${s.id}:`, e.message); }
    }
  }
  await prisma.$disconnect();
}

run();
