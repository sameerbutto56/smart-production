const prisma = require('../prisma');
const notify = require('../utils/notify');
const { syncReplacementCaseOnOrderCompletion } = require('./order-helpers');
const { markAssignmentTerminal } = require('./tahirSheet.controller');

const parseDateRange = (dateFrom, dateTo) => {
  const dateFilter = {};
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!isNaN(from.getTime())) dateFilter.gte = from;
  }
  if (dateTo) {
    const to = new Date(dateTo);
    if (!isNaN(to.getTime())) { to.setHours(23, 59, 59, 999); dateFilter.lte = to; }
  }
  return Object.keys(dateFilter).length > 0 ? dateFilter : null;
};

// GET /api/delivery/orders — get all delivery orders for delivery boy
const getDeliveryOrders = async (req, res) => {
  try {
    const { deliveryType, dateFrom, dateTo } = req.query;

    // Include only orders that are genuinely active or recently completed.
    // RETURNED / CANCELLED orders are terminal and must NOT appear in the
    // delivery boy's task list (the admin EnamelsDeliveryCard analytics
    // endpoint covers historical data separately).
    const where = {
      OR: [
        { currentStage: { in: ['OUT_FOR_DELIVERY', 'ENAMELS_DELIVERY'] } },
        { currentStage: 'DELIVERED' },
        { status: 'COMPLETED' }
      ],
      status: { notIn: ['RETURNED'] }
    };
    if (deliveryType) {
      const methodMap = { 'ENAMELS': 'Enamels Delivery', 'TCS': 'TCS', 'POST_EX': 'PostEx' };
      const methodStr = methodMap[deliveryType] || deliveryType;
      const deliveryOrs = [{ deliveryType }, { deliveryMethod: methodStr }];
      // Orders routed from In Dispatch / outlet to ENAMELS_DELIVERY may not be
      // tagged with deliveryType/deliveryMethod — match them by stage so the
      // delivery boy sees them.
      if (deliveryType === 'ENAMELS') deliveryOrs.push({ currentStage: 'ENAMELS_DELIVERY' });
      where.AND = [{ OR: deliveryOrs }];
    }
    const dateFilter = parseDateRange(dateFrom, dateTo);
    if (dateFilter) where.createdAt = dateFilter;

    const orders = await prisma.order.findMany({
      where,
      include: {
        stages: { orderBy: { createdAt: 'asc' }, select: { stageName: true, status: true, deadlineAt: true, startedAt: true, completedAt: true } },
        createdBy: { select: { name: true, role: true } },
        deliveryAttempts: { orderBy: { attemptNumber: 'desc' } },
        noResponseLogs: { orderBy: { attemptNumber: 'asc' } },
        deliveryPayments: true,
        orderAcceptances: { orderBy: { assignedAt: 'desc' } },
        deliveryChargeRecords: true,
        returnExchangeCases: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
    });

    // Deduplicate by orderId — a single findMany should never return the
    // same row twice, but this is a safety net against edge-case stage +
    // status overlaps producing duplicate cards.
    const seen = new Set();
    const deduped = [];
    for (const o of orders) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        deduped.push(o);
      }
    }

    res.json(deduped);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch delivery orders', error: error.message });
  }
};

// Shared delivery-return routine: returns the order to Dispatch, marks it RETURNED,
// records the attempt/history/audit and notifies both Dispatch and Inventory View
// (so the returned order feeds the existing Inventory View → Returns flow for restock).
const performDeliveryReturn = async (req, order, riderName, reason, autoReturned) => {
  const now = new Date();
  const activeStage = order.stages?.find(s =>
    ['ENAMELS_DELIVERY', 'OUT_FOR_DELIVERY'].includes(s.stageName) &&
    ['PENDING', 'IN_PROGRESS'].includes(s.status)
  );
  if (activeStage) {
    await prisma.orderStage.update({
      where: { id: activeStage.id },
      data: { status: 'COMPLETED', completedAt: now, rejectionReason: `${autoReturned ? 'Auto-returned after 3 no-response attempts' : `Returned by ${riderName}`}: ${reason || 'No reason'}` }
    });
  }

  // Keep currentStage as the delivery stage (already COMPLETED above).
  // Do NOT set 'DISPATCH' — returned orders go to Inventory View → Returns via ReturnExchange case,
  // not to Dispatch queues. Re-Dispatch from Inventory View will route back to DISPATCH explicitly.
  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'RETURNED', returnedAt: now }
  });

  // Mark delivery assignment as returned so it never carries forward in Gate Pass
  await markAssignmentTerminal(order.id, { returned: true });

  const attemptCount = await prisma.deliveryAttempt.count({ where: { orderId: order.id } });
  await prisma.deliveryAttempt.create({
    data: {
      orderId: order.id,
      attemptNumber: attemptCount + 1,
      status: 'RETURNED',
      riderName: riderName || 'SYSTEM',
      attemptedAt: now,
      notes: autoReturned ? `Auto-returned after 3 no-response attempts: ${reason || ''}` : (reason || 'Returned by delivery boy')
    }
  });

  await prisma.routingHistory.create({
    data: { orderId: order.id, sentByUserId: req.user?.id || null, previousStage: activeStage?.stageName || 'OUT_FOR_DELIVERY', newStage: 'INVENTORY_VIEW', sentToStage: 'INVENTORY_VIEW', remarks: `${autoReturned ? 'Auto-returned after 3 no-response attempts' : `Returned by ${riderName}`}: ${reason || 'No reason'}` }
  });

  await prisma.auditLog.create({
    data: { orderId: order.id, action: autoReturned ? 'DELIVERY_AUTO_RETURNED' : 'DISPATCH_RETURNED', details: `${autoReturned ? 'Auto-returned after 3 no-response attempts' : `Returned by ${riderName}`}: ${reason || 'No reason'}`, performedBy: req.user?.id || 'SYSTEM' }
  });

  // No notification to DISPATCH — returned orders go directly to Inventory View → Returns via ReturnExchange case.

  // Create a ReturnExchange case so the order appears in Inventory View → Returns
  // with PENDING status (awaiting acceptance by Inventory View).
  const parseProductsForCase = (pd) => {
    if (!pd) return [];
    if (typeof pd === 'string') { try { return JSON.parse(pd); } catch { return []; } }
    if (Array.isArray(pd)) return pd;
    return [];
  };
  const existingCase = await prisma.returnExchange.findFirst({
    where: { orderId: order.id, type: 'RETURN', status: 'PENDING' }
  });
  if (!existingCase) {
    await prisma.returnExchange.create({
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        type: 'RETURN',
        status: 'PENDING',
        routedTo: 'INVENTORY_VIEW',
        returnReason: reason || 'Returned from delivery',
        originalProducts: parseProductsForCase(order.productDetails),
        deliveryReturnedBy: riderName || req.user?.name || 'SYSTEM',
        deliveryReturnedById: req.user?.id || null,
        deliveryReturnedAt: now
      }
    });
  }

  await notify.create(req, { type: 'return_exchange', moduleName: 'Return & Exchange', path: '/return-exchange', role: 'INVENTORY_VIEW', title: 'Order Returned from Delivery', message: `Order #${order.orderNumber} returned from delivery — awaiting acceptance`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Return from Delivery', employeeName: req.user?.name }).catch(() => {});

  const io = req.app?.get('io');
  if (io) io.emit('order-updated', { orderId: order.id });
  if (io) io.emit('return-exchange-updated', { orderId: order.id });

  return { returnedAt: now };
};

// PUT /api/delivery/:orderId/accept — delivery boy accepts order
const acceptDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderName } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const now = new Date();
    await prisma.order.update({
      where: { id: orderId },
      data: { riderAcceptedAt: now }
    });
    await prisma.orderAcceptance.create({
      data: { orderId, assignedAt: now, acceptedAt: now, riderName }
    });

    await prisma.routingHistory.create({
      data: { orderId, sentByUserId: req.user?.id || null, previousStage: 'OUT_FOR_DELIVERY', newStage: 'OUT_FOR_DELIVERY', sentToStage: 'OUT_FOR_DELIVERY', remarks: `Rider ${riderName} accepted delivery` }
    });

    await prisma.auditLog.create({
      data: { orderId, action: 'DELIVERY_ACCEPTED', details: `Rider ${riderName} accepted delivery`, performedBy: req.user?.id || 'SYSTEM' }
    });

    await notify.create(req, { type: 'delivery_accepted', moduleName: 'My Tasks', path: '/dispatch', role: 'DISPATCH', title: 'Delivery Accepted', message: `Order #${order.orderNumber} accepted by rider`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Rider Accepted', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: 'Order accepted', riderAcceptedAt: now });
  } catch (error) {
    res.status(500).json({ message: 'Accept failed', error: error.message });
  }
};

