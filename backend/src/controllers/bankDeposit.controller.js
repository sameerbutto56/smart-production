const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const notify = require('../utils/notify');
const {
  CUTOFF_DATE,
  calculateAuthoritativeDailyCash,
  syncDailyRequirements,
  getDailyDeposits,
  submitDailyDeposit,
} = require('./dailyDeposit.controller');

const getOutletName = (req) => {
  if (req.query.outlet) return req.query.outlet;
  if (req.body.outlet) return req.body.outlet;
  if (req.params.outlet) return req.params.outlet;
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
    if (!employee) return res.status(400).json({ message: 'Employee not found for this outlet' });
    if (!employee.isActive) return res.status(403).json({ message: 'Employee account is inactive' });
    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) return res.status(400).json({ message: 'Invalid password' });
    res.json({ name: employee.name, outletName: employee.outletName, message: 'Authenticated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
};

// Submit bank deposit (authoritative FIFO allocation)
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
    if (!employee) return res.status(400).json({ message: 'Employee not found' });
    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) return res.status(400).json({ message: 'Invalid password' });

    // Delegate to authoritative submitDailyDeposit
    req.params.outletName = outlet;
    req.body.amount = parseFloat(amount);
    req.body.referenceNumber = slipNumber;
    req.body.actualDepositDate = depositDate;
    req.body.notes = notes;
    req.body.employeeName = employeeName;

    return submitDailyDeposit(req, res);
  } catch (error) {
    console.error('Bank deposit error:', error);
    res.status(500).json({ message: 'Failed to record bank deposit', error: error.message });
  }
};

// Get deposits for an outlet (authoritative daily ledger)
const getDeposits = async (req, res) => {
  const outlet = getOutletName(req);
  req.params.outletName = outlet;
  return getDailyDeposits(req, res);
};

// Get deposits by outlet name (for admin dashboard)
const getDepositsByOutlet = async (req, res) => {
  const { outlet } = req.params;
  req.params.outletName = outlet;
  return getDailyDeposits(req, res);
};

module.exports = {
  authEmployee,
  submitDeposit,
  getDeposits,
  getDepositsByOutlet,
};
