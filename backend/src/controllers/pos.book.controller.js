const prisma = require('../prisma');

const getOutletName = (req) => {
  if (req.query.outlet) return req.query.outlet;
  if (req.body.outlet) return req.body.outlet;
  const n = String(req.user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return req.user?.name || 'Outlet';
};

// Open a new book session
const openBook = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const openedBy = req.body.employeeName || req.user?.name || 'Unknown';

    // Check if there's already an open book
    const existing = await prisma.posBookSession.findFirst({
      where: { outletName: outlet, status: 'OPEN' },
    });
    if (existing) {
      return res.status(400).json({ message: 'A book session is already open for this outlet' });
    }

    const session = await prisma.posBookSession.create({
      data: { outletName: outlet, openedBy, status: 'OPEN' },
    });
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: 'Failed to open register', error: error.message });
  }
};

// Get current open book for an outlet
const getCurrentBook = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const session = await prisma.posBookSession.findFirst({
      where: { outletName: outlet, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch current register', error: error.message });
  }
};

// Get book session by id
const getBookById = async (req, res) => {
  try {
    const session = await prisma.posBookSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session) return res.status(404).json({ message: 'Book session not found' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch book session', error: error.message });
  }
};

// Compute summary for a book session
const getBookSummary = async (req, res) => {
  try {
    const session = await prisma.posBookSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session) return res.status(404).json({ message: 'Book session not found' });

    const outlet = session.outletName;
    const startTime = session.openedAt;
    const endTime = session.closedAt || new Date();

    // Use start of day for all queries (matches Dashboard's getCashSummary range)
    const dayStart = new Date(startTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayFilter = { gte: dayStart, lte: endTime };

    // Parallel queries
    const [sales, faisalTakes, returns, journals, balancePayments] = await Promise.all([
      // Sales in day range (matches Dashboard's cash summary)
      prisma.posSale.findMany({
        where: { outletName: outlet, createdAt: dayFilter, faisalTake: { not: true }, refundedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      // Faisal Takes in day range
      prisma.posSale.findMany({
        where: { outletName: outlet, createdAt: dayFilter, faisalTake: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Returns in day range
      prisma.posReturn.findMany({
        where: { outletName: outlet, createdAt: dayFilter, saleId: { not: null } },
        include: { sale: { select: { paymentMethod: true, cashAmount: true, onlineAmount: true } } },
      }),
      // Journal entries from start of day (match Dashboard's getCashSummary range)
      prisma.journalEntry.findMany({
        where: { outletName: outlet, createdAt: dayFilter },
        orderBy: { createdAt: 'asc' },
      }),
      // Balance payments in day range
      prisma.posBalancePayment.findMany({
        where: {
          posSale: { outletName: outlet },
          paidAt: dayFilter,
        },
        orderBy: { paidAt: 'asc' },
      }),
    ]);

    // Revenue calculation matching getSalesDashboard
    const saleRevenue = (s) => s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;

    // Payment summary — by revenue received (not invoice total)
    const paymentSummary = { CASH: 0, CARD: 0, ONLINE: 0, CASH_ONLINE_CASH: 0, CASH_ONLINE_ONLINE: 0, CASH_ONLINE_TOTAL: 0 };
    const employeeMap = {};

    for (const s of sales) {
      const cashier = s.cashierName || 'Unknown';
      if (!employeeMap[cashier]) {
        employeeMap[cashier] = { CASH: 0, CARD: 0, ONLINE: 0, CASH_ONLINE_CASH: 0, CASH_ONLINE_ONLINE: 0, CASH_ONLINE_TOTAL: 0, total: 0, revenue: 0, salesCount: 0, sales: [] };
      }

      const revenue = saleRevenue(s);

      if (s.paymentMethod === 'CASH_ONLINE') {
        const totalCashOnline = (s.cashAmount || 0) + (s.onlineAmount || 0);
        const ratio = totalCashOnline > 0 ? revenue / totalCashOnline : 1;
        const cashPortion = (s.cashAmount || 0) * ratio;
        const onlinePortion = (s.onlineAmount || 0) * ratio;
        paymentSummary.CASH_ONLINE_CASH += cashPortion;
        paymentSummary.CASH_ONLINE_ONLINE += onlinePortion;
        paymentSummary.CASH_ONLINE_TOTAL += revenue;
        employeeMap[cashier].CASH_ONLINE_CASH += cashPortion;
        employeeMap[cashier].CASH_ONLINE_ONLINE += onlinePortion;
        employeeMap[cashier].CASH_ONLINE_TOTAL += revenue;
      } else {
        const method = s.paymentMethod;
        if (paymentSummary[method] !== undefined) {
          paymentSummary[method] += revenue;
        }
        if (employeeMap[cashier][method] !== undefined) {
          employeeMap[cashier][method] += revenue;
        }
      }
      employeeMap[cashier].total += revenue;
      employeeMap[cashier].revenue += revenue;
      employeeMap[cashier].salesCount += 1;
      employeeMap[cashier].sales.push({
        id: s.id,
        receiptNumber: s.receiptNumber,
        customerName: s.customerName,
        grandTotal: s.grandTotal,
        paymentMethod: s.paymentMethod,
        cashAmount: s.cashAmount,
        onlineAmount: s.onlineAmount,
        createdAt: s.createdAt,
        advanceAmount: s.advanceAmount,
        revenue,
      });
    }

    // Add balance payments to totals and employee map
    for (const bp of balancePayments) {
      const cashier = bp.cashierName || 'Unknown';
      if (!employeeMap[cashier]) {
        employeeMap[cashier] = { CASH: 0, CARD: 0, ONLINE: 0, CASH_ONLINE_CASH: 0, CASH_ONLINE_ONLINE: 0, CASH_ONLINE_TOTAL: 0, total: 0, revenue: 0, salesCount: 0, sales: [] };
      }
      const method = bp.paymentMethod;
      if (paymentSummary[method] !== undefined) paymentSummary[method] += bp.amountPaidNow;
      if (employeeMap[cashier][method] !== undefined) employeeMap[cashier][method] += bp.amountPaidNow;
      employeeMap[cashier].total += bp.amountPaidNow;
      employeeMap[cashier].revenue += bp.amountPaidNow;
      employeeMap[cashier].salesCount += 1;
      employeeMap[cashier].sales.push({
        id: bp.posSaleId,
        receiptNumber: `BAL-${bp.posSaleId?.slice(0, 6)}`,
        customerName: `Balance Payment (${bp.paymentMethod})`,
        grandTotal: bp.amountPaidNow,
        paymentMethod: bp.paymentMethod,
        cashAmount: bp.paymentMethod === 'CASH' ? bp.amountPaidNow : 0,
        onlineAmount: bp.paymentMethod === 'ONLINE' ? bp.amountPaidNow : 0,
        createdAt: bp.paidAt,
        advanceAmount: 0,
        revenue: bp.amountPaidNow,
        isBalancePayment: true,
      });
    }

    // Faisal Takes total
    let totalFaisalTake = 0;
    const faiEmployees = {};
    for (const ft of faisalTakes) {
      totalFaisalTake += ft.grandTotal;
      const c = ft.cashierName || 'Unknown';
      if (!faiEmployees[c]) faiEmployees[c] = 0;
      faiEmployees[c] += ft.grandTotal;
    }

    // Returns summary
    // CASH_ONLINE returns are split: cash portion → returnSummary.CASH (needed for availableCash / till deduction),
    // full amount → returnSummary.CASH_ONLINE. ONLINE returns stay pure (no CASH_ONLINE online portion) to avoid
    // double-counting in the non-overlapping Payment Summary display.
    const returnSummary = { CASH: 0, CARD: 0, ONLINE: 0, CASH_ONLINE: 0, total: 0 };
    for (const r of returns) {
      if (r.sale?.paymentMethod === 'CASH_ONLINE' && (r.sale?.cashAmount || r.sale?.onlineAmount)) {
        const total = (r.sale.cashAmount || 0) + (r.sale.onlineAmount || 0) || 1;
        const cashRatio = (r.sale.cashAmount || 0) / total;
        returnSummary.CASH += r.refundAmount * cashRatio;
        returnSummary.CASH_ONLINE += r.refundAmount;
      } else {
        const method = r.refundPaymentMethod;
        if (returnSummary[method] !== undefined) returnSummary[method] += r.refundAmount;
      }
      returnSummary.total += r.refundAmount;
    }

    // Journal entries total
    const totalJournalEntries = journals.reduce((s, j) => s + j.amount, 0);

    // Totals — Cash+Online cash portion is included in cash, online portion in online
    const totalCashSales = paymentSummary.CASH + paymentSummary.CASH_ONLINE_CASH;
    const totalCardSales = paymentSummary.CARD;
    const totalOnlineSales = paymentSummary.ONLINE + paymentSummary.CASH_ONLINE_ONLINE;
    const totalRevenueSales = sales.reduce((s, sale) => s + saleRevenue(sale), 0) + balancePayments.reduce((s, bp) => s + bp.amountPaidNow, 0);

    // Cash actually collected — only count what was received, not invoice total
    const rawCashCollected = sales
      .filter(s => s.paymentMethod === 'CASH')
      .reduce((sum, s) => sum + saleRevenue(s), 0)
      + sales
        .filter(s => s.paymentMethod === 'CASH_ONLINE')
        .reduce((sum, s) => {
          const revenue = saleRevenue(s);
          const totalCO = (s.cashAmount || 0) + (s.onlineAmount || 0);
          const ratio = totalCO > 0 ? (s.cashAmount || 0) / totalCO : 1;
          return sum + revenue * ratio;
        }, 0);

    // Available cash — using raw cash amounts to match Dashboard
    // returnSummary.CASH includes CASH_ONLINE cash returns portion (necessary for till calculation)
    const totalCashRefunded = returnSummary.CASH;
    const availableCash = rawCashCollected - totalJournalEntries - totalCashRefunded;

    // Payment breakdown — ONLINE returns are pure (no CASH_ONLINE portion) to match non-overlapping Payment Summary
    const paymentBreakdown = [
      { method: 'CASH', gross: rawCashCollected, returns: returnSummary.CASH, journalExpenses: totalJournalEntries, net: rawCashCollected - totalJournalEntries - returnSummary.CASH },
      { method: 'CARD', gross: totalCardSales, returns: returnSummary.CARD, journalExpenses: 0, net: totalCardSales - returnSummary.CARD },
      { method: 'ONLINE', gross: totalOnlineSales, returns: returnSummary.ONLINE, journalExpenses: 0, net: totalOnlineSales - returnSummary.ONLINE },
    ];

    const employeeCollections = Object.entries(employeeMap).map(([name, data]) => ({
      name,
      cash: data.CASH + data.CASH_ONLINE_CASH,
      card: data.CARD,
      online: data.ONLINE + data.CASH_ONLINE_ONLINE,
      cashOnlineCash: data.CASH_ONLINE_CASH,
      cashOnlineOnline: data.CASH_ONLINE_ONLINE,
      total: data.total,
      revenue: data.revenue,
      salesCount: data.salesCount,
      sales: data.sales,
    }));

    const summary = {
      openedAt: session.openedAt,
      openedBy: session.openedBy,
      paymentSummary: {
        cash: totalCashSales,
        card: totalCardSales,
        online: totalOnlineSales,
        cashOnlineCash: paymentSummary.CASH_ONLINE_CASH,
        cashOnlineOnline: paymentSummary.CASH_ONLINE_ONLINE,
        cashOnlineTotal: paymentSummary.CASH_ONLINE_TOTAL,
        cashCollected: rawCashCollected,
        grandTotal: totalRevenueSales,
      },
      paymentBreakdown,
      employeeCollections,
      totalFaisalTake,
      faisalTakeEmployees: Object.entries(faiEmployees).map(([name, amount]) => ({ name, amount })),
      totalJournalEntries,
      journalEntries: journals,
      returnSummary: {
        cash: returnSummary.CASH,
        card: returnSummary.CARD,
        online: returnSummary.ONLINE,
        total: returnSummary.total,
      },
      totalReturns: returnSummary.total,
      availableCash,
      totalSales: sales.length,
      totalFaisalTakesCount: faisalTakes.length,
      totalReturnsCount: returns.length,
      totalJournalCount: journals.length,
      totalBalancePaymentCount: balancePayments.length,
      sales, // full sale objects for drill-down
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Failed to compute book summary', error: error.message });
  }
};

// Close the book
const closeBook = async (req, res) => {
  try {
    const { id } = req.params;
    const closedBy = req.body.closedBy || req.user?.name || 'Unknown';
    const summary = req.body.summary;

    const session = await prisma.posBookSession.findUnique({ where: { id } });
    if (!session) return res.status(404).json({ message: 'Book session not found' });
    if (session.status === 'CLOSED') return res.status(400).json({ message: 'Book session is already closed' });

    const updated = await prisma.posBookSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy,
        summary: JSON.stringify(summary),
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to close register', error: error.message });
  }
};

// List all closed book sessions for an outlet (with optional date range filter)
const getBookHistory = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { dateFrom, dateTo } = req.query;
    const where = { outletName: outlet, status: 'CLOSED' };
    if (dateFrom || dateTo) {
      where.closedAt = {};
      if (dateFrom) where.closedAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.closedAt.lte = to;
      }
    }
    const sessions = await prisma.posBookSession.findMany({
      where,
      orderBy: { closedAt: 'desc' },
    });
    const result = sessions.map(s => {
      const summary = typeof s.summary === 'string' ? JSON.parse(s.summary) : (s.summary || {});
      return { ...s, summary };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch register history', error: error.message });
  }
};

module.exports = { openBook, getCurrentBook, getBookById, getBookSummary, closeBook, getBookHistory };