// PUT /api/delivery/:orderId/deliver — mark as delivered with payment
const deliverOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, cashAmount, onlineAmount, multipleOnlineDetails, riderName } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const now = new Date();

    // Update order status
    const updateData = {
      currentStage: 'DELIVERED',
      status: 'COMPLETED',
      deliveredAt: now,
      paymentStatus: 'PAID'
    };
    if (paymentMethod === 'CASH') updateData.paymentMethod = 'CASH';
    else if (paymentMethod === 'ONLINE') updateData.paymentMethod = 'ONLINE';
    else if (paymentMethod === 'CASH_ONLINE') updateData.paymentMethod = 'CASH_ONLINE';
    else if (paymentMethod === 'MULTIPLE_ONLINE') updateData.paymentMethod = 'MULTIPLE_ONLINE';

    await prisma.order.update({ where: { id: orderId }, data: updateData });
    await syncReplacementCaseOnOrderCompletion(order);

    // Mark delivery assignment as delivered so it never carries forward in Gate Pass
    await markAssignmentTerminal(orderId, { delivered: true });

    // Complete OUT_FOR_DELIVERY stage if exists
    const stage = order.stages?.find(s => s.stageName === 'OUT_FOR_DELIVERY' && s.status !== 'COMPLETED');
    if (stage) {
      await prisma.orderStage.update({ where: { id: stage.id }, data: { status: 'COMPLETED', completedAt: now } });
    }

    // Create DELIVERED stage record
    await prisma.orderStage.create({
      data: { orderId, stageName: 'DELIVERED', status: 'COMPLETED', completedAt: now }
    });

    // Record delivery payment
    await prisma.deliveryPayment.create({
      data: {
        orderId,
        paymentMethod,
        cashAmount: parseFloat(cashAmount) || 0,
        onlineAmount: parseFloat(onlineAmount) || 0,
        multipleOnlineDetails: multipleOnlineDetails ? JSON.parse(JSON.stringify(multipleOnlineDetails)) : null,
        collectedBy: riderName
      }
    });

    // Update OrderAcceptance record
    await prisma.orderAcceptance.updateMany({
      where: { orderId, deliveredAt: null },
      data: { deliveredAt: now }
    });

    // Create delivery charge (PKR 200)
    await prisma.deliveryCharge.create({
      data: {
        orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        riderName,
        deliveredAt: now
      }
    });

    // Create delivery attempt
    const attemptCount = await prisma.deliveryAttempt.count({ where: { orderId } });
    await prisma.deliveryAttempt.create({
      data: {
        orderId,
        attemptNumber: attemptCount + 1,
        status: 'DELIVERED',
        riderName,
        attemptedAt: now
      }
    });

    await prisma.routingHistory.create({
      data: { orderId, sentByUserId: req.user?.id || null, previousStage: 'OUT_FOR_DELIVERY', newStage: 'DELIVERED', sentToStage: 'DELIVERED', remarks: `Delivered by ${riderName}` }
    });

    await prisma.auditLog.create({
      data: { orderId, action: 'DELIVERED', details: `Order delivered by ${riderName} via ${paymentMethod || 'CASH'}`, performedBy: req.user?.id || 'SYSTEM' }
    });

    await notify.create(req, { type: 'delivery_done', moduleName: 'Orders', path: '/orders', role: 'FAISAL', title: 'Order Delivered', message: `Order #${order.orderNumber} delivered`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Delivered', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: 'Order delivered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Delivery failed', error: error.message });
  }
};

// PUT /api/delivery/:orderId/no-response — mark no response
const noResponse = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderName } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const now = new Date();
    const currentCount = (order.noResponseCount || 0) + 1;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        noResponseCount: currentCount,
        nextDeliveryDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        lastDeliveryAttempt: now
      }
    });

    await prisma.noResponseLog.create({
      data: { orderId, attemptNumber: currentCount, markedBy: riderName, notes: `Day ${currentCount} – No Response` }
    });

    const attemptCount = await prisma.deliveryAttempt.count({ where: { orderId } });
    await prisma.deliveryAttempt.create({
      data: {
        orderId,
        attemptNumber: attemptCount + 1,
        status: 'NO_RESPONSE',
        riderName,
        attemptedAt: now,
        rescheduledTo: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        notes: `Day ${currentCount} – No Response`
      }
    });

    await prisma.auditLog.create({
      data: { orderId, action: 'DELIVERY_FAILED', details: `Day ${currentCount} – No Response by ${riderName}`, performedBy: req.user?.id || 'SYSTEM' }
    });

    await notify.create(req, { type: 'delivery_no_response', moduleName: 'Deliveries', path: '/delivery', role: 'DELIVERY_BOY', title: 'No Response', message: `Order #${order.orderNumber} no response on delivery`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'No Response', employeeName: req.user?.name }).catch(() => {});

    // After 3 no-response attempts the order auto-returns to Dispatch (it leaves
    // the delivery queue) and feeds the Inventory View → Returns flow.
    if (currentCount >= 3) {
      await performDeliveryReturn(req, order, riderName, `No response after ${currentCount} attempts`, true);
      return res.json({ message: `Order auto-returned to dispatch after ${currentCount} no-response attempts`, noResponseCount: currentCount, autoReturned: true });
    }

    res.json({ message: `Day ${currentCount} – No Response logged`, noResponseCount: currentCount });
  } catch (error) {
    res.status(500).json({ message: 'Failed to log no response', error: error.message });
  }
};

