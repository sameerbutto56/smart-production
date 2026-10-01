const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const cache = require('../utils/cache');
const { computeBookSummary } = require('./pos.book.controller');
const { DEFAULT_DELAY_CONFIG, computeStageDeadline } = require('../utils/orderDelay');

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
      return res.status(400).json({ ok: false, message: outlet ? `No employee "${empName}" found at ${outlet}` : `No employee "${empName}" found` });
    }

    if (profile) {
      const profiles = Array.isArray(employee.profiles) ? employee.profiles : [];
      if (!profiles.includes(profile)) {
        return res.status(403).json({ ok: false, message: `"${empName}" does not have access to this module` });
      }
    }

    const match = await bcrypt.compare(empPass, employee.password);
    if (!match) {
      return res.status(400).json({ ok: false, message: 'Incorrect password. Please try again.' });
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
    console.error('Failed to fetch dynamic outlets, falling back to known outlets:', error.message);
    res.json(KNOWN_POS_OUTLETS);
  }
};

const getPaymentChangeInvoices = async (req, res) => {
  try {
    const { outlet, search } = req.query;
    if (!outlet) return res.status(400).json({ message: 'Outlet is required' });

    const where = { outletName: outlet, faisalTake: { not: true } };
    const q = String(search || '').trim();
    let bpBySaleId = new Map();
    if (q) {
      // Also match order-linked sales by Order invoiceNumber / orderNumber.
      const orderMatches = await prisma.order.findMany({
        where: { OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { orderNumber: { contains: q, mode: 'insensitive' } }] },
        select: { id: true },
      });
      // Also match balance-payment receipt numbers (BP-…) and resolve to parent PosSale.
      const bpMatches = await prisma.posBalancePayment.findMany({
        where: { receiptNumber: { contains: q, mode: 'insensitive' } },
        select: { id: true, posSaleId: true, receiptNumber: true, amountPaidNow: true, paymentMethod: true, paidAt: true },
      });
      where.OR = [
        { receiptNumber: { contains: q, mode: 'insensitive' } },
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        ...(orderMatches.length ? [{ orderId: { in: orderMatches.map(o => o.id) } }] : []),
        ...(bpMatches.length ? [{ id: { in: bpMatches.map(b => b.posSaleId) } }] : []),
      ];
      // Map posSaleId → matched BP receipt info so frontend can display the searched BP receipt
      bpMatches.forEach(b => { if (b.posSaleId) bpBySaleId.set(b.posSaleId, { id: b.id, receipt: b.receiptNumber, amount: b.amountPaidNow, method: b.paymentMethod, paidAt: b.paidAt }); });
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
        balancePayments: { select: { id: true, amountPaidNow: true, receiptNumber: true, paymentMethod: true, paidAt: true } },
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
      const matchedBP = bpBySaleId.get(s.id) || null;
      return {
        ...saleData,
        invoiceNumber: s.orderId ? (orderMap.get(s.orderId) || null) : null,
        paid, remaining,
        matchedBPReceipt: matchedBP,
        balanceReceipts: balancePayments.map(bp => ({ id: bp.id, receipt: bp.receiptNumber, amount: bp.amountPaidNow, method: bp.paymentMethod, paidAt: bp.paidAt })),
      };
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
    const { saleId, balancePaymentId, newMethod } = req.body || {};
    if (!PURE_METHODS.includes(newMethod)) {
      return res.status(400).json({ message: 'newMethod must be one of: Cash, Online, Card' });
    }

    // ── Balance Payment mode: change only the BP receipt's method ──
    if (balancePaymentId) {
      const bp = await prisma.posBalancePayment.findUnique({
        where: { id: balancePaymentId },
        select: {
          id: true, receiptNumber: true, posSaleId: true, amountPaidNow: true,
          paymentMethod: true, paidAt: true, cashierName: true,
        },
      });
      if (!bp) return res.status(404).json({ message: 'Balance payment not found' });
      if (bp.paymentMethod === newMethod) {
        return res.status(400).json({ message: `This balance payment is already via ${METHOD_LABELS[newMethod] || newMethod}` });
      }

      const sale = await prisma.posSale.findUnique({
        where: { id: bp.posSaleId },
        select: { id: true, receiptNumber: true, orderNumber: true, orderId: true, customerName: true, outletName: true, createdAt: true },
      });

      const previousMethod = bp.paymentMethod;
      const amountMoved = bp.amountPaidNow || 0;

      let invoiceNumber = null;
      if (sale?.orderId) {
        const order = await prisma.order.findUnique({ where: { id: sale.orderId }, select: { invoiceNumber: true } });
        invoiceNumber = order?.invoiceNumber || null;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.posBalancePayment.update({
          where: { id: balancePaymentId },
          data: { paymentMethod: newMethod },
          select: { id: true, receiptNumber: true, paymentMethod: true, amountPaidNow: true },
        });
        await tx.paymentMethodChangeLog.create({
          data: {
            outletName: sale?.outletName || '',
            saleId: bp.posSaleId,
            receiptNumber: bp.receiptNumber,
            orderNumber: sale?.orderNumber || null,
            invoiceNumber,
            customerName: sale?.customerName || null,
            grandTotal: amountMoved,
            amountMoved,
            previousMethod,
            newMethod,
            changedBy: req.user?.id || '',
            changedByName: req.user?.name || null,
          },
        });
        return u;
      }, { timeout: 30000 });

      try {
        cache.delPattern('pos:dashboard:');
        cache.delPattern('pos:sales:');
        cache.delPattern('pos:summary:');
        cache.delPattern('outlet:analytics:');
      } catch (cacheErr) {
        console.error('[paymentChange] cache invalidation error:', cacheErr.message);
      }

      if (req.app.get('io') && sale) {
        req.app.get('io').emit('inventory-updated', { source: 'payment-change', outletName: sale.outletName, saleId: bp.posSaleId });
      }

      return res.json({
        ok: true,
        message: `Balance payment ${METHOD_LABELS[previousMethod] || previousMethod} → ${METHOD_LABELS[newMethod]} for ${bp.receiptNumber}`,
        updated,
        scope: 'balancePayment',
      });
    }

    // ── Standard mode: change the parent PosSale's method ──
    if (!saleId) return res.status(400).json({ message: 'saleId or balancePaymentId is required' });

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

    try {
      cache.delPattern('pos:dashboard:');
      cache.delPattern('pos:sales:');
      cache.delPattern('pos:summary:');
      cache.delPattern('outlet:analytics:');
    } catch (cacheErr) {
      console.error('[paymentChange] cache invalidation error:', cacheErr.message);
    }

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

    try {
      const { invalidateDepositCache, syncDailyRequirements } = require('./dailyDeposit.controller');
      invalidateDepositCache(sale.outletName);
      await syncDailyRequirements(sale.outletName).catch(() => {});
    } catch (depErr) {
      console.error('[paymentChange] daily deposit sync error:', depErr.message);
    }

    if (req.app.get('io')) {
      req.app.get('io').emit('inventory-updated', { source: 'payment-change', outletName: sale.outletName, saleId });
    }

    res.json({
      ok: true,
      message: `Payment method changed from ${METHOD_LABELS[previousMethod] || previousMethod} to ${METHOD_LABELS[newMethod]} for ${sale.receiptNumber}`,
      updated,
      scope: 'sale',
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change payment method', error: error.message });
  }
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

    const parsedConfig = JSON.parse(updated.value);

    // Atomically recalculate and update deadlineAt on all active stages in the database
    try {
      const activeStages = await prisma.orderStage.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'] },
          order: { status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] } }
        },
        select: { id: true, stageName: true, createdAt: true, startedAt: true }
      });

      if (activeStages.length > 0) {
        const updatePromises = activeStages.map((s) => {
          const startMs = s.startedAt ? new Date(s.startedAt).getTime() : new Date(s.createdAt).getTime();
          const newDeadlineMs = computeStageDeadline(s.stageName, startMs, parsedConfig);
          return prisma.orderStage.update({
            where: { id: s.id },
            data: { deadlineAt: new Date(newDeadlineMs) }
          });
        });
        await Promise.all(updatePromises);
      }
    } catch (stageUpdateErr) {
      console.error('[updateDelayConfig] Error recalculating active stage deadlines:', stageUpdateErr.message);
    }

    // Invalidate caches
    cache.delPattern('orders');
    cache.delPattern('pos');
    cache.delPattern('analytics');

    // Broadcast WebSocket updates so open browser profiles update immediately
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('delay-config-updated', { delayConfig: parsedConfig });
        io.emit('order-updated');
      }
    } catch (socketErr) {
      console.error('[updateDelayConfig] Socket broadcast error:', socketErr.message);
    }

    res.json({ ok: true, message: 'Delay configuration saved successfully', config: parsedConfig });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save delay configuration', error: error.message });
  }
};


