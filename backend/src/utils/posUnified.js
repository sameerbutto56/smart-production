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
 *    Total Sales (gross value BEFORE discounts) → minus Total Discount →
 *    minus Refunds/Returned Amounts → minus Journal Expenses → Net Revenue. The
 *    discount is deducted EXACTLY ONCE (never from the already-discounted received
 *    total). Every component is computed within the same date window, so a
 *    per-period filter always recalculates all four figures.
 */
const KNOWN_METHODS = ['CASH', 'CARD', 'ONLINE'];

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
 * totalSales is the GROSS value before discounts (received revenue + discount).
 * netRevenue = totalSales − totalDiscount − refundAmount − totalJournalExpenses
 * (the discount is subtracted exactly once).
 */
const computeUnifiedSalesSummary = async (prisma, { outlet, start, end, cashier, isHalfOpen = true }) => {
  const dayFilter = {};
  if (start) dayFilter.gte = start;
  if (end) {
    if (isHalfOpen) dayFilter.lt = end;
    else dayFilter.lte = end;
  }

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
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        returns: true,
        balancePayments: { select: { amountPaidNow: true, paidAt: true } }
      }
    }),
    prisma.posBalancePayment.findMany({
      where: bpWhere,
      orderBy: { paidAt: 'desc' },
      include: {
        posSale: {
          select: {
            id: true, receiptNumber: true, orderId: true, orderNumber: true,
            customerName: true, customerPhone: true, grandTotal: true,
            advanceAmount: true, outletName: true, cashierName: true
          }
        }
      }
    }),
    prisma.posReturn.findMany({
      where: returnWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        sale: {
          select: {
            id: true, receiptNumber: true, orderId: true, orderNumber: true,
            customerName: true, customerPhone: true, paymentMethod: true,
            cashierName: true, cashAmount: true, onlineAmount: true, grandTotal: true,
            subtotal: true, cardChargesAmount: true, createdAt: true,
            items: true
          }
        }
      }
    }),
    prisma.journalEntry.aggregate({ where: jbWhere, _sum: { amount: true } }),
    prisma.bankDeposit.aggregate({ where: jbWhere, _sum: { amount: true } }),
    prisma.posSale.aggregate({ where: saleWhere, _sum: { discountAmount: true } }),
    prisma.posSaleItem.findMany({ where: { sale: saleWhere }, select: { productName: true, quantity: true } }),
  ]);

  let salesReceived = 0;
  sales.forEach((s) => { salesReceived += saleRevenue(s); });

  const balancePaymentTotal = balancePayments.reduce((sum, bp) => sum + (bp.amountPaidNow || 0), 0);
  const totalReceived = salesReceived + balancePaymentTotal;

  const refundAmount = returns.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
  const totalDiscount = discountAgg._sum.discountAmount || 0;
  const totalJournalExpenses = journalAgg._sum.amount || 0;
  const totalBankDeposits = bankDepAgg._sum.amount || 0;

  // Authoritative definitions:
  // Gross Sales: Total value of goods sold in this window before discounts
  const grossSales = salesReceived + totalDiscount;
  const totalSales = grossSales;
  // Net Sales: Merchandise sales minus discounts and returns
  const netSales = Math.max(0, salesReceived - refundAmount);
  // Net Revenue: Actual net money earned from all operations (sales + balance collections - returns - journal expenses)
  const netRevenue = Math.max(0, totalReceived - refundAmount - totalJournalExpenses);

  // Payment totals — split CASH_ONLINE into CASH and ONLINE buckets
  const paymentTotals = { CASH: 0, CARD: 0, ONLINE: 0 };
  sales.forEach((s) => {
    const received = saleRevenue(s);
    if (s.paymentMethod === 'CASH_ONLINE') {
      const totalCO = (s.cashAmount || 0) + (s.onlineAmount || 0);
      const ratio = totalCO > 0 ? received / totalCO : 1;
      paymentTotals['CASH'] = (paymentTotals['CASH'] || 0) + ((s.cashAmount || 0) * ratio);
      paymentTotals['ONLINE'] = (paymentTotals['ONLINE'] || 0) + ((s.onlineAmount || 0) * ratio);
    } else {
      const method = KNOWN_METHODS.includes(s.paymentMethod) ? s.paymentMethod : 'CASH';
      paymentTotals[method] = (paymentTotals[method] || 0) + received;
    }
  });
  balancePayments.forEach((bp) => {
    if (bp.paymentMethod === 'CASH_ONLINE') {
      const cashPortion = bp.cashAmount !== null && bp.cashAmount !== undefined ? bp.cashAmount : ((bp.amountPaidNow || 0) / 2);
      const onlinePortion = bp.onlineAmount !== null && bp.onlineAmount !== undefined ? bp.onlineAmount : ((bp.amountPaidNow || 0) / 2);
      paymentTotals['CASH'] = (paymentTotals['CASH'] || 0) + cashPortion;
      paymentTotals['ONLINE'] = (paymentTotals['ONLINE'] || 0) + onlinePortion;
    } else {
      const method = KNOWN_METHODS.includes(bp.paymentMethod) ? bp.paymentMethod : 'CASH';
      paymentTotals[method] = (paymentTotals[method] || 0) + (bp.amountPaidNow || 0);
    }
  });

  const returnsByMethod = { CASH: 0, CARD: 0, ONLINE: 0 };
  returns.forEach((r) => {
    const refundMethod = r.refundPaymentMethod || r.sale?.paymentMethod || 'CASH';
    if (refundMethod === 'CASH_ONLINE') {
      const cashAmt = r.sale?.cashAmount || 0;
      const onlineAmt = r.sale?.onlineAmount || 0;
      const total = cashAmt + onlineAmt || 1;
      const cashRatio = cashAmt / total;
      returnsByMethod['CASH'] = (returnsByMethod['CASH'] || 0) + (r.refundAmount * cashRatio);
      returnsByMethod['ONLINE'] = (returnsByMethod['ONLINE'] || 0) + (r.refundAmount * (1 - cashRatio));
    } else {
      const method = KNOWN_METHODS.includes(refundMethod) ? refundMethod : 'CASH';
      returnsByMethod[method] = (returnsByMethod[method] || 0) + (r.refundAmount || 0);
    }
  });

  const paymentBreakdown = KNOWN_METHODS.map((method) => {
    const gross = paymentTotals[method] || 0;
    const ret = returnsByMethod[method] || 0;
    let net = gross - ret;
    if (method === 'CASH') net -= (totalJournalExpenses + totalBankDeposits);
    return { method, gross, returns: ret, net };
  });

  const paymentSummary = {
    cash: paymentTotals['CASH'] || 0,
    card: paymentTotals['CARD'] || 0,
    online: paymentTotals['ONLINE'] || 0,
    cashOnlineTotal: (sales.filter(s => s.paymentMethod === 'CASH_ONLINE').reduce((sum, s) => sum + saleRevenue(s), 0)
      + balancePayments.filter(b => b.paymentMethod === 'CASH_ONLINE').reduce((sum, b) => sum + (b.amountPaidNow || 0), 0)),
    cashCollected: paymentTotals['CASH'] || 0,
    grandTotal: totalReceived,
  };

  const returnSummary = {
    cash: returnsByMethod['CASH'] || 0,
    card: returnsByMethod['CARD'] || 0,
    online: returnsByMethod['ONLINE'] || 0,
    total: refundAmount,
  };

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
    salesReceived,
    totalReceived,
    grandTotal: totalReceived,
    cash: paymentTotals['CASH'] || 0,
    card: paymentTotals['CARD'] || 0,
    online: paymentTotals['ONLINE'] || 0,
    cashOnline: paymentSummary.cashOnlineTotal || 0,
    cashCollected: paymentTotals['CASH'] || 0,
    totalOrders: sales.length,
    invoiceCount: sales.length,
    refundAmount,
    totalReturns: refundAmount,
    netSales,
    netRevenue,
    totalDiscount,
    discountTotal: totalDiscount,
    totalBalanceCollections: balancePaymentTotal,
    totalBalanceCleared: balancePaymentTotal,
    totalJournalExpenses,
    totalBankDeposits,
    paymentTotals,
    paymentSummary,
    returnSummary,
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