// PUT /api/delivery/:orderId/return — return order
const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, riderName } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await performDeliveryReturn(req, order, riderName, reason || 'Returned by delivery boy', false);

    res.json({ message: 'Order returned to dispatch' });
  } catch (error) {
    res.status(500).json({ message: 'Return failed', error: error.message });
  }
};

// PUT /api/delivery/:orderId/deliver-to-outlet — Delivery Boy delivers to a specific outlet (e.g., Jail Road)
const deliverToOutlet = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { targetOutlet, riderName } = req.body;
    if (!targetOutlet) return res.status(400).json({ message: 'Target outlet name is required' });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const now = new Date();

    // Complete any active ENAMELS_DELIVERY or OUT_FOR_DELIVERY stage
    const activeStage = order.stages?.find(s =>
      ['ENAMELS_DELIVERY', 'OUT_FOR_DELIVERY'].includes(s.stageName) &&
      ['PENDING', 'IN_PROGRESS'].includes(s.status)
    );
    if (activeStage) {
      await prisma.orderStage.update({
        where: { id: activeStage.id },
        data: { status: 'COMPLETED', completedAt: now }
      });
    }

    // Create OUTLET_RECEIVE stage for the target outlet
    await prisma.orderStage.create({
      data: { orderId, stageName: 'OUTLET_RECEIVE', status: 'PENDING' }
    });

    // Update order: set stage to OUTLET_RECEIVE, outlet to target outlet
    await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: 'OUTLET_RECEIVE', outletName: targetOutlet }
    });

    await prisma.routingHistory.create({
      data: { orderId, sentByUserId: req.user?.id || null, previousStage: activeStage?.stageName || 'ENAMELS_DELIVERY', newStage: 'OUTLET_RECEIVE', sentToStage: 'OUTLET_RECEIVE', remarks: `Delivered to ${targetOutlet} by ${riderName || 'Delivery Boy'}` }
    });

    await prisma.auditLog.create({
      data: { orderId, action: 'DELIVERED_TO_OUTLET', details: `Delivery Boy delivered to ${targetOutlet}`, performedBy: req.user?.id || 'SYSTEM' }
    });

    await notify.create(req, {
      type: 'delivered_to_outlet', moduleName: 'My Tasks', path: '/tasks',
      role: 'OUTLET', title: 'Order Delivered to Outlet',
      message: `Order #${order.orderNumber} delivered to ${targetOutlet}`,
      orderId: order.id, orderNumber: order.orderNumber,
      customerName: order.customerName, action: 'Delivered to Outlet',
      employeeName: req.user?.name
    }).catch(() => {});

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

    res.json({ message: `Order delivered to ${targetOutlet} outlet` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to deliver to outlet', error: error.message });
  }
};

// GET /api/delivery/charges — delivery boy's earnings ledger
const getDeliveryCharges = async (req, res) => {
  try {
    const { riderName } = req.query;
    const where = riderName ? { riderName } : {};

    const charges = await prisma.deliveryCharge.findMany({
      where: { ...where, isPaid: false },
      orderBy: { deliveredAt: 'desc' }
    });

    const totalPending = charges.reduce((s, c) => s + c.amount, 0);

    const payments = await prisma.deliveryChargePayment.findMany({
      orderBy: { paidAt: 'desc' }
    });
    const totalPaid = payments.reduce((s, p) => s + p.totalAmount, 0);

    res.json({ charges, totalPending, payments, totalPaid });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch delivery charges', error: error.message });
  }
};

// POST /api/delivery/charges/clear — clear all pending delivery charges
const clearDeliveryCharges = async (req, res) => {
  try {
    const now = new Date();
    const { paidByName, remarks } = req.body;

    const pending = await prisma.deliveryCharge.findMany({ where: { isPaid: false } });
    const totalAmount = pending.reduce((s, c) => s + c.amount, 0);

    if (pending.length === 0) return res.status(400).json({ message: 'No pending charges to clear' });

    // Group charges by riderName for per-employee payment records
    const riderGroups = {};
    for (const c of pending) {
      const rider = c.riderName || 'Unknown';
      if (!riderGroups[rider]) riderGroups[rider] = [];
      riderGroups[rider].push(c);
    }

    const paymentRecords = [];
    for (const [rider, charges] of Object.entries(riderGroups)) {
      const riderTotal = charges.reduce((s, c) => s + c.amount, 0);
      const rec = await prisma.deliveryChargePayment.create({
        data: {
          totalAmount: riderTotal,
          chargeIds: charges.map(c => c.id),
          riderName: rider,
          paidByName: paidByName || 'Super Admin',
          remarks: remarks || `Bulk clear — ${charges.length} orders for ${rider}`,
          paidAt: now
        }
      });
      paymentRecords.push(rec);
    }

    await prisma.deliveryCharge.updateMany({
      where: { isPaid: false },
      data: { isPaid: true, paidAt: now }
    });

    res.json({ message: `${pending.length} charges cleared across ${Object.keys(riderGroups).length} employees, total ₨${totalAmount.toLocaleString()}`, totalAmount, paymentsCreated: paymentRecords.length });
  } catch (error) {
    res.status(500).json({ message: 'Clear failed', error: error.message });
  }
};

