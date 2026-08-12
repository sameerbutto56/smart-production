const prisma = require('../prisma');
const notify = require('../utils/notify');
const { computeSalesSummary } = require('./pos.controller');

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
    await notify.create(req, { type: 'register_open', moduleName: 'POS', path: '/pos', role: 'OUTLET', title: 'Register Opened', message: `${outlet} register opened by ${openedBy}`, action: 'Register Opened', employeeName: req.user?.name }).catch(() => {});
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

// Pure computation of a register (book) session summary — shared by the Close Book /
// Register detail endpoint and the historical reconciliation backfill so a closed
// register always shows the same figures as POS History / Excel for its business day.
const computeBookSummary = async (session) => {
  const outlet = session.outletName;
  const startTime = session.openedAt;
  // A CLOSED register covers the full business day (00:00 → 23:59:59.999) so its figures
  // exactly match POS History / Excel export for the same date. An OPEN register runs to now.
  let endTime = session.closedAt ? new Date(startTime) : new Date();
  if (session.closedAt) endTime.setHours(23, 59, 59, 999);
  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayFilter = { gte: dayStart, lte: endTime };

    // Parallel queries
    const [allSales, returns, journals, balancePayments, bankDeposits] = await Promise.all([
      // ALL sales in day range (incl. Faisal Takes + refunded) — matches POS History invoice list
      prisma.posSale.findMany({
        where: { outletName: outlet, createdAt: dayFilter },
        orderBy: { createdAt: 'asc' },
      }),
      // Returns in day range — ALL returns (incl. those not linked to a POS sale) so the register
      // matches POS History / Excel / Dashboard, which count every refund in the range.
      prisma.posReturn.findMany({
        where: { outletName: outlet, createdAt: dayFilter },
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
      // Bank deposits in day range
      prisma.bankDeposit.findMany({
        where: { outletName: outlet, createdAt: dayFilter },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Canonical totals shared with POS History / Excel export — guaranteed identical by construction
    const shared = await computeSalesSummary(prisma, {
      outlet, start: dayStart, end: endTime,
      _sales: allSales, _returns: returns, _journals: journals, _balancePayments: balancePayments,
    });

    // All sales (incl. Faisal Takes + refunded) — revenue counts on the SALE day; the refund
    // is deducted on its processing date via returnSummary (matches POS History / Dashboard /
    // Excel under the shared canonical convention). Faisal Takes ARE sales (match History).
    const sales = allSales;
    const faisalTakes = allSales.filter(s => s.faisalTake);

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
        paymentSummary.CASH += cashPortion;
        paymentSummary.ONLINE += onlinePortion;
        paymentSummary.CASH_ONLINE_CASH += cashPortion;
        paymentSummary.CASH_ONLINE_ONLINE += onlinePortion;
        paymentSummary.CASH_ONLINE_TOTAL += revenue;
        employeeMap[cashier].CASH += cashPortion;
        employeeMap[cashier].ONLINE += onlinePortion;
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
      if (method === 'CASH_ONLINE') {
        const cashPortion = bp.cashAmount !== null && bp.cashAmount !== undefined ? bp.cashAmount : (bp.amountPaidNow / 2);
        const onlinePortion = bp.onlineAmount !== null && bp.onlineAmount !== undefined ? bp.onlineAmount : (bp.amountPaidNow / 2);
        paymentSummary.CASH += cashPortion;
        paymentSummary.ONLINE += onlinePortion;
        paymentSummary.CASH_ONLINE_TOTAL += bp.amountPaidNow;
        paymentSummary.CASH_ONLINE_CASH += cashPortion;
        paymentSummary.CASH_ONLINE_ONLINE += onlinePortion;
        employeeMap[cashier].CASH += cashPortion;
        employeeMap[cashier].ONLINE += onlinePortion;
        employeeMap[cashier].CASH_ONLINE_TOTAL += bp.amountPaidNow;
        employeeMap[cashier].CASH_ONLINE_CASH += cashPortion;
        employeeMap[cashier].CASH_ONLINE_ONLINE += onlinePortion;
      } else if (paymentSummary[method] !== undefined) {
        paymentSummary[method] += bp.amountPaidNow;
        if (employeeMap[cashier][method] !== undefined) employeeMap[cashier][method] += bp.amountPaidNow;
      }
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

    // Bank deposits total — cash moved to bank, deducted from till
    const totalBankDeposits = bankDeposits.reduce((s, d) => s + d.amount, 0);

    const totalCashSales = paymentSummary.CASH;
    const totalCardSales = paymentSummary.CARD;
    const totalOnlineSales = paymentSummary.ONLINE;
    const totalRevenueSales = shared.grandTotal;

    // Cash actually collected — count sales cash + balance payments cash
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
        }, 0)
      + balancePayments
        .reduce((sum, bp) => {
          if (bp.paymentMethod === 'CASH') return sum + (bp.amountPaidNow || 0);
          if (bp.paymentMethod === 'CASH_ONLINE') {
            const cAmt = bp.cashAmount !== null && bp.cashAmount !== undefined ? bp.cashAmount : ((bp.amountPaidNow || 0) / 2);
            return sum + cAmt;
          }
          return sum;
        }, 0);

    // Available cash — Faisal Take cash leaves the till, so it is deducted here.
    // returnSummary.CASH includes CASH_ONLINE cash returns portion (necessary for till calculation)
    const totalCashRefunded = returnSummary.CASH;
    const availableCash = rawCashCollected - totalFaisalTake - totalJournalEntries - totalCashRefunded - totalBankDeposits;

    // Payment breakdown — gross matches the shared summary (incl. Faisal Takes); CASH net deducts
    // Faisal Take cash from the till
    const paymentBreakdown = [
      { method: 'CASH', gross: rawCashCollected, returns: returnSummary.CASH, journalExpenses: totalJournalEntries, bankDeposits: totalBankDeposits, faisalTake: totalFaisalTake, net: rawCashCollected - totalJournalEntries - returnSummary.CASH - totalBankDeposits - totalFaisalTake },
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
      totalSales: allSales.length, // invoice count — matches POS History / Excel for the same date
      totalFaisalTakesCount: faisalTakes.length,
      totalReturnsCount: returns.length,
      totalJournalCount: journals.length,
      totalBalancePaymentCount: balancePayments.length,
      totalBankDeposits,
      bankDeposits,
      sales, // all sales (incl. Faisal Takes + refunded) for drill-down
      grossSales: shared.grandTotal + (shared.discountTotal || 0),
      discountTotal: shared.discountTotal,
      netSales: shared.netSales,
    };

  return summary;
};

// Get book summary for a session (Register detail / Close Book)
const getBookSummary = async (req, res) => {
  try {
    const session = await prisma.posBookSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session) return res.status(404).json({ message: 'Book session not found' });
    const summary = await computeBookSummary(session);
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
    await notify.create(req, { type: 'register_close', moduleName: 'POS', path: '/pos', role: 'OUTLET', title: 'Register Closed', message: `${session.outletName} register closed by ${closedBy}`, action: 'Register Closed', employeeName: req.user?.name }).catch(() => {});
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

module.exports = { openBook, getCurrentBook, getBookById, getBookSummary, computeBookSummary, closeBook, getBookHistory };
