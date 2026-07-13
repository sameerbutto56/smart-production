const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

// Get cash summary for an outlet
const getCashSummary = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    // Total cash from CASH sales (non-refunded, non-Faisal)
    const cashSalesAgg = await prisma.posSale.aggregate({
      where: { outletName: outlet, paymentMethod: 'CASH', refundedAt: null, faisalTake: { not: true } },
      _sum: { grandTotal: true }
    });
    // Total cash from CASH_ONLINE split payments
    const cashOnlineAgg = await prisma.posSale.aggregate({
      where: { outletName: outlet, paymentMethod: 'CASH_ONLINE', refundedAt: null, faisalTake: { not: true } },
      _sum: { cashAmount: true }
    });
    // Total cash refunded
    const cashRefundedAgg = await prisma.posReturn.aggregate({
      where: { outletName: outlet, refundPaymentMethod: 'CASH' },
      _sum: { refundAmount: true }
    });
    // Total journal expenses
    const journalAgg = await prisma.journalEntry.aggregate({
      where: { outletName: outlet },
      _sum: { amount: true }
    });
    const totalCashCollected = (cashSalesAgg._sum.grandTotal || 0) + (cashOnlineAgg._sum.cashAmount || 0);
    const totalCashRefunded = cashRefundedAgg._sum.refundAmount || 0;
    const totalExpenses = journalAgg._sum.amount || 0;
    const netCash = totalCashCollected - totalCashRefunded;
    const availableCash = netCash - totalExpenses;
    res.json({ totalCashCollected, totalCashRefunded, totalExpenses, netCash, availableCash });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get cash summary', error: error.message });
  }
};

module.exports = { authEmployee, createJournalEntry, getJournalEntries, getCashSummary };