// GET /api/delivery/cod — COD collection data
const getCODSummary = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateFilter = parseDateRange(dateFrom, dateTo);

    const deliveredWhere = {
      currentStage: 'DELIVERED',
      paymentStatus: { notIn: ['PAID', 'FULL_PAID'] },
      OR: [
        { paymentMethod: { in: ['CASH', 'CASH_ONLINE'] } },
        { paymentMethod: null }
      ]
    };
    if (dateFilter) deliveredWhere.deliveredAt = dateFilter;

    const filteredDeliveries = await prisma.order.findMany({
      where: deliveredWhere,
      select: { id: true, orderNumber: true, customerName: true, totalPrice: true, deliveredAt: true, advanceAmount: true, paymentMethod: true, paymentStatus: true }
    });

    const filteredCODAmount = filteredDeliveries.reduce((s, o) => {
      if (o.paymentStatus === 'PAID' || o.paymentStatus === 'FULL_PAID') return s;
      const remaining = Math.max(0, (o.totalPrice || 0) - (o.advanceAmount || 0));
      return s + (o.paymentMethod === 'CASH_ONLINE' ? remaining / 2 : remaining);
    }, 0);

    // All pending COD (delivered but not cleared)
    const clearedOrderIds = (await prisma.cODCollection.findMany({ select: { orderIds: true } }))
      .flatMap(c => Array.isArray(c.orderIds) ? c.orderIds : []);
    const pendingWhere = {
      currentStage: 'DELIVERED',
      paymentStatus: { notIn: ['PAID', 'FULL_PAID'] },
      AND: [
        { OR: [{ paymentMethod: 'CASH' }, { paymentMethod: null }, { advanceAmount: { gt: 0 } }] },
        clearedOrderIds.length > 0 ? { id: { notIn: clearedOrderIds } } : {}
      ]
    };
    if (dateFilter) pendingWhere.deliveredAt = dateFilter;

    const pendingCODDeliveries = await prisma.order.findMany({
      where: pendingWhere,
      select: { id: true, orderNumber: true, customerName: true, totalPrice: true, deliveredAt: true, advanceAmount: true, paymentMethod: true, paymentStatus: true }
    });

    const pendingCODAmount = pendingCODDeliveries.reduce((s, o) => {
      if (o.paymentStatus === 'PAID' || o.paymentStatus === 'FULL_PAID') return s;
      const remaining = Math.max(0, (o.totalPrice || 0) - (o.advanceAmount || 0));
      return s + (o.paymentMethod === 'CASH_ONLINE' ? remaining / 2 : remaining);
    }, 0);

    const collections = await prisma.cODCollection.findMany({ orderBy: { clearedAt: 'desc' } });

    res.json({
      filteredCODAmount: filteredCODAmount,
      filteredCODOrders: filteredDeliveries.length,
      pendingCODAmount,
      pendingCODOrders: pendingCODDeliveries.length,
      pendingDeliveries: pendingCODDeliveries,
      collections
    });
  } catch (error) {
    console.error('getCODSummary error:', error);
    res.status(500).json({ message: 'Failed to fetch COD summary' });
  }
};

// POST /api/delivery/cod/clear — clear COD by dispatch officer
const clearCOD = async (req, res) => {
  try {
    const { dispatchOfficer, deliveryBoyName, orderIds, totalAmount } = req.body;
    const now = new Date();

    await prisma.cODCollection.create({
      data: {
        dispatchOfficer,
        deliveryBoyName,
        totalAmount,
        orderIds,
        clearedAt: now
      }
    });

    res.json({ message: `COD cleared: ₨${(totalAmount || 0).toLocaleString()}`, totalAmount });
  } catch (error) {
    res.status(500).json({ message: 'COD clear failed', error: error.message });
  }
};

