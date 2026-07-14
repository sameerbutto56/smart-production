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
    res.status(500).json({ message: 'Failed to open book', error: error.message });
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
    res.status(500).json({ message: 'Failed to fetch current book', error: error.message });
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

    // Sales in range (non-Faisal, non-refunded)
    const sales = await prisma.posSale.findMany({
      where: {
        outletName: outlet,
        createdAt: { gte: startTime, lte: endTime },
        faisalTake: { not: true },
        refundedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Faisal Takes in range
    const faisalTakes = await prisma.posSale.findMany({
      where: {
        outletName: outlet,
        createdAt: { gte: startTime, lte: endTime },
        faisalTake: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Returns in range
    const returns = await prisma.posReturn.findMany({
      where: { outletName: outlet, createdAt: { gte: startTime, lte: endTime } },
    });

    // Journal entries in range
    const journals = await prisma.journalEntry.findMany({
      where: { outletName: outlet, createdAt: { gte: startTime, lte: endTime } },
      orderBy: { createdAt: 'asc' },
    });

    // Payment summary
    const paymentSummary = { CASH: 0, CARD: 0, ONLINE: 0, CASH_ONLINE_CASH: 0, CASH_ONLINE_ONLINE: 0, CASH_ONLINE_TOTAL: 0 };
    const employeeMap = {};

    for (const s of sales) {
      const cashier = s.cashierName || 'Unknown';
      if (!employeeMap[cashier]) {
        employeeMap[cashier] = { CASH: 0, CARD: 0, ONLINE: 0, CASH_ONLINE_CASH: 0, CASH_ONLINE_ONLINE: 0, CASH_ONLINE_TOTAL: 0, total: 0, salesCount: 0 };
      }

      if (s.paymentMethod === 'CASH_ONLINE') {
        const c = s.cashAmount || 0;
        const o = s.onlineAmount || 0;
        paymentSummary.CASH_ONLINE_CASH += c;
        paymentSummary.CASH_ONLINE_ONLINE += o;
        paymentSummary.CASH_ONLINE_TOTAL += c + o;
        employeeMap[cashier].CASH_ONLINE_CASH += c;
        employeeMap[cashier].CASH_ONLINE_ONLINE += o;
        employeeMap[cashier].CASH_ONLINE_TOTAL += c + o;
      } else {
        const method = s.paymentMethod;
        if (paymentSummary[method] !== undefined) {
          paymentSummary[method] += s.grandTotal;
        }
        if (employeeMap[cashier][method] !== undefined) {
          employeeMap[cashier][method] += s.grandTotal;
        }
      }
      employeeMap[cashier].total += s.grandTotal;
      employeeMap[cashier].salesCount += 1;
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
    const returnSummary = { CASH: 0, CARD: 0, ONLINE: 0, total: 0 };
    for (const r of returns) {
      const method = r.refundPaymentMethod;
      if (returnSummary[method] !== undefined) returnSummary[method] += r.refundAmount;
      returnSummary.total += r.refundAmount;
    }

    // Journal entries total
    const totalJournalEntries = journals.reduce((s, j) => s + j.amount, 0);

    // Totals
    const totalCashSales = paymentSummary.CASH + paymentSummary.CASH_ONLINE_CASH;
    const totalCardSales = paymentSummary.CARD;
    const totalOnlineSales = paymentSummary.ONLINE + paymentSummary.CASH_ONLINE_ONLINE;
    const grandTotalSales = sales.reduce((s, sale) => s + sale.grandTotal, 0);

    // Available cash
    const totalCashRefunded = returnSummary.CASH;
    const availableCash = totalCashSales - totalJournalEntries - totalCashRefunded;

    const employeeCollections = Object.entries(employeeMap).map(([name, data]) => ({
      name,
      cash: data.CASH + data.CASH_ONLINE_CASH,
      card: data.CARD,
      online: data.ONLINE + data.CASH_ONLINE_ONLINE,
      cashOnlineCash: data.CASH_ONLINE_CASH,
      cashOnlineOnline: data.CASH_ONLINE_ONLINE,
      total: data.total,
      salesCount: data.salesCount,
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
        grandTotal: grandTotalSales,
      },
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
    res.status(500).json({ message: 'Failed to close book', error: error.message });
  }
};

module.exports = { openBook, getCurrentBook, getBookById, getBookSummary, closeBook };
