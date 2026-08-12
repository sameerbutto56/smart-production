/* posUnified.js — SINGLE source of truth for POS sales/revenue calculations.
 *
 * Every dashboard (POS Dashboard, Outlet Dashboard "POS Sales" card, Admin
 * Outlet Detailed, Register/Close Book) must derive its Sales figures from
 * THIS module so the same outlet + date range always shows identical numbers.
 *
 * Canonical rules (verified against the closed register / POS History / Excel):
 *  - Faisal Takes are NOT sales — they are separate and excluded from revenue
 *    (consistent with getSalesDashboard + getOutletDetailed; a dedicated
 *    faisalTakes list remains available to callers).
 *  - Revenue per sale: advanceAmount > 0 ? min(advance, grandTotal) : grandTotal
 *    (advance/balance sales count only what was collected on the sale date).
 *  - Balance payments are separate financial transactions — added by their
 *    paidAt date via amountPaidNow, NEVER counted as a new sale.
 *  - Returns are deducted on their processing (createdAt) date via refundAmount.
 *  - Net Revenue = Total Sales − Discounts − Returns − General Entries/Expenses:
 *    Gross/Total Sales → minus Total Discount → minus Refunds/Returned Amounts →
 *    minus Journal Expenses → Net Revenue. Every component is computed within the
 *    same date window, so a per-period filter always recalculates all four figures.
 */
const KNOWN_METHODS = ['CASH', 'CARD', 'ONLINE', 'CASH_ONLINE'];

const saleRevenue = (s) => (s && s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : (s?.grandTotal || 0));

/* Fetch + compute the canonical POS summary for an outlet/date window.
 * @param prisma        PrismaClient
 * @param outlet        outlet name (optional → all branches when omitted)
 * @param start/end     ISO/Date window (sale createdAt / bp paidAt / return createdAt)
 * @param cashier       optional cashier filter on sales
 * Returns { grossSales, totalSales, totalOrders, refundAmount, netRevenue, totalDiscount,
 *           totalBalanceCollections, totalJournalExpenses, totalBankDeposits,
 *           paymentBreakdown, salesByDay, ordersByDay, bestSellingProducts,
 *           sales, balancePayments, returns }
 * grossSales = totalSales + totalDiscount (received revenue before discounts are applied).
 * netRevenue = totalSales − totalDiscount − refundAmount − totalJournalExpenses.
 */