// GET /api/delivery/performance — delivery boy performance stats
const getPerformance = async (req, res) => {
  try {
    const { riderName, dateFrom, dateTo } = req.query;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const whereRider = riderName ? { riderName } : {};
    const dateFilter = parseDateRange(dateFrom, dateTo);

    const deliveredToday = await prisma.deliveryAttempt.count({
      where: { ...whereRider, status: 'DELIVERED', attemptedAt: { gte: todayStart } }
    });
    const deliveredThisWeek = await prisma.deliveryAttempt.count({
      where: { ...whereRider, status: 'DELIVERED', attemptedAt: { gte: weekStart } }
    });
    const deliveredThisMonth = await prisma.deliveryAttempt.count({
      where: { ...whereRider, status: 'DELIVERED', attemptedAt: { gte: monthStart } }
    });

    const assignedToday = await prisma.orderAcceptance.count({
      where: { assignedAt: { gte: todayStart }, ...(riderName ? { riderName } : {}) }
    });

    const pendingDeliveries = await prisma.order.count({
      where: { currentStage: 'OUT_FOR_DELIVERY', riderAcceptedAt: null }
    });

    const activeDeliveries = await prisma.order.count({
      where: { currentStage: 'OUT_FOR_DELIVERY', riderAcceptedAt: { not: null } }
    });

    const returnedCount = await prisma.deliveryAttempt.count({
      where: { ...whereRider, status: 'RETURNED', attemptedAt: { gte: monthStart } }
    });

    const noResponseCount = await prisma.deliveryAttempt.count({
      where: { ...whereRider, status: 'NO_RESPONSE', attemptedAt: { gte: monthStart } }
    });

    const allTimeDelivered = await prisma.deliveryAttempt.count({
      where: { ...whereRider, status: 'DELIVERED' }
    });

    // Date-filtered delivered count + earnings
    let filteredDelivered = allTimeDelivered;
    let filteredEarnings = allTimeDelivered * 200;
    if (dateFilter) {
      filteredDelivered = await prisma.deliveryAttempt.count({
        where: { ...whereRider, status: 'DELIVERED', attemptedAt: dateFilter }
      });
      filteredEarnings = filteredDelivered * 200;
    }

    res.json({
      assignedToday,
      deliveredToday,
      deliveredThisWeek,
      deliveredThisMonth,
      allTimeDelivered,
      filteredDelivered,
      filteredEarnings,
      pendingDeliveries,
      activeDeliveries,
      returnedCount,
      noResponseCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch performance', error: error.message });
  }
};

// GET /api/delivery/dispatch-tracking — dispatch dashboard tracking data
const getDispatchTracking = async (req, res) => {
  try {
    const { dispatchOfficer } = req.query;

    const deliveryAttempts = await prisma.deliveryAttempt.findMany({
      where: { status: 'NO_RESPONSE' },
      include: { order: { select: { orderNumber: true, customerName: true, city: true, noResponseCount: true, deliveryMethod: true } } },
      orderBy: { attemptedAt: 'desc' },
      take: 100
    });

    const deliveredOrders = await prisma.deliveryPayment.findMany({
      include: { order: { select: { orderNumber: true, customerName: true, totalPrice: true, paymentMethod: true, city: true } } },
      orderBy: { collectedAt: 'desc' },
      take: 100
    });

    const noResponseOrders = await prisma.order.findMany({
      where: { noResponseCount: { gt: 0 } },
      select: { id: true, orderNumber: true, customerName: true, city: true, noResponseCount: true, lastDeliveryAttempt: true },
      orderBy: { lastDeliveryAttempt: 'desc' }
    });

    res.json({ deliveryAttempts, deliveredOrders, noResponseOrders });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tracking data', error: error.message });
  }
};

// GET /api/delivery/employee-stats — per-employee payment breakdown
const getDeliveryEmployeeStats = async (req, res) => {
  try {
    const DELIVERY_RATE = 200;
    const { dateFrom, dateTo } = req.query;
    const dateFilter = parseDateRange(dateFrom, dateTo);

    // Get all delivery orders (source of truth for riders + delivered count)
    const allOrders = await prisma.order.findMany({
      where: {
        OR: [
          { currentStage: { in: ['OUT_FOR_DELIVERY', 'DELIVERED', 'ENAMELS_DELIVERY'] } },
          { status: { in: ['COMPLETED', 'OUT_FOR_DELIVERY', 'RETURNED', 'CANCELLED'] } }
        ]
      },
      select: {
        id: true, currentStage: true, status: true, deliveryType: true, deliveryMethod: true,
        riderAcceptedAt: true, deliveredAt: true, returnedAt: true, noResponseCount: true,
        orderAcceptances: { select: { riderName: true, assignedAt: true } },
        deliveryAttempts: { select: { riderName: true, status: true } },
        deliveryPayments: { select: { collectedBy: true } }
      }
    });

    // Get DeliveryCharge records (for payment tracking)
    const allCharges = await prisma.deliveryCharge.findMany({
      select: { riderName: true, orderId: true, amount: true, isPaid: true, deliveredAt: true }
    });

    // Get all payment records
    const allPayments = await prisma.deliveryChargePayment.findMany({
      orderBy: { paidAt: 'desc' }
    });

    // Derive rider names from related records (Order model has NO riderName field)
    const orderRiders = [...new Set(
      allOrders.flatMap(o => [
        ...(o.orderAcceptances || []).map(a => a.riderName),
        ...(o.deliveryAttempts || []).map(a => a.riderName),
        ...(o.deliveryPayments || []).map(p => p.collectedBy)
      ].filter(Boolean))
    )];
    const chargeRiders = [...new Set(allCharges.map(c => c.riderName).filter(Boolean))];
    const riderNames = [...new Set([...orderRiders, ...chargeRiders])];
    if (riderNames.length === 0) return res.json({ employees: [], paymentAnalytics: {} });

    const orderHasRider = (o, name) =>
      (o.orderAcceptances || []).some(a => a.riderName === name) ||
      (o.deliveryAttempts || []).some(a => a.riderName === name) ||
      (o.deliveryPayments || []).some(p => p.collectedBy === name);

    const employees = riderNames.map(name => {
      const myOrders = allOrders.filter(o => orderHasRider(o, name));
      const myCharges = allCharges.filter(c => c.riderName === name);

      // Date-filtered delivered orders for earnings
      let deliveredOrders = myOrders.filter(o => o.currentStage === 'DELIVERED' || o.status === 'COMPLETED');
      if (dateFilter) {
        deliveredOrders = deliveredOrders.filter(o => o.deliveredAt && dateFilter.gte && o.deliveredAt >= dateFilter.gte && (!dateFilter.lte || o.deliveredAt <= dateFilter.lte));
      }
      const deliveredFromCharges = myCharges.length;
      const delivered = Math.max(deliveredFromCharges, deliveredOrders.length);

      const totalEarnings = delivered * DELIVERY_RATE;

      // Payment tracking from DeliveryCharge records
      const pendingCharges = myCharges.filter(c => !c.isPaid);
      const paidCharges = myCharges.filter(c => c.isPaid);
      const totalPaid = paidCharges.reduce((s, c) => s + c.amount, 0);
      const remainingPayable = totalEarnings - totalPaid;

      // Order status counts (all-time, not date-filtered)
      const activeCount = myOrders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && o.riderAcceptedAt).length;
      const pendingCount = myOrders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && !o.riderAcceptedAt).length;
      const returnedCount = myOrders.filter(o => o.status === 'RETURNED').length;

      // Payment history for this employee (date-filtered if applicable)
      let myPayments = allPayments.filter(p => p.riderName === name);
      if (dateFilter) {
        myPayments = myPayments.filter(p => p.paidAt && dateFilter.gte && p.paidAt >= dateFilter.gte && (!dateFilter.lte || p.paidAt <= dateFilter.lte));
      }

      return {
        name,
        totalAssigned: myOrders.length,
        totalDelivered: delivered,
        pendingDeliveries: pendingCount,
        activeDeliveries: activeCount,
        returnedOrders: returnedCount,
        totalEarnings,
        totalPaid,
        remainingPayable: Math.max(0, remainingPayable),
        ratePerDelivery: DELIVERY_RATE,
        paymentHistory: myPayments.map(p => ({
          id: p.id,
          totalAmount: p.totalAmount,
          paidByName: p.paidByName,
          remarks: p.remarks,
          paidAt: p.paidAt,
          chargeCount: Array.isArray(p.chargeIds) ? p.chargeIds.length : 0
        }))
      };
    }).filter(e => e.totalAssigned > 0);

    // Payment analytics summary
    const totalEarningsAll = employees.reduce((s, e) => s + e.totalEarnings, 0);
    const totalPaidAll = employees.reduce((s, e) => s + e.totalPaid, 0);
    const totalOutstanding = employees.reduce((s, e) => s + e.remainingPayable, 0);
    const paymentAnalytics = {
      totalEarnings: totalEarningsAll,
      totalPaid: totalPaidAll,
      totalOutstanding,
      totalPayments: allPayments.length,
      lastPaymentDate: allPayments.length > 0 ? allPayments[0].paidAt : null
    };

    res.json({ employees, paymentAnalytics });
  } catch (error) {
    console.error('getDeliveryEmployeeStats error:', error);
    res.status(500).json({ message: 'Failed to fetch employee stats' });
  }
};

// POST /api/delivery/pay-employee — pay a specific delivery employee
const payDeliveryEmployee = async (req, res) => {
  try {
    const { riderName, amount, paidByName, remarks } = req.body;
    if (!riderName) return res.status(400).json({ message: 'riderName is required' });

    const pendingCharges = await prisma.deliveryCharge.findMany({
      where: { riderName, isPaid: false },
      orderBy: { deliveredAt: 'asc' }
    });

    if (pendingCharges.length === 0) return res.status(400).json({ message: 'No pending charges for this employee' });

    const totalPending = pendingCharges.reduce((s, c) => s + c.amount, 0);
    const payAmount = Math.min(amount || totalPending, totalPending);
    const now = new Date();

    // Sort by deliveredAt, mark oldest charges as paid until amount is exhausted
    let remaining = payAmount;
    const toMarkPaid = [];
    for (const charge of pendingCharges) {
      if (remaining <= 0) break;
      toMarkPaid.push(charge.id);
      remaining -= charge.amount;
    }

    // Create payment record
    await prisma.deliveryChargePayment.create({
      data: {
        totalAmount: payAmount,
        chargeIds: toMarkPaid,
        riderName,
        paidByName: paidByName || 'Admin',
        remarks: remarks || null,
        paidAt: now
      }
    });

    // Mark charges as paid
    await prisma.deliveryCharge.updateMany({
      where: { id: { in: toMarkPaid } },
      data: { isPaid: true, paidAt: now }
    });

    res.json({
      message: `Paid ₨${payAmount.toLocaleString()} to ${riderName}`,
      paidAmount: payAmount,
      chargesCleared: toMarkPaid.length,
      remainingPending: totalPending - payAmount
    });
  } catch (error) {
    console.error('payDeliveryEmployee error:', error);
    res.status(500).json({ message: 'Payment failed' });
  }
};

