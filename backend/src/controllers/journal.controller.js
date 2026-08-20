const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { computeUnifiedSalesSummary } = require('../utils/posUnified');

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
    if (!employee) return res.status(401).json({ message: 'Employee not found for this outlet' });
    if (!employee.isActive) return res.status(401).json({ message: 'Employee account is inactive' });
    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) return res.status(401).json({ message: 'Invalid password' });
    res.json({ name: employee.name, outletName: employee.outletName, message: 'Authenticated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
};

// Create journal entry and deduct from cash
const createJournalEntry = async (req, res) => {
  try {
    const { employeeName, expenseTitle, amount, notes } = req.body;
    const outlet = getOutletName(req);
    if (!employeeName || !expenseTitle || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Employee name, expense title, and positive amount are required' });
    }
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
      data: { employeeName, outletName: outlet, expenseTitle, amount: parseFloat(amount), notes: notes || null }
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create journal entry', error: error.message });
  }
};

// Get journal entries for an outlet
const getJournalEntries = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const entries = await prisma.journalEntry.findMany({
      where: { outletName: outlet },
      orderBy: { createdAt: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch journal entries', error: error.message });
  }
};

// Get cash summary for an outlet — today's cash only (or custom range)
const getCashSummary = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Accept optional dateFrom/dateTo query params
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : today;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : new Date();

    const summary = await computeUnifiedSalesSummary(prisma, {
      outlet,
      start: dateFrom,
      end: dateTo
    });

    const cashBreakdown = (summary.paymentBreakdown || []).find(p => p.method === 'CASH') || { gross: 0, returns: 0, net: 0 };

    const totalCashCollected = cashBreakdown.gross;
    const totalCashRefunded = cashBreakdown.returns;
    const totalExpenses = summary.totalJournalExpenses || 0;
    const totalBankDeposits = summary.totalBankDeposits || 0;
    const netCash = totalCashCollected - totalCashRefunded;
    const availableCash = netCash - totalExpenses - totalBankDeposits;
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ totalCashCollected, totalCashRefunded, totalExpenses, totalBankDeposits, netCash, availableCash });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get cash summary', error: error.message });
  }
};

module.exports = { authEmployee, createJournalEntry, getJournalEntries, getCashSummary };