const computeUnifiedSalesSummary = async (prisma, { outlet, start, end, cashier }) => {
  const dayFilter = {};
  if (start) dayFilter.gte = start;
  if (end) dayFilter.lte = end;

  const saleWhere = { faisalTake: { not: true } };
  if (outlet) saleWhere.outletName = outlet;
  if (cashier) saleWhere.cashierName = cashier;
  if (Object.keys(dayFilter).length) saleWhere.createdAt = dayFilter;

  const returnWhere = { ...(outlet ? { outletName: outlet } : {}) };
  if (Object.keys(dayFilter).length) returnWhere.createdAt = dayFilter;

  const bpWhere = { ...(outlet ? { posSale: { outletName: outlet } } : {}) };
  if (Object.keys(dayFilter).length) bpWhere.paidAt = dayFilter;

  const jbWhere = { ...(outlet ? { outletName: outlet } : {}) };
  if (Object.keys(dayFilter).length) jbWhere.createdAt = dayFilter;

  const [sales, balancePayments, returns, journalAgg, bankDepAgg, discountAgg, saleItems] = await Promise.all([
    prisma.posSale.findMany({
      where: saleWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, createdAt: true, grandTotal: true, advanceAmount: true, receiptNumber: true,
        outletName: true, paymentMethod: true, orderId: true, orderNumber: true, cashierName: true,
        cashAmount: true, onlineAmount: true, discountAmount: true,
      },
    }),
    prisma.posBalancePayment.findMany({
      where: bpWhere,
      orderBy: { paidAt: 'asc' },
      select: { posSaleId: true, amountPaidNow: true, paidAt: true, paymentMethod: true, cashAmount: true, onlineAmount: true, posSale: { select: { outletName: true } } },
    }),
    prisma.posReturn.findMany({
      where: returnWhere,
      include: { sale: { select: { paymentMethod: true, cashAmount: true, onlineAmount: true } } },
    }),
    prisma.journalEntry.aggregate({ where: jbWhere, _sum: { amount: true } }),
    prisma.bankDeposit.aggregate({ where: jbWhere, _sum: { amount: true } }),
    prisma.posSale.aggregate({ where: saleWhere, _sum: { discountAmount: true } }),
    prisma.posSaleItem.findMany({ where: { sale: saleWhere }, select: { productName: true, quantity: true } }),
  ]);

  let totalSales = 0;
  sales.forEach((s) => { totalSales += saleRevenue(s); });

  const balancePaymentTotal = balancePayments.reduce((sum, bp) => sum + (bp.amountPaidNow || 0), 0);
  totalSales += balancePaymentTotal;

  const refundAmount = returns.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
  const totalDiscount = discountAgg._sum.discountAmount || 0;
  const totalJournalExpenses = journalAgg._sum.amount || 0;
  const grossSales = totalSales + totalDiscount;
  const netRevenue = Math.max(0, totalSales - totalDiscount - refundAmount - totalJournalExpenses);
  const totalBankDeposits = bankDepAgg._sum.amount || 0;

  // Payment totals — non-overlapping (CASH_ONLINE is its own bucket; cash/online split carried separately)
  const paymentTotals = {};
  sales.forEach((s) => {
    const received = saleRevenue(s);
    const method = s.paymentMethod === 'CASH_ONLINE' ? 'CASH_ONLINE' : (KNOWN_METHODS.includes(s.paymentMethod) ? s.paymentMethod : 'CASH');
    paymentTotals[method] = (paymentTotals[method] || 0) + received;
  });
  balancePayments.forEach((bp) => {
    const method = bp.paymentMethod === 'CASH_ONLINE' ? 'CASH_ONLINE' : (KNOWN_METHODS.includes(bp.paymentMethod) ? bp.paymentMethod : 'CASH');
    paymentTotals[method] = (paymentTotals[method] || 0) + (bp.amountPaidNow || 0);
  });

  const returnsByMethod = {};
  returns.forEach((r) => {
    const method = r.sale?.paymentMethod === 'CASH_ONLINE' ? 'CASH_ONLINE' : (KNOWN_METHODS.includes(r.sale?.paymentMethod) ? r.sale?.paymentMethod : 'CASH');
    returnsByMethod[method] = (returnsByMethod[method] || 0) + (r.refundAmount || 0);
  });

  const paymentBreakdown = KNOWN_METHODS.map((method) => {
    const gross = paymentTotals[method] || 0;
    const ret = returnsByMethod[method] || 0;
    let net = gross - ret;
    if (method === 'CASH') net -= (totalJournalExpenses + totalBankDeposits);
    return { method, gross, returns: ret, net };
  });

  const salesByDay = {};
  const ordersByDay = {};
  sales.forEach((s) => {
    const day = new Date(s.createdAt).toISOString().split('T')[0];
    salesByDay[day] = (salesByDay[day] || 0) + saleRevenue(s);
    ordersByDay[day] = (ordersByDay[day] || 0) + 1;
  });
  balancePayments.forEach((bp) => {
    if (!bp.paidAt) return;
    const day = new Date(bp.paidAt).toISOString().split('T')[0];
    salesByDay[day] = (salesByDay[day] || 0) + (bp.amountPaidNow || 0);
  });

  const productCounts = {};
  saleItems.forEach((item) => {
    productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity;
  });
  const bestSellingProducts = Object.entries(productCounts)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return {
    grossSales,
    totalSales,
    totalOrders: sales.length,
    refundAmount,
    netRevenue,
    totalDiscount,
    totalBalanceCollections: balancePaymentTotal,
    totalJournalExpenses,
    totalBankDeposits,
    paymentBreakdown,
    salesByDay,
    ordersByDay,
    bestSellingProducts,
    sales,
    balancePayments,
    returns,
  };
};

module.exports = { computeUnifiedSalesSummary, saleRevenue, KNOWN_METHODS };