// GET /api/delivery/payment-history — complete payment history
const getDeliveryPaymentHistory = async (req, res) => {
  try {
    const { riderName, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    const where = riderName ? { riderName } : {};
    const dateFilter = parseDateRange(dateFrom, dateTo);
    if (dateFilter) where.paidAt = dateFilter;

    const [payments, total] = await Promise.all([
      prisma.deliveryChargePayment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.deliveryChargePayment.count({ where })
    ]);

    res.json({
      payments,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('getDeliveryPaymentHistory error:', error);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
};

// GET /api/delivery/activity — timeline with rider names, date-filtered
const getActivityTimeline = async (req, res) => {
  try {
    const { dateFrom, dateTo, limit = 100 } = req.query;
    const dateFilter = parseDateRange(dateFrom, dateTo);

    const auditWhere = {
      action: { in: ['DELIVERED', 'DELIVERY_ACCEPTED', 'DELIVERY_FAILED', 'DISPATCH_RETURNED'] }
    };
    if (dateFilter) auditWhere.timestamp = dateFilter;

    const [audits, orders] = await Promise.all([
      prisma.auditLog.findMany({
        where: auditWhere,
        include: { order: { select: {
          id: true, orderNumber: true, customerName: true, city: true, currentStage: true, totalPrice: true, paymentMethod: true,
          orderAcceptances: { select: { riderName: true } },
          deliveryAttempts: { select: { riderName: true } },
          deliveryPayments: { select: { collectedBy: true } }
        } } },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit)
      }),
      prisma.order.findMany({
        where: {
          currentStage: { in: ['OUT_FOR_DELIVERY', 'DELIVERED', 'ENAMELS_DELIVERY'] },
          ...(dateFilter ? { createdAt: dateFilter } : {})
        },
        select: { id: true, orderNumber: true, customerName: true, city: true, currentStage: true, totalPrice: true, deliveryType: true, riderAcceptedAt: true, deliveredAt: true, noResponseCount: true, orderAcceptances: { select: { riderName: true } }, deliveryAttempts: { select: { riderName: true } }, deliveryPayments: { select: { collectedBy: true } } },
        orderBy: { updatedAt: 'desc' },
        take: parseInt(limit)
      })
    ]);

    // Derive rider names from related records (Order model has NO riderName field)
    const deriveRider = (o) => {
      if (!o) return null;
      return (o.deliveryAttempts?.[0]?.riderName) || (o.deliveryPayments?.[0]?.collectedBy) ||
        (o.orderAcceptances?.[0]?.riderName) || null;
    };
    audits.forEach(a => { if (a.order) a.order.riderName = deriveRider(a.order); });
    orders.forEach(o => { o.riderName = deriveRider(o); });

    res.json({ audits, orders });
  } catch (error) {
    console.error('getActivityTimeline error:', error);
    res.status(500).json({ message: 'Failed to fetch activity timeline' });
  }
};

// GET /api/delivery/analytics — comprehensive Enamels delivery analytics
// Returns order statistics, payment breakdown, per-order timelines, and per-rider earnings,
// all computed from actual delivery records with working date/rider/status/payment/outlet filters.
const getDeliveryAnalytics = async (req, res) => {
  try {
    const { dateFrom, dateTo, riderName, status, deliveryStatus, paymentType, outlet } = req.query;
    const dateFilter = parseDateRange(dateFrom, dateTo);

    // An order belongs to the Enamels delivery module if it was dispatched via Enamels,
    // routed to the ENAMELS_DELIVERY stage, or has any delivery-boy activity records.
    const identityOR = [
      { deliveryType: 'ENAMELS' },
      { deliveryMethod: 'Enamels Delivery' },
      { currentStage: 'ENAMELS_DELIVERY' },
      { deliveryAttempts: { some: {} } },
      { deliveryPayments: { some: {} } },
      { deliveryChargeRecords: { some: {} } },
      { orderAcceptances: { some: {} } },
      { noResponseLogs: { some: {} } }
    ];

    const where = { AND: [{ OR: identityOR }] };
    if (dateFilter) {
      where.AND.push({
        OR: [
          { createdAt: dateFilter },
          { deliveredAt: dateFilter },
          { riderAcceptedAt: dateFilter },
          { returnedAt: dateFilter },
          { lastDeliveryAttempt: dateFilter }
        ]
      });
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        orderAcceptances: { orderBy: { assignedAt: 'desc' } },
        deliveryAttempts: { orderBy: { attemptNumber: 'asc' } },
        noResponseLogs: { orderBy: { attemptNumber: 'asc' } },
        deliveryPayments: true,
        deliveryChargeRecords: true,
        returnExchangeCases: { orderBy: { createdAt: 'desc' } },
        createdBy: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const deriveRider = (o) => {
      const att = o.deliveryAttempts || [];
      const pay = o.deliveryPayments || [];
      const ch = o.deliveryChargeRecords || [];
      const acc = o.orderAcceptances || [];
      return att[att.length - 1]?.riderName || pay[0]?.collectedBy || ch[0]?.riderName || acc[0]?.riderName || null;
    };

    const classify = (o) => {
      const acc = o.orderAcceptances || [];
      const attempts = o.deliveryAttempts || [];
      const lastAttempt = attempts[attempts.length - 1];
      const assignedAt = acc[0]?.assignedAt || o.createdAt;
      const acceptedAt = o.riderAcceptedAt || acc[0]?.acceptedAt || null;
      const deliveredAt = o.deliveredAt || attempts.find(a => a.status === 'DELIVERED')?.attemptedAt || null;
      const returnedAt = o.returnedAt || attempts.find(a => a.status === 'RETURNED')?.attemptedAt || null;

      const cancelled = o.status === 'CANCELLED' || lastAttempt?.status === 'CANCELLED';
      const returned = o.status === 'RETURNED' || !!returnedAt;
      const delivered = o.currentStage === 'DELIVERED' || o.status === 'COMPLETED' || !!deliveredAt;
      const failed = !delivered && !returned && !cancelled && (o.noResponseCount || 0) >= 3;
      const noResponse = !delivered && !returned && !cancelled && !failed && (o.noResponseCount || 0) > 0;
      const accepted = !!acceptedAt;

      let primaryStatus;
      if (delivered) primaryStatus = 'delivered';
      else if (returned) primaryStatus = 'returned';
      else if (cancelled) primaryStatus = 'cancelled';
      else if (failed) primaryStatus = 'failed';
      else if (noResponse) primaryStatus = 'noResponse';
      else if (accepted) primaryStatus = 'inTransit';
      else primaryStatus = 'pending';

      let durationMinutes = null;
      if (deliveredAt && assignedAt) durationMinutes = Math.round((new Date(deliveredAt) - new Date(assignedAt)) / 60000);

      let cashCollected = 0, onlineCollected = 0;
      (o.deliveryPayments || []).forEach(p => {
        if (p.paymentMethod === 'CASH') cashCollected += (p.cashAmount || 0);
        else if (p.paymentMethod === 'ONLINE') onlineCollected += (p.onlineAmount || 0);
        else if (p.paymentMethod === 'CASH_ONLINE') { cashCollected += (p.cashAmount || 0); onlineCollected += (p.onlineAmount || 0); }
        else if (p.paymentMethod === 'MULTIPLE_ONLINE') onlineCollected += (p.onlineAmount || 0);
      });
      const totalCollected = cashCollected + onlineCollected;
      const advance = o.advanceAmount || 0;
      const outstanding = Math.max(0, (o.totalPrice || 0) - advance - totalCollected);
      const isPaid = outstanding <= 0.01;

      const charge = (o.deliveryChargeRecords || [])[0] || null;
      const orderDate = deliveredAt || returnedAt || acceptedAt || assignedAt || o.createdAt;
      const firstAttempt = attempts.find(a => a && a.status);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        invoiceNumber: o.invoiceNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        city: o.city,
        address: o.address,
        outletName: o.outletName,
        totalPrice: o.totalPrice || 0,
        advanceAmount: advance,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        orderStage: o.currentStage,
        orderStatus: o.status,
        riderName: deriveRider(o),
        primaryStatus,
        accepted,
        orderDate,
        timeline: {
          assignedAt,
          acceptedAt,
          pickedUpAt: firstAttempt?.attemptedAt || acceptedAt,
          deliveredAt,
          returnedAt,
          noResponseAt: lastAttempt?.status === 'NO_RESPONSE' ? lastAttempt.attemptedAt : (o.noResponseLogs?.[o.noResponseLogs.length - 1]?.createdAt || null),
          durationMinutes
        },
        payments: (o.deliveryPayments || []).map(p => ({
          id: p.id, paymentMethod: p.paymentMethod, cashAmount: p.cashAmount, onlineAmount: p.onlineAmount, collectedBy: p.collectedBy, collectedAt: p.collectedAt
        })),
        deliveryCharge: charge ? { id: charge.id, amount: charge.amount, isPaid: charge.isPaid, paidAt: charge.paidAt, deliveredAt: charge.deliveredAt, riderName: charge.riderName } : null,
        attempts: attempts.map(a => ({ id: a.id, attemptNumber: a.attemptNumber, status: a.status, riderName: a.riderName, attemptedAt: a.attemptedAt, notes: a.notes, rescheduledTo: a.rescheduledTo })),
        noResponseCount: o.noResponseCount || 0,
        cashCollected,
        onlineCollected,
        totalCollected,
        outstanding,
        isPaid
      };
    };

    let enriched = orders.map(classify);

    // Apply filters (riders list computed before riderName filter so the dropdown stays populated)
    if (status) enriched = enriched.filter(e => e.orderStatus === status || e.orderStage === status);
    if (deliveryStatus) enriched = enriched.filter(e => e.primaryStatus === deliveryStatus);
    if (paymentType) enriched = enriched.filter(e =>
      e.paymentMethod === paymentType || e.payments.some(p => p.paymentMethod === paymentType)
    );
    if (outlet) enriched = enriched.filter(e => e.outletName && e.outletName.toLowerCase().includes(outlet.toLowerCase()));

    const riders = [...new Set(enriched.map(e => e.riderName).filter(Boolean))].sort();

    if (riderName) enriched = enriched.filter(e => e.riderName && e.riderName.toLowerCase().includes(riderName.toLowerCase()));

    // Order statistics (10 buckets)
    const stats = {
      totalAssigned: enriched.length,
      accepted: enriched.filter(e => e.accepted).length,
      pickedUp: enriched.filter(e => e.accepted).length,
      delivered: enriched.filter(e => e.primaryStatus === 'delivered').length,
      pending: enriched.filter(e => e.primaryStatus === 'pending').length,
      inTransit: enriched.filter(e => e.primaryStatus === 'inTransit').length,
      returned: enriched.filter(e => e.primaryStatus === 'returned').length,
      noResponse: enriched.filter(e => e.primaryStatus === 'noResponse').length,
      cancelled: enriched.filter(e => e.primaryStatus === 'cancelled').length,
      failed: enriched.filter(e => e.primaryStatus === 'failed').length,
      totalOrderValue: enriched.reduce((s, e) => s + e.totalPrice, 0),
      codOrderCount: enriched.filter(e => !e.isPaid).length,
      paidOrderCount: enriched.filter(e => e.isPaid).length,
      totalCOD: enriched.filter(e => !e.isPaid).reduce((s, e) => s + e.outstanding, 0),
      totalPaidAmount: enriched.filter(e => e.isPaid).reduce((s, e) => s + (e.totalCollected || e.totalPrice), 0),
      outstandingCollection: enriched.reduce((s, e) => s + e.outstanding, 0),
      cashCollected: enriched.reduce((s, e) => s + e.cashCollected, 0),
      onlinePrepaid: enriched.reduce((s, e) => s + e.onlineCollected, 0)
    };

    // Earnings from actual DeliveryCharge records (per order → per rider)
    const riderMap = new Map();
    let totalEarnings = 0, totalEarningsPaid = 0;
    for (const e of enriched) {
      const ch = e.deliveryCharge;
      if (!ch) continue;
      const rider = ch.riderName || e.riderName || 'Unknown';
      if (!riderMap.has(rider)) riderMap.set(rider, { riderName: rider, totalEarnings: 0, totalPaid: 0, remainingPayable: 0, completedDeliveries: 0, perOrder: [] });
      const r = riderMap.get(rider);
      const amount = ch.amount || 200;
      r.totalEarnings += amount;
      if (ch.isPaid) r.totalPaid += amount;
      if (e.primaryStatus === 'delivered') r.completedDeliveries += 1;
      totalEarnings += amount;
      if (ch.isPaid) totalEarningsPaid += amount;
      r.perOrder.push({
        orderId: e.id, orderNumber: e.orderNumber, customerName: e.customerName,
        amount, isPaid: ch.isPaid, paidAt: ch.paidAt, deliveredAt: e.timeline.deliveredAt
      });
    }
    const perRider = [...riderMap.values()].map(r => ({ ...r, remainingPayable: Math.max(0, r.totalEarnings - r.totalPaid) }))
      .sort((a, b) => b.totalEarnings - a.totalEarnings);

    res.json({
      orders: enriched,
      stats,
      earnings: {
        totalEarnings,
        totalPaid: totalEarningsPaid,
        outstandingEarnings: Math.max(0, totalEarnings - totalEarningsPaid),
        completedDeliveries: stats.delivered,
        perRider
      },
      riders
    });
  } catch (error) {
    console.error('getDeliveryAnalytics error:', error);
    res.status(500).json({ message: 'Failed to fetch delivery analytics', error: error.message });
  }
};

// ─── Delivery Deposit (Cash to Admin) ────────────────────────────────────────

// POST /api/delivery/deposits — delivery boy submits a cash-to-admin deposit
const submitDeposit = async (req, res) => {
  try {
    const deliveryBoy = req.user?.name;
    if (!deliveryBoy) return res.status(401).json({ message: 'User not found' });

    const { cashAmount, onlineAmount, reference, notes } = req.body;
    const cash = parseFloat(cashAmount) || 0;
    const online = parseFloat(onlineAmount) || 0;
    const total = cash + online;

    if (total <= 0) return res.status(400).json({ message: 'Total amount must be greater than 0' });

    const deposit = await prisma.deliveryDeposit.create({
      data: {
        deliveryBoy,
        cashAmount: cash,
        onlineAmount: online,
        totalAmount: total,
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        status: 'PENDING',
        createdBy: deliveryBoy,
      }
    });

    await notify.create(req, {
      type: 'delivery_deposit', moduleName: 'Deliveries', path: '/delivery', role: 'ADMIN',
      title: 'New Delivery Deposit',
      message: `${deliveryBoy} submitted ₨${total.toLocaleString()} deposit (Cash: ₨${cash.toLocaleString()}, Online: ₨${online.toLocaleString()})`,
      action: 'Delivery Deposit', employeeName: deliveryBoy,
    }).catch(() => {});

    res.status(201).json({ message: 'Deposit submitted for review', deposit });
  } catch (error) {
    console.error('submitDeposit error:', error);
    res.status(500).json({ message: 'Failed to submit deposit', error: error.message });
  }
};

// GET /api/delivery/deposits/my — delivery boy gets own deposit history
const getMyDeposits = async (req, res) => {
  try {
    const deliveryBoy = req.user?.name;
    const { dateFrom, dateTo } = req.query;

    const where = { deliveryBoy };
    const dateFilter = parseDateRange(dateFrom, dateTo);
    if (dateFilter) where.createdAt = dateFilter;

    const deposits = await prisma.deliveryDeposit.findMany({ where, orderBy: { createdAt: 'desc' } });
    const totalAmount = deposits.reduce((s, d) => s + d.totalAmount, 0);

    res.json({ deposits, totalAmount, count: deposits.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deposits', error: error.message });
  }
};

// GET /api/delivery/deposits/all — admin gets all deposits
const getAllDeposits = async (req, res) => {
  try {
    const { dateFrom, dateTo, status: statusFilter, deliveryBoy: filterBoy } = req.query;

    const where = {};
    if (statusFilter) where.status = statusFilter.toUpperCase();
    if (filterBoy) where.deliveryBoy = { contains: filterBoy, mode: 'insensitive' };
    const dateFilter = parseDateRange(dateFrom, dateTo);
    if (dateFilter) where.createdAt = dateFilter;

    const deposits = await prisma.deliveryDeposit.findMany({ where, orderBy: { createdAt: 'desc' } });
    const totalAmount = deposits.reduce((s, d) => s + d.totalAmount, 0);

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayDeposits = deposits.filter(d => new Date(d.createdAt) >= todayStart);
    const monthDeposits = deposits.filter(d => new Date(d.createdAt) >= monthStart);
    const pendingDeposits = deposits.filter(d => d.status === 'PENDING');

    res.json({
      deposits, totalAmount, count: deposits.length,
      todayAmount: todayDeposits.reduce((s, d) => s + d.totalAmount, 0),
      todayCount: todayDeposits.length,
      monthAmount: monthDeposits.reduce((s, d) => s + d.totalAmount, 0),
      monthCount: monthDeposits.length,
      pendingAmount: pendingDeposits.reduce((s, d) => s + d.totalAmount, 0),
      pendingCount: pendingDeposits.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deposits', error: error.message });
  }
};

// PUT /api/delivery/deposits/:id/approve — admin approves a deposit
const approveDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const deposit = await prisma.deliveryDeposit.findUnique({ where: { id } });
    if (!deposit) return res.status(404).json({ message: 'Deposit not found' });
    if (deposit.status !== 'PENDING') return res.status(400).json({ message: `Deposit is already ${deposit.status}` });

    const updated = await prisma.deliveryDeposit.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: req.user?.name,
        reviewedById: req.user?.id,
        reviewedAt: new Date(),
      }
    });

    await notify.create(req, {
      type: 'delivery_deposit', moduleName: 'Deliveries', path: '/delivery', role: 'DELIVERY_BOY',
      title: 'Deposit Approved',
      message: `Your ₨${deposit.totalAmount.toLocaleString()} deposit has been approved by ${req.user?.name}`,
      action: 'Deposit Approved', employeeName: deposit.deliveryBoy,
    }).catch(() => {});

    res.json({ message: 'Deposit approved', deposit: updated });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve deposit', error: error.message });
  }
};

// PUT /api/delivery/deposits/:id/reject — admin rejects a deposit
const rejectDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const deposit = await prisma.deliveryDeposit.findUnique({ where: { id } });
    if (!deposit) return res.status(404).json({ message: 'Deposit not found' });
    if (deposit.status !== 'PENDING') return res.status(400).json({ message: `Deposit is already ${deposit.status}` });

    const updated = await prisma.deliveryDeposit.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: req.user?.name,
        reviewedById: req.user?.id,
        reviewedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      }
    });

    await notify.create(req, {
      type: 'delivery_deposit', moduleName: 'Deliveries', path: '/delivery', role: 'DELIVERY_BOY',
      title: 'Deposit Rejected',
      message: `Your ₨${deposit.totalAmount.toLocaleString()} deposit was rejected${reason ? ': ' + reason : ''}`,
      action: 'Deposit Rejected', employeeName: deposit.deliveryBoy,
    }).catch(() => {});

    res.json({ message: 'Deposit rejected', deposit: updated });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject deposit', error: error.message });
  }
};

module.exports = {
  getDeliveryOrders,
  acceptDelivery,
  deliverOrder,
  noResponse,
  returnOrder,
  deliverToOutlet,
  getDeliveryCharges,
  clearDeliveryCharges,
  getCODSummary,
  clearCOD,
  getPerformance,
  getDispatchTracking,
  getDeliveryEmployeeStats,
  payDeliveryEmployee,
  getDeliveryPaymentHistory,
  getActivityTimeline,
  getDeliveryAnalytics,
  submitDeposit,
  getMyDeposits,
  getAllDeposits,
  approveDeposit,
  rejectDeposit
};
