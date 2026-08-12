const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const cache = require('../utils/cache');
const { computeBookSummary } = require('./pos.book.controller');

const PROFILE_OPTIONS = ['POS', 'OUTLET_ORDER_ENTRY', 'DISPATCH', 'FAISAL_PROFILE', 'INVENTORY_VIEW', 'STORE', 'PRODUCTION'];

const METHOD_LABELS = { CASH: 'Cash', ONLINE: 'Online', CARD: 'Card', CASH_ONLINE: 'Cash+Online' };
const PURE_METHODS = ['CASH', 'ONLINE', 'CARD'];
const KNOWN_POS_OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const normalizeProfiles = (profiles) => {
  if (!Array.isArray(profiles)) return [];
  return [...new Set(profiles.filter(p => PROFILE_OPTIONS.includes(p)))];
};

const getAllEmployees = async (req, res) => {
  try {
    const employees = await prisma.outletEmployee.findMany({
      orderBy: [{ outletName: 'asc' }, { name: 'asc' }],
    });
    res.json({
      employees: employees.map(e => ({
        id: e.id,
        name: e.name,
        outletName: e.outletName,
        profiles: Array.isArray(e.profiles) ? e.profiles : [],
        isActive: e.isActive,
      })),
      profileOptions: PROFILE_OPTIONS,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
};

const createEmployee = async (req, res) => {
  try {
    const { name, outletName, password, profiles, isActive } = req.body || {};
    const empName = (name || '').toString().trim();
    const empOutlet = (outletName || '').toString().trim();
    const empPass = (password || '').toString();

    if (!empName) return res.status(400).json({ message: 'Employee name is required' });
    if (!empOutlet) return res.status(400).json({ message: 'Outlet is required' });
    if (empPass.length < 4) return res.status(400).json({ message: 'Password must be at least 4 characters' });

    const existing = await prisma.outletEmployee.findUnique({
      where: { name_outletName: { name: empName, outletName: empOutlet } },
    });
    if (existing) {
      return res.status(409).json({ message: `Employee "${empName}" already exists at ${empOutlet}` });
    }

    const employee = await prisma.outletEmployee.create({
      data: {
        name: empName,
        outletName: empOutlet,
        password: await bcrypt.hash(empPass, 10),
        profiles: normalizeProfiles(profiles),
        isActive: isActive !== false,
      },
    });
    res.status(201).json({ ok: true, employee: { id: employee.id, name: employee.name, outletName: employee.outletName, profiles: employee.profiles, isActive: employee.isActive } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create employee', error: error.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, outletName, profiles, isActive } = req.body || {};

    const employee = await prisma.outletEmployee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const data = {};
    if (name !== undefined) data.name = (name || '').toString().trim();
    if (outletName !== undefined) data.outletName = (outletName || '').toString().trim();
    if (profiles !== undefined) data.profiles = normalizeProfiles(profiles);
    if (isActive !== undefined) data.isActive = !!isActive;

    if (data.name && data.outletName) {
      const clash = await prisma.outletEmployee.findUnique({
        where: { name_outletName: { name: data.name, outletName: data.outletName } },
      });
      if (clash && clash.id !== id) {
        return res.status(409).json({ message: `Employee "${data.name}" already exists at ${data.outletName}` });
      }
    }

    const updated = await prisma.outletEmployee.update({ where: { id }, data });
    res.json({ ok: true, employee: { id: updated.id, name: updated.name, outletName: updated.outletName, profiles: updated.profiles, isActive: updated.isActive } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update employee', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    const newPass = (password || '').toString();
    if (newPass.length < 4) return res.status(400).json({ message: 'Password must be at least 4 characters' });

    const employee = await prisma.outletEmployee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    await prisma.outletEmployee.update({ where: { id }, data: { password: await bcrypt.hash(newPass, 10) } });
    res.json({ ok: true, message: `Password reset for ${employee.name}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

const verifyEmployee = async (req, res) => {
  try {
    const { name, password, outlet, profile } = req.body || {};
    const empName = (name || '').toString().trim();
    const empPass = (password || '').toString();

    if (!empName) return res.status(400).json({ message: 'Employee name is required' });
    if (!empPass) return res.status(400).json({ message: 'Password is required' });

    const where = { name: empName, isActive: true };
    const employee = outlet
      ? await prisma.outletEmployee.findFirst({ where: { ...where, outletName: outlet } })
      : await prisma.outletEmployee.findFirst({ where, orderBy: { updatedAt: 'desc' } });

    if (!employee) {
      return res.status(401).json({ message: outlet ? `No employee "${empName}" found at ${outlet}` : `No employee "${empName}" found` });
    }

    if (profile) {
      const profiles = Array.isArray(employee.profiles) ? employee.profiles : [];
      if (!profiles.includes(profile)) {
        return res.status(403).json({ message: `"${empName}" does not have access to this module` });
      }
    }

    const match = await bcrypt.compare(empPass, employee.password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    res.json({
      ok: true,
      employee: {
        id: employee.id,
        name: employee.name,
        outletName: employee.outletName,
        profiles: Array.isArray(employee.profiles) ? employee.profiles : [],
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify employee', error: error.message });
  }
};

/* ─── Payment Method Change ─── */

const getPaymentChangeOutlets = async (req, res) => {
  try {
    const [saleOutlets, inventoryOutlets, employeeOutlets] = await Promise.all([
      prisma.posSale.groupBy({ by: ['outletName'], _count: { _all: true } }),
      prisma.outletInventory.groupBy({ by: ['outletName'], _count: { _all: true } }),
      prisma.outletEmployee.groupBy({ by: ['outletName'], _count: { _all: true } }),
    ]);
    const seen = new Set();
    const outlets = [];
    const push = (name) => {
      const clean = String(name || '').trim();
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      outlets.push(clean);
    };
    KNOWN_POS_OUTLETS.forEach(push);
    saleOutlets.forEach(o => push(o.outletName));
    inventoryOutlets.forEach(o => push(o.outletName));
    employeeOutlets.forEach(o => push(o.outletName));
    res.json(outlets);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch outlets', error: error.message });
  }
};

const getPaymentChangeInvoices = async (req, res) => {
  try {
    const { outlet, search } = req.query;
    if (!outlet) return res.status(400).json({ message: 'Outlet is required' });

    const where = { outletName: outlet, faisalTake: { not: true } };
    const q = String(search || '').trim();
    if (q) {
      // Also match order-linked sales by Order invoiceNumber / orderNumber.
      const orderMatches = await prisma.order.findMany({
        where: { OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { orderNumber: { contains: q, mode: 'insensitive' } }] },
        select: { id: true },
      });
      where.OR = [
        { receiptNumber: { contains: q, mode: 'insensitive' } },
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        ...(orderMatches.length ? [{ orderId: { in: orderMatches.map(o => o.id) } }] : []),
      ];
    }

    const sales = await prisma.posSale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true, receiptNumber: true, orderNumber: true, orderId: true,
        customerName: true, customerPhone: true, grandTotal: true, advanceAmount: true,
        cashAmount: true, onlineAmount: true, paymentMethod: true, createdAt: true,
        cashierName: true, refundedAt: true,
        balancePayments: { select: { amountPaidNow: true } },
      },
    });

    const orderIds = [...new Set(sales.filter(s => s.orderId).map(s => s.orderId))];
    const orderMap = new Map();
    if (orderIds.length) {
      const orders = await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, invoiceNumber: true } });
      orders.forEach(o => orderMap.set(o.id, o.invoiceNumber));
    }

    const result = sales.map(s => {
      const fullyPaidAtCheckout = (s.advanceAmount === 0 && s.balancePayments.length === 0);
      const paid = fullyPaidAtCheckout ? s.grandTotal : (s.advanceAmount || 0) + s.balancePayments.reduce((sum, bp) => sum + (bp.amountPaidNow || 0), 0);
      const remaining = fullyPaidAtCheckout ? 0 : Math.max(0, s.grandTotal - paid);
      const { balancePayments, ...saleData } = s;
      return { ...saleData, invoiceNumber: s.orderId ? (orderMap.get(s.orderId) || null) : null, paid, remaining };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch invoices', error: error.message });
  }
};

const getPaymentChangeHistory = async (req, res) => {
  try {
    const { outlet } = req.query;
    const where = outlet ? { outletName: outlet } : {};
    const logs = await prisma.paymentMethodChangeLog.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: 200,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch change history', error: error.message });
  }
};

const changePaymentMethod = async (req, res) => {
  try {
    const { saleId, newMethod } = req.body || {};
    if (!saleId) return res.status(400).json({ message: 'saleId is required' });
    if (!PURE_METHODS.includes(newMethod)) {
      return res.status(400).json({ message: 'newMethod must be one of: Cash, Online, Card' });
    }

    const sale = await prisma.posSale.findUnique({
      where: { id: saleId },
      select: {
        id: true, receiptNumber: true, orderNumber: true, orderId: true, customerName: true,
        grandTotal: true, advanceAmount: true, paymentMethod: true, cashAmount: true,
        onlineAmount: true, outletName: true, faisalTake: true, createdAt: true,
      },
    });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    if (sale.faisalTake) return res.status(400).json({ message: 'Faisal Take invoices cannot be changed' });
    if (sale.paymentMethod === newMethod) {
      return res.status(400).json({ message: `This invoice is already paid via ${METHOD_LABELS[newMethod] || newMethod}` });
    }

    const previousMethod = sale.paymentMethod;
    // The amount that actually moved between method buckets = the revenue counted for this
    // sale (advance>0 → min(advance, grandTotal); otherwise full grandTotal) — matches
    // posUnified / computeSalesSummary so dashboards and registers stay consistent.
    const amountMoved = sale.advanceAmount > 0 ? Math.min(sale.advanceAmount, sale.grandTotal) : sale.grandTotal;

    let invoiceNumber = null;
    if (sale.orderId) {
      const order = await prisma.order.findUnique({ where: { id: sale.orderId }, select: { invoiceNumber: true } });
      invoiceNumber = order?.invoiceNumber || null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.posSale.update({
        where: { id: saleId },
        data: { paymentMethod: newMethod, cashAmount: 0, onlineAmount: 0 },
        select: { id: true, receiptNumber: true, paymentMethod: true, cashAmount: true, onlineAmount: true },
      });
      await tx.paymentMethodChangeLog.create({
        data: {
          outletName: sale.outletName,
          saleId,
          receiptNumber: sale.receiptNumber,
          orderNumber: sale.orderNumber,
          invoiceNumber,
          customerName: sale.customerName,
          grandTotal: sale.grandTotal,
          amountMoved,
          previousMethod,
          newMethod,
          changedBy: req.user?.id || '',
          changedByName: req.user?.name || null,
        },
      });
      return u;
    }, { timeout: 30000 });

    // Invalidate all POS financial caches so every reader (History, Dashboard, Outlet
    // Detailed, Summary) reflects the new method on its next fetch.
    try {
      cache.delPattern('pos:dashboard:');
      cache.delPattern('pos:sales:');
      cache.delPattern('pos:summary:');
      cache.delPattern('outlet:analytics:');
    } catch (cacheErr) {
      console.error('[paymentChange] cache invalidation error:', cacheErr.message);
    }

    // Keep closed Register (Close Book) history consistent: recompute the stored summary
    // of every CLOSED session whose business day contains this invoice's sale date.
    try {
      const saleDate = new Date(sale.createdAt);
      const sessions = await prisma.posBookSession.findMany({
        where: { outletName: sale.outletName, status: 'CLOSED' },
        select: { id: true, outletName: true, openedAt: true, closedAt: true },
      });
      const matched = sessions.filter(s => {
        const o = new Date(s.openedAt);
        return o.getFullYear() === saleDate.getFullYear() && o.getMonth() === saleDate.getMonth() && o.getDate() === saleDate.getDate();
      });
      for (const session of matched) {
        const summary = await computeBookSummary(session);
        await prisma.posBookSession.update({ where: { id: session.id }, data: { summary: JSON.stringify(summary) } });
      }
    } catch (recomputeErr) {
      console.error('[paymentChange] register recompute error:', recomputeErr.message);
    }

    if (req.app.get('io')) {
      req.app.get('io').emit('inventory-updated', { source: 'payment-change', outletName: sale.outletName, saleId });
    }

    res.json({
      ok: true,
      message: `Payment method changed from ${METHOD_LABELS[previousMethod] || previousMethod} to ${METHOD_LABELS[newMethod]} for ${sale.receiptNumber}`,
      updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change payment method', error: error.message });
  }
};

const DEFAULT_DELAY_CONFIG = {
  VERIFICATION: { acceptanceMinutes: 30, totalHours: 2 },
  STORE: { acceptanceMinutes: 30, totalHours: 4 },
  LOGO: { acceptanceMinutes: 30, totalHours: 3 },
  PRODUCTION: { acceptanceMinutes: 30, totalHours: 24 },
  DISPATCH: { acceptanceMinutes: 30, totalHours: 4 }
};

const getDelayConfig = async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
    let config = { ...DEFAULT_DELAY_CONFIG };
    if (setting && setting.value) {
      try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) {}
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch delay configuration', error: error.message });
  }
};

const updateDelayConfig = async (req, res) => {
  try {
    const newConfig = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ message: 'Invalid configuration payload' });
    }
    const updated = await prisma.systemSetting.upsert({
      where: { key: 'DEADLINE_CONFIG' },
      update: { value: JSON.stringify(newConfig) },
      create: { key: 'DEADLINE_CONFIG', value: JSON.stringify(newConfig) }
    });
    cache.delPattern('orders');
    res.json({ ok: true, message: 'Delay configuration saved successfully', config: JSON.parse(updated.value) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save delay configuration', error: error.message });
  }
};

module.exports = { getAllEmployees, createEmployee, updateEmployee, resetPassword, verifyEmployee, getPaymentChangeOutlets, getPaymentChangeInvoices, getPaymentChangeHistory, changePaymentMethod, getDelayConfig, updateDelayConfig, DEFAULT_DELAY_CONFIG, PROFILE_OPTIONS };
