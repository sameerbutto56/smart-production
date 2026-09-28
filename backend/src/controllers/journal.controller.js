const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { computeUnifiedSalesSummary } = require('../utils/posUnified');
const { resolvePktDateRange } = require('../utils/workingHours');

const getOutletName = (req) => {
  if (req.query.outlet) return req.query.outlet;
  const n = String(req.user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return req.user?.name || 'Outlet';
};

// Authenticate employee by name + outlet + password
const authEmployee = async (req, res) => {
  try {
    const { name, password } = req.body;
    const outlet = getOutletName(req);
    if (!name || !password) return res.status(400).json({ message: 'Name and password are required' });
    const employee = await prisma.outletEmployee.findUnique({
      where: { name_outletName: { name, outletName: outlet } }
    });
    if (!employee) return res.status(400).json({ message: 'Employee not found for this outlet' });
    if (!employee.isActive) return res.status(403).json({ message: 'Employee account is inactive' });
    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) return res.status(400).json({ message: 'Invalid password' });
    res.json({ name: employee.name, outletName: employee.outletName, message: 'Authenticated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
};

// Create journal entry and deduct from cash
const createJournalEntry = async (req, res) => {
  try {
    const { employeeName, expenseTitle, amount, paymentMethod, notes } = req.body;
    const outlet = getOutletName(req);
    if (!employeeName || !expenseTitle || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Employee name, expense title, and positive amount are required' });
    }
    const pm = (paymentMethod && ['CASH', 'CARD', 'ONLINE'].includes(String(paymentMethod).toUpperCase()))
      ? String(paymentMethod).toUpperCase()
      : 'CASH';

    // Duplicate guard: reject if same employee+title+amount within 5 seconds
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDuplicate = await prisma.journalEntry.findFirst({
      where: {
        employeeName,
        expenseTitle,
        amount: parseFloat(amount),
        outletName: outlet,
        createdAt: { gte: fiveSecondsAgo }
      },
      orderBy: { createdAt: 'desc' }
    });
    if (recentDuplicate) {
      return res.status(409).json({ message: 'Duplicate entry detected. Please wait a moment before saving again.' });
    }
    const entry = await prisma.journalEntry.create({
      data: {
        employeeName,
        outletName: outlet,
        expenseTitle,
        amount: parseFloat(amount),
        paymentMethod: pm,
        notes: notes || null
      }
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create journal entry', error: error.message });
  }
};

// Get journal entries for an outlet (supporting optional date range)
const getJournalEntries = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { range, dateFrom, dateTo } = req.query;
    const where = { outletName: outlet };

    if (range || dateFrom || dateTo) {
      const { start, end } = resolvePktDateRange({ range, dateFrom, dateTo });
      if (start || end) {
        where.createdAt = {};
        if (start) where.createdAt.gte = start;
        if (end) where.createdAt.lt = end;
      }
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch journal entries', error: error.message });
  }
};

// Get cash summary for an outlet — supports today, custom date, or historical ranges
const getCashSummary = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { range, dateFrom, dateTo } = req.query;
    const { start: dateStart, end: dateEnd } = resolvePktDateRange({
      range: range || (dateFrom ? 'custom' : 'today'),
      dateFrom,
      dateTo,
    });

    const summary = await computeUnifiedSalesSummary(prisma, {
      outlet,
      start: dateStart,
      end: dateEnd,
      isHalfOpen: true,
    });

    const cashBreakdown = (summary.paymentBreakdown || []).find(p => p.method === 'CASH') || { gross: 0, returns: 0, net: 0 };

    const totalCashCollected = cashBreakdown.gross;
    const totalCashRefunded = cashBreakdown.returns;
    const totalExpenses = summary.cashJournalExpenses || summary.totalJournalExpenses || 0;
    const totalBankDeposits = summary.totalBankDeposits || 0;
    const netCash = totalCashCollected - totalCashRefunded;
    // Standard reconciliation formula: Available Cash = Generated Cash - Returns - General Entries
    const availableCash = Math.max(0, netCash - totalExpenses);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      totalCashCollected,
      totalCashRefunded,
      totalExpenses,
      totalBankDeposits,
      netCash,
      availableCash,
      generatedCash: totalCashCollected,
      cashReturns: totalCashRefunded,
      generalEntries: totalExpenses,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get cash summary', error: error.message });
  }
};

module.exports = { authEmployee, createJournalEntry, getJournalEntries, getCashSummary };