const getOrderRange = async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'ORDER_RANGE_CONFIG' } });
    let config = { enabled: false, startNumber: '', endNumber: '' };
    if (setting && setting.value) {
      try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) {}
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch order range configuration', error: error.message });
  }
};

const updateOrderRange = async (req, res) => {
  try {
    const { enabled, startNumber, endNumber } = req.body;
    if (enabled && (startNumber === '' || endNumber === '')) {
      return res.status(400).json({ message: 'Both start and end numbers are required when range is enabled.' });
    }
    if (enabled) {
      const start = parseInt(String(startNumber).replace(/^#/, ''), 10);
      const end = parseInt(String(endNumber).replace(/^#/, ''), 10);
      if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0) {
        return res.status(400).json({ message: 'Start and end numbers must be positive integers.' });
      }
      if (start > end) {
        return res.status(400).json({ message: 'Start number must be less than or equal to end number.' });
      }
    }
    const config = {
      enabled: Boolean(enabled),
      startNumber: enabled ? String(startNumber).replace(/^#/, '') : '',
      endNumber: enabled ? String(endNumber).replace(/^#/, '') : '',
    };
    await prisma.systemSetting.upsert({
      where: { key: 'ORDER_RANGE_CONFIG' },
      update: { value: JSON.stringify(config) },
      create: { key: 'ORDER_RANGE_CONFIG', value: JSON.stringify(config) },
    });
    res.json({ ok: true, message: 'Order range configuration saved successfully', config });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save order range configuration', error: error.message });
  }
};

// GET /api/software-settings/delete-invoice/lookup — find invoice details before permanent deletion
const lookupInvoiceForDeletion = async (req, res) => {
  try {
    const query = String(req.query.query || req.query.invoiceNumber || '').trim();
    const outlet = String(req.query.outlet || '').trim();
    if (!query) return res.status(400).json({ message: 'Invoice number or order number is required' });

    const cleanQ = query.replace(/^#/, '');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
    const hasOutletFilter = outlet && outlet !== 'ALL' && outlet !== 'All Outlets';

    // 1. Search Order table
    const orderWhere = {
      OR: [
        { invoiceNumber: { equals: query, mode: 'insensitive' } },
        { orderNumber: { equals: query, mode: 'insensitive' } },
        { orderNumber: { equals: `#${cleanQ}`, mode: 'insensitive' } },
        ...(cleanQ !== query ? [{ invoiceNumber: { equals: cleanQ, mode: 'insensitive' } }] : []),
        ...(isUUID ? [{ id: query }] : [])
      ]
    };
    if (hasOutletFilter) {
      orderWhere.outletName = { equals: outlet, mode: 'insensitive' };
    }

    const order = await prisma.order.findFirst({
      where: orderWhere,
      include: {
        orderAcceptances: true,
        deliveryAttempts: true,
        deliveryPayments: true,
        deliveryChargeRecords: true,
        noResponseLogs: true,
        returnExchangeCases: true,
        createdBy: { select: { name: true } }
      }
    });

    if (order) {
      let items = [];
      if (order.productDetails) {
        try {
          const pd = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
          if (Array.isArray(pd)) {
            items = pd.map((p, idx) => ({
              id: p.id || `item-${idx + 1}`,
              name: p.productType || p.name || `Article ${idx + 1}`,
              quantity: p.quantity || 1,
              price: p.unitPrice || p.price || 0
            }));
          }
        } catch (e) {}
      }

      return res.json({
        found: true,
        targetType: 'ORDER',
        id: order.id,
        invoiceNumber: order.invoiceNumber || order.orderNumber,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        outletName: order.outletName || 'Online/Warehouse',
        createdAt: order.createdAt,
        totalAmount: order.totalPrice || 0,
        advanceAmount: order.advanceAmount || 0,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        currentStage: order.currentStage,
        status: order.status,
        createdBy: order.createdBy?.name || 'System',
        items,
        relatedRecords: {
          itemsCount: items.length,
          paymentsCount: (order.deliveryPayments || []).length,
          attemptsCount: (order.deliveryAttempts || []).length,
          acceptancesCount: (order.orderAcceptances || []).length,
          returnCasesCount: (order.returnExchangeCases || []).length
        }
      });
    }

    // 2. Search PosSale table
    const posSaleWhere = {
      OR: [
        { receiptNumber: { equals: query, mode: 'insensitive' } },
        { receiptNumber: { equals: `RCP-${cleanQ}`, mode: 'insensitive' } },
        { receiptNumber: { contains: cleanQ, mode: 'insensitive' } },
        { orderNumber: { equals: query, mode: 'insensitive' } },
        { clientRequestId: { equals: query, mode: 'insensitive' } },
        ...(isUUID ? [{ id: query }, { orderId: query }] : [])
      ]
    };
    if (hasOutletFilter) {
      posSaleWhere.outletName = { equals: outlet, mode: 'insensitive' };
    }

    const posSale = await prisma.posSale.findFirst({
      where: posSaleWhere,
      include: {
        items: true,
        balancePayments: true,
        returns: true
      }
    });

    if (posSale) {
      return res.json({
        found: true,
        targetType: 'POS_SALE',
        id: posSale.id,
        invoiceNumber: posSale.receiptNumber,
        orderNumber: posSale.orderNumber || posSale.receiptNumber,
        customerName: posSale.customerName || 'Walk-in Customer',
        customerPhone: posSale.customerPhone || '—',
        outletName: posSale.outletName || 'POS Outlet',
        createdAt: posSale.createdAt,
        totalAmount: posSale.grandTotal || 0,
        advanceAmount: posSale.advanceAmount || 0,
        paymentMethod: posSale.paymentMethod,
        paymentStatus: posSale.refundedAt ? 'REFUNDED' : 'PAID',
        currentStage: 'COMPLETED',
        status: posSale.refundedAt ? 'REFUNDED' : 'COMPLETED',
        createdBy: posSale.cashierName || 'Cashier',
        items: (posSale.items || []).map(i => ({
          id: i.id,
          name: i.productName || 'POS Item',
          quantity: i.quantity || 1,
          price: i.unitPrice || i.lineTotal || 0
        })),
        relatedRecords: {
          itemsCount: (posSale.items || []).length,
          paymentsCount: (posSale.balancePayments || []).length,
          returnsCount: (posSale.returns || []).length
        }
      });
    }

    // 3. Search VendorOrder table (only if not restricted to specific POS outlet)
    if (!hasOutletFilter) {
      const vendorOrderWhere = {
        OR: [
          { invoiceNumber: { equals: query, mode: 'insensitive' } },
          { quotationNumber: { equals: query, mode: 'insensitive' } },
          { orderNumber: { equals: query, mode: 'insensitive' } },
          { orderNumber: { equals: `#${cleanQ}`, mode: 'insensitive' } },
          ...(isUUID ? [{ id: query }] : [])
        ]
      };

      const vendorOrder = await prisma.vendorOrder.findFirst({
        where: vendorOrderWhere,
        include: {
          vendor: { select: { name: true } },
          asm: { select: { name: true } },
          items: true,
          payments: true,
          deliveries: true
        }
      });

      if (vendorOrder) {
        return res.json({
          found: true,
          targetType: 'VENDOR_ORDER',
          id: vendorOrder.id,
          invoiceNumber: vendorOrder.invoiceNumber || vendorOrder.orderNumber,
          orderNumber: vendorOrder.orderNumber,
          customerName: vendorOrder.vendor?.name || 'Vendor',
          customerPhone: '—',
          outletName: 'Vendor ASM',
          createdAt: vendorOrder.createdAt,
          totalAmount: vendorOrder.grandTotal || 0,
          advanceAmount: vendorOrder.advancePaid || 0,
          paymentMethod: 'VENDOR',
          paymentStatus: vendorOrder.status,
          currentStage: vendorOrder.currentStage || vendorOrder.status,
          status: vendorOrder.status,
          createdBy: vendorOrder.asm?.name || 'ASM',
          items: (vendorOrder.items || []).map(i => ({
            id: i.id,
            name: i.productName || 'Item',
            quantity: i.quantity || 1,
            price: i.unitPrice || 0
          })),
          relatedRecords: {
            itemsCount: (vendorOrder.items || []).length,
            paymentsCount: (vendorOrder.payments || []).length,
            deliveriesCount: (vendorOrder.deliveries || []).length
          }
        });
      }
    }

    return res.status(404).json({ message: `No active invoice or sale found matching "${query}"${hasOutletFilter ? ` for ${outlet}` : ''}.` });
  } catch (error) {
    console.error('lookupInvoiceForDeletion error:', error);
    res.status(500).json({ message: 'Failed to lookup invoice', error: error.message });
  }
};

// POST /api/software-settings/delete-invoice/permanent — atomic permanent deletion of invoice and all related records
const deleteInvoicePermanently = async (req, res) => {
  try {
    const { invoiceNumber, targetType, targetId, outlet } = req.body || {};
    const query = String(invoiceNumber || '').trim();
    if (!query && !targetId) {
      return res.status(400).json({ message: 'Invoice number or target ID is required' });
    }

    const cleanQ = query.replace(/^#/, '');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
    const hasOutletFilter = outlet && outlet !== 'ALL' && outlet !== 'All Outlets';

    const result = await prisma.$transaction(async (tx) => {
      let deletedType = null;
      let deletedNumber = query;

      // 1. Check Order
      if (!targetType || targetType === 'ORDER') {
        const orderWhere = {
          OR: [
            ...(targetId && isUUID ? [{ id: targetId }] : []),
            ...(query ? [
              { invoiceNumber: { equals: query, mode: 'insensitive' } },
              { orderNumber: { equals: query, mode: 'insensitive' } },
              { orderNumber: { equals: `#${cleanQ}`, mode: 'insensitive' } },
              ...(isUUID ? [{ id: query }] : [])
            ] : [])
          ]
        };
        if (hasOutletFilter) {
          orderWhere.outletName = { equals: outlet, mode: 'insensitive' };
        }

        const order = await tx.order.findFirst({ where: orderWhere });

        if (order) {
          const orderId = order.id;
          deletedType = 'ORDER';
          deletedNumber = order.invoiceNumber || order.orderNumber;

          await tx.orderAcceptance.deleteMany({ where: { orderId } });
          await tx.deliveryAttempt.deleteMany({ where: { orderId } });
          await tx.deliveryPayment.deleteMany({ where: { orderId } });
          await tx.deliveryCharge.deleteMany({ where: { orderId } });
          await tx.noResponseLog.deleteMany({ where: { orderId } });
          await tx.orderStage.deleteMany({ where: { orderId } });
          await tx.orderEditRequest.deleteMany({ where: { orderId } });
          await tx.orderCancellationRequest.deleteMany({ where: { orderId } });
          await tx.routingHistory.deleteMany({ where: { orderId } });
          await tx.seenTask.deleteMany({ where: { orderId } });
          await tx.dispatchLog.deleteMany({ where: { orderId } });
          await tx.revenueRecord.deleteMany({ where: { orderId } });
          await tx.auditLog.deleteMany({ where: { orderId } });
          await tx.deletedOrder.deleteMany({ where: { orderId } });
          await tx.returnExchange.deleteMany({ where: { orderId } });
          await tx.paymentMethodChangeLog.deleteMany({ where: { saleId: orderId } });

          await tx.order.delete({ where: { id: orderId } });
          return { deletedType, deletedNumber };
        }
      }

      // 2. Check PosSale
      if (!targetType || targetType === 'POS_SALE') {
        const posSaleWhere = {
          OR: [
            ...(targetId && isUUID ? [{ id: targetId }] : []),
            ...(query ? [
              { receiptNumber: { equals: query, mode: 'insensitive' } },
              { receiptNumber: { equals: `RCP-${cleanQ}`, mode: 'insensitive' } },
              { receiptNumber: { contains: cleanQ, mode: 'insensitive' } },
              { orderNumber: { equals: query, mode: 'insensitive' } },
              { clientRequestId: { equals: query, mode: 'insensitive' } },
              ...(isUUID ? [{ id: query }] : [])
            ] : [])
          ]
        };
        if (hasOutletFilter) {
          posSaleWhere.outletName = { equals: outlet, mode: 'insensitive' };
        }

        const posSale = await tx.posSale.findFirst({ where: posSaleWhere });

        if (posSale) {
          const saleId = posSale.id;
          deletedType = 'POS_SALE';
          deletedNumber = posSale.receiptNumber;

          await tx.posSaleItem.deleteMany({ where: { saleId } });
          await tx.posBalancePayment.deleteMany({ where: { posSaleId: saleId } });
          await tx.paymentMethodChangeLog.deleteMany({ where: { saleId } });
          await tx.posReturn.deleteMany({ where: { saleId } });

          await tx.posSale.delete({ where: { id: saleId } });
          return { deletedType, deletedNumber, outletName: posSale.outletName, createdAt: posSale.createdAt };
        }
      }

      // 3. Check VendorOrder
      if (!targetType || targetType === 'VENDOR_ORDER') {
        const vendorOrderWhere = {
          OR: [
            ...(targetId && isUUID ? [{ id: targetId }] : []),
            ...(query ? [
              { invoiceNumber: { equals: query, mode: 'insensitive' } },
              { quotationNumber: { equals: query, mode: 'insensitive' } },
              { orderNumber: { equals: query, mode: 'insensitive' } },
              { orderNumber: { equals: `#${cleanQ}`, mode: 'insensitive' } },
              ...(isUUID ? [{ id: query }] : [])
            ] : [])
          ]
        };

        const vendorOrder = await tx.vendorOrder.findFirst({ where: vendorOrderWhere });

        if (vendorOrder) {
          const vId = vendorOrder.id;
          deletedType = 'VENDOR_ORDER';
          deletedNumber = vendorOrder.invoiceNumber || vendorOrder.orderNumber;

          await tx.vendorOrderItem.deleteMany({ where: { vendorOrderId: vId } });
          await tx.vendorPayment.deleteMany({ where: { orderId: vId } });
          await tx.vendorOrderStatus.deleteMany({ where: { vendorOrderId: vId } });
          await tx.vendorDelivery.deleteMany({ where: { vendorOrderId: vId } });
          await tx.vendorDocument.deleteMany({ where: { vendorOrderId: vId } });
          await tx.vendorOrderAllocation.deleteMany({ where: { orderId: vId } });
          await tx.quotation.deleteMany({ where: { orderId: vId } });
          await tx.invoice.deleteMany({ where: { orderId: vId } });

          await tx.vendorOrder.delete({ where: { id: vId } });
          return { deletedType, deletedNumber };
        }
      }

      return null;
    });

    if (!result) {
      return res.status(404).json({ message: `No active invoice or sale found matching "${query}" to delete.` });
    }

    // Invalidate caches
    cache.delPattern('orders');
    cache.delPattern('pos');
    cache.delPattern('analytics');
    cache.delPattern('delivery');

    if (result && result.deletedType === 'POS_SALE' && result.outletName) {
      try {
        const { computeBookSummary } = require('./pos.book.controller');
        const saleDate = new Date(result.createdAt);
        const sessions = await prisma.posBookSession.findMany({
          where: { outletName: result.outletName, status: 'CLOSED' },
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
        console.error('[deleteInvoice] register recompute error:', recomputeErr.message);
      }

      try {
        const { invalidateDepositCache, syncDailyRequirements } = require('./dailyDeposit.controller');
        invalidateDepositCache(result.outletName);
        await syncDailyRequirements(result.outletName).catch(() => {});
      } catch (depErr) {
        console.error('[deleteInvoice] daily deposit sync error:', depErr.message);
      }
    }

    res.json({
      ok: true,
      message: `Invoice "${result.deletedNumber}" and all associated sales, payment, register, and financial records were permanently deleted.`,
      deletedType: result.deletedType,
      deletedNumber: result.deletedNumber
    });
  } catch (error) {
    console.error('deleteInvoicePermanently error:', error);
    res.status(500).json({ message: 'Failed to delete invoice permanently', error: error.message });
  }
};

module.exports = {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  resetPassword,
  verifyEmployee,
  getPaymentChangeOutlets,
  getPaymentChangeInvoices,
  getPaymentChangeHistory,
  changePaymentMethod,
  getDelayConfig,
  updateDelayConfig,
  getOrderRange,
  updateOrderRange,
  lookupInvoiceForDeletion,
  deleteInvoicePermanently,
  DEFAULT_DELAY_CONFIG,
  PROFILE_OPTIONS
};
