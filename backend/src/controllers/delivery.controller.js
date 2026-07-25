const prisma = require('../prisma');

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
    const where = {
      OR: [
        { currentStage: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] } },
        { status: { in: ['COMPLETED', 'OUT_FOR_DELIVERY'] } }
      ]
    };
    if (deliveryType) {
      const methodMap = { 'ENAMELS': 'Enamels Delivery', 'TCS': 'TCS', 'POST_EX': 'PostEx' };
      const methodStr = methodMap[deliveryType] || deliveryType;
      where.AND = [
        { OR: [{ deliveryType }, { deliveryMethod: methodStr }] }
      ];
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
        deliveryPayments: true
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch delivery orders', error: error.message });
  }
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

    const now = new Date();
    await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: 'DISPATCH', status: 'RETURNED', returnedAt: now }
    });

    const attemptCount = await prisma.deliveryAttempt.count({ where: { orderId } });
    await prisma.deliveryAttempt.create({
      data: {
        orderId,
        attemptNumber: attemptCount + 1,
        status: 'RETURNED',
        riderName,
        attemptedAt: now,
        notes: reason || 'Returned by delivery boy'
      }
    });

    await prisma.routingHistory.create({
      data: { orderId, sentByUserId: req.user?.id || null, previousStage: 'OUT_FOR_DELIVERY', newStage: 'DISPATCH', sentToStage: 'DISPATCH', remarks: `Returned by ${riderName}: ${reason || 'No reason'}` }
    });

    await prisma.auditLog.create({
      data: { orderId, action: 'DISPATCH_RETURNED', details: `Returned by ${riderName}: ${reason || 'No reason'}`, performedBy: req.user?.id || 'SYSTEM' }
    });

    res.json({ message: 'Order returned to dispatch' });
  } catch (error) {
    res.status(500).json({ message: 'Return failed', error: error.message });
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

    const pending = await prisma.deliveryCharge.findMany({ where: { isPaid: false } });
    const totalAmount = pending.reduce((s, c) => s + c.amount, 0);

    if (pending.length === 0) return res.status(400).json({ message: 'No pending charges to clear' });

    await prisma.deliveryChargePayment.create({
      data: {
        totalAmount,
        chargeIds: pending.map(c => c.id),
        paidAt: now
      }
    });

    await prisma.deliveryCharge.updateMany({
      where: { isPaid: false },
      data: { isPaid: true, paidAt: now }
    });

    res.json({ message: `${pending.length} charges cleared, total ₨${totalAmount.toLocaleString()}`, totalAmount });
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
          { currentStage: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] } },
          { status: { in: ['COMPLETED', 'OUT_FOR_DELIVERY', 'RETURNED'] } }
        ]
      },
      select: { id: true, currentStage: true, status: true, riderName: true, deliveryType: true, deliveryMethod: true, riderAcceptedAt: true, deliveredAt: true }
    });

    // Get DeliveryCharge records (for payment tracking)
    const allCharges = await prisma.deliveryCharge.findMany({
      select: { riderName: true, orderId: true, amount: true, isPaid: true, deliveredAt: true }
    });

    // Get all payment records
    const allPayments = await prisma.deliveryChargePayment.findMany({
      orderBy: { paidAt: 'desc' }
    });

    // Derive rider names from BOTH orders and charges
    const orderRiders = [...new Set(allOrders.map(o => o.riderName).filter(Boolean))];
    const chargeRiders = [...new Set(allCharges.map(c => c.riderName).filter(Boolean))];
    const riderNames = [...new Set([...orderRiders, ...chargeRiders])];
    if (riderNames.length === 0) return res.json({ employees: [], paymentAnalytics: {} });

    const employees = riderNames.map(name => {
      const myOrders = allOrders.filter(o => o.riderName === name);
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
    if (dateFilter) auditWhere.createdAt = dateFilter;

    const [audits, orders] = await Promise.all([
      prisma.auditLog.findMany({
        where: auditWhere,
        include: { order: { select: { id: true, orderNumber: true, customerName: true, city: true, currentStage: true, riderName: true, totalPrice: true, paymentMethod: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      }),
      prisma.order.findMany({
        where: {
          currentStage: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] },
          ...(dateFilter ? { createdAt: dateFilter } : {})
        },
        select: { id: true, orderNumber: true, customerName: true, city: true, currentStage: true, riderName: true, totalPrice: true, deliveryType: true, riderAcceptedAt: true, deliveredAt: true, noResponseCount: true },
        orderBy: { updatedAt: 'desc' },
        take: parseInt(limit)
      })
    ]);

    res.json({ audits, orders });
  } catch (error) {
    console.error('getActivityTimeline error:', error);
    res.status(500).json({ message: 'Failed to fetch activity timeline' });
  }
};

module.exports = {
  getDeliveryOrders,
  acceptDelivery,
  deliverOrder,
  noResponse,
  returnOrder,
  getDeliveryCharges,
  clearDeliveryCharges,
  getCODSummary,
  clearCOD,
  getPerformance,
  getDispatchTracking,
  getDeliveryEmployeeStats,
  payDeliveryEmployee,
  getDeliveryPaymentHistory,
  getActivityTimeline
};
