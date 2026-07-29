const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const notify = require('../utils/notify');

const getOutletName = (req) => {
  if (req.query.outlet) return req.query.outlet;
  if (req.body.outlet) return req.body.outlet;
  const n = String(req.user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return req.user?.name || 'Outlet';
};

// Authenticate employee
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

// Submit bank deposit
const submitDeposit = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { employeeName, password, slipNumber, amount, notes, depositDate } = req.body;

    if (!employeeName || !password || !slipNumber || !amount) {
      return res.status(400).json({ message: 'Employee name, password, slip number, and amount are required' });
    }
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const employee = await prisma.outletEmployee.findUnique({
      where: { name_outletName: { name: employeeName, outletName: outlet } }
    });
    if (!employee) return res.status(401).json({ message: 'Employee not found' });
    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) return res.status(401).json({ message: 'Invalid password' });

    const existing = await prisma.bankDeposit.findFirst({
      where: { slipNumber: slipNumber.trim(), outletName: outlet }
    });
    if (existing) {
      return res.status(400).json({ message: `Slip number ${slipNumber} already exists for this outlet` });
    }

    const deposit = await prisma.bankDeposit.create({
      data: {
        outletName: outlet,
        employeeName,
        slipNumber: slipNumber.trim(),
        amount: parseFloat(amount),
        notes: notes || null,
        status: 'COMPLETED',
        createdBy: req.user?.name || employeeName,
        createdAt: depositDate ? new Date(depositDate) : new Date(),
      }
    });

    await notify.create(req, { type: 'bank_deposit', moduleName: 'Bank Deposit', path: '/bank-deposit', role: 'ADMIN', title: 'New Bank Deposit', message: `PKR ${amount} deposited by ${employeeName}`, action: 'Bank Deposit', employeeName: req.user?.name }).catch(() => {});

    res.status(201).json({ message: 'Bank deposit recorded successfully', deposit });
  } catch (error) {
    console.error('Bank deposit error:', error);
    res.status(500).json({ message: 'Failed to record bank deposit', error: error.message });
  }
};

// Get deposits for an outlet
const getDeposits = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { dateFrom, dateTo, search } = req.query;

    const where = { outletName: outlet };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }
    if (search) {
      where.OR = [
        { slipNumber: { contains: search, mode: 'insensitive' } },
        { employeeName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const deposits = await prisma.bankDeposit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const totalAmount = deposits.reduce((s, d) => s + d.amount, 0);

    res.json({ deposits, totalAmount, count: deposits.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deposits', error: error.message });
  }
};

// Get deposits by outlet name (for admin dashboard)
const getDepositsByOutlet = async (req, res) => {
  try {
    const { outlet } = req.params;
    const { dateFrom, dateTo, search } = req.query;

    const where = { outletName: outlet };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }
    if (search) {
      where.OR = [
        { slipNumber: { contains: search, mode: 'insensitive' } },
        { employeeName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const deposits = await prisma.bankDeposit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const totalAmount = deposits.reduce((s, d) => s + d.amount, 0);

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayDeposits = deposits.filter(d => new Date(d.createdAt) >= todayStart);
    const monthDeposits = deposits.filter(d => new Date(d.createdAt) >= monthStart);

    res.json({
      deposits,
      totalAmount,
      count: deposits.length,
      todayAmount: todayDeposits.reduce((s, d) => s + d.amount, 0),
      todayCount: todayDeposits.length,
      monthAmount: monthDeposits.reduce((s, d) => s + d.amount, 0),
      monthCount: monthDeposits.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deposits', error: error.message });
  }
};

module.exports = { authEmployee, submitDeposit, getDeposits, getDepositsByOutlet };
