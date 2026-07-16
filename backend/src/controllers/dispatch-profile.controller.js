const prisma = require('../prisma');
const { calculateDeadline } = require('../utils/deadline');

const createAuditLog = async (orderId, action, details, userId) => {
  try {
    if (!userId) return;
    await prisma.auditLog.create({
      data: { orderId, action, details, performedBy: userId, timestamp: new Date() }
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

const createDispatchLog = async (data) => {
  try {
    await prisma.dispatchLog.create({ data });
  } catch (error) {
    console.error('Dispatch Log Error:', error);
  }
};

const getStageDurations = async (priority = 'NORMAL') => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
  let config = {
    stageDurations: { STORE: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48, LOGO_DESIGN: 24, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
    slaMultipliers: { NORMAL: 1, URGENT: 0.75, SUPER_URGENT: 0.5 }
  };
  if (setting) {
    try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) {}
  }
  const slaMultiplier = config.slaMultipliers?.[priority] ?? 1;
  const durations = config.stageDurations || {};
  const adjusted = {};
  for (const [stage, hours] of Object.entries(durations)) {
    adjusted[stage] = Math.round((hours * slaMultiplier) * 100) / 100;
  }
  return adjusted;
};

// GET /api/dispatch-profile/orders?employeeName=Khawar&cityFilter=all
const getDispatchProfileOrders = async (req, res) => {
  try {
    const { employeeName, cityFilter } = req.query;
    if (!employeeName || !['Khawar', 'Faisal'].includes(employeeName)) {
      return res.status(400).json({ message: 'employeeName must be Khawar or Faisal' });
    }

    const baseSelect = {
      id: true, orderNumber: true, customerName: true, customerPhone: true,
      address: true, city: true, source: true, outletName: true,
      currentStage: true, status: true, dispatchStatus: true,
      deliveryType: true, deliveryMethod: true, priority: true,
      trackingNumber: true, courierDetails: true,
      totalPrice: true, paymentStatus: true, advanceAmount: true,
      type: true, productDetails: true, customization: true, sizeData: true,
      instructionNotes: true, dispatchOfficer: true, forwardedBy: true,
      createdAt: true, updatedAt: true,
      stages: {
        orderBy: { createdAt: 'asc' },
        select: { stageName: true, status: true, deadlineAt: true, startedAt: true, rejectionReason: true, completedAt: true }
      },
      createdBy: { select: { name: true, role: true } }
    };

    const baseOrder = [{ priority: 'asc' }, { createdAt: 'desc' }];

    const isLahore = (c) => c && c.trim().toLowerCase() === 'lahore';

    // ─── KHAWAR: 3-way split ───
    if (employeeName === 'Khawar') {
      const showAllCities = cityFilter === 'all';

      const dispatchOrders = await prisma.order.findMany({
        where: {
          currentStage: { in: ['DISPATCH', 'OUT_FOR_DELIVERY'] },
          status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
        },
        select: baseSelect,
        orderBy: baseOrder
      });

      const unseen = [];
      const seen = [];
      const active = [];
      for (const order of dispatchOrders) {
        if (!showAllCities && !isLahore(order.city)) continue;
        if (order.forwardedBy === 'Khawar') continue; // skip orders forwarded to Faisal

        if (order.currentStage === 'OUT_FOR_DELIVERY') {
          if (order.dispatchOfficer === 'Khawar') active.push(order);
          continue;
        }

        const dispatchStage = order.stages.find(s => s.stageName === 'DISPATCH');
        const isAccepted = dispatchStage?.startedAt != null;
        const isAssignedToKhawar = order.dispatchOfficer === 'Khawar';

        if (!isAccepted || !isAssignedToKhawar) {
          unseen.push(order);
        } else {
          seen.push(order);
        }
      }

      return res.json({
        unseen, seen, active,
        counts: { unseen: unseen.length, seen: seen.length, active: active.length }
      });
    }

    // ─── FAISAL: 3-way split ───
    const showAllCities = cityFilter === 'all';

    const dispatchOrders = await prisma.order.findMany({
      where: {
        currentStage: { in: ['DISPATCH', 'OUT_FOR_DELIVERY'] },
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
      },
      select: baseSelect,
      orderBy: baseOrder
    });

    const unseen = [];
    const seen = [];
    const active = [];
    for (const order of dispatchOrders) {
      if (!showAllCities && isLahore(order.city) && order.forwardedBy !== 'Khawar') continue;

      if (order.currentStage === 'OUT_FOR_DELIVERY') {
        if (order.dispatchOfficer === 'Faisal') active.push(order);
        continue;
      }

      const dispatchStage = order.stages.find(s => s.stageName === 'DISPATCH');
      const isAccepted = dispatchStage?.startedAt != null;
      const isAssignedToFaisal = order.dispatchOfficer === 'Faisal' || order.forwardedBy === 'Khawar';

      if (!isAccepted || !isAssignedToFaisal) {
        unseen.push(order);
      } else {
        seen.push(order);
      }
    }

    res.json({
      unseen, seen, active,
      counts: { unseen: unseen.length, seen: seen.length, active: active.length }
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dispatch profile orders', error: error.message });
  }
};

// POST /api/dispatch-profile/:orderId/accept
const acceptDispatchOrder = async (req, res) => {
  const { orderId } = req.params;
  const { employeeName } = req.body;

  if (!employeeName || !['Khawar', 'Faisal'].includes(employeeName)) {
    return res.status(400).json({ message: 'employeeName must be Khawar or Faisal' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { where: { stageName: 'DISPATCH' } } }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.currentStage !== 'DISPATCH') {
      return res.status(400).json({ message: 'Order is not in DISPATCH stage' });
    }

    // Update dispatch stage to IN_PROGRESS
    const dispatchStage = order.stages?.[0];
    if (dispatchStage && dispatchStage.status === 'PENDING') {
      await prisma.orderStage.update({
        where: { id: dispatchStage.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() }
      });
    } else if (!dispatchStage) {
      // Create stage if missing
      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations['DISPATCH'] || 12);
      await prisma.orderStage.create({
        data: { orderId, stageName: 'DISPATCH', status: 'IN_PROGRESS', startedAt: new Date(), deadlineAt: deadline }
      });
    }

    // Assign officer
    await prisma.order.update({
      where: { id: orderId },
      data: { dispatchOfficer: employeeName }
    });

    // Audit + Dispatch log
    await createAuditLog(orderId, 'DISPATCH_ACCEPTED', `Dispatch accepted by ${employeeName}`, req.user?.id);
    await createDispatchLog({
      orderId,
      officerName: employeeName,
      action: 'ACCEPTED',
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      city: order.city
    });

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: `Dispatch accepted by ${employeeName}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept dispatch order', error: error.message });
  }
};

// POST /api/dispatch-profile/:orderId/dispatch
const dispatchFromProfile = async (req, res) => {
  const { orderId } = req.params;
  const { employeeName, dispatchMethod, trackingUrl } = req.body;

  if (!employeeName || !['Khawar', 'Faisal'].includes(employeeName)) {
    return res.status(400).json({ message: 'employeeName must be Khawar or Faisal' });
  }

  // Khawar can only use ENAMELS or FORWARD_TO_FAISAL
  // Faisal can only use TCS, POST, CUSTOMER_TAKEAWAY
  const khawarMethods = ['ENAMELS', 'FORWARD_TO_FAISAL'];
  const faisalMethods = ['TCS', 'POST', 'CUSTOMER_TAKEAWAY'];

  if (employeeName === 'Khawar' && !khawarMethods.includes(dispatchMethod)) {
    return res.status(400).json({ message: `Khawar can only use: ${khawarMethods.join(', ')}` });
  }
  if (employeeName === 'Faisal' && !faisalMethods.includes(dispatchMethod)) {
    return res.status(400).json({ message: `Faisal can only use: ${faisalMethods.join(', ')}` });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.currentStage !== 'DISPATCH') {
      return res.status(400).json({ message: 'Order is not in DISPATCH stage' });
    }

    if (dispatchMethod === 'FORWARD_TO_FAISAL') {
      // Keep order at DISPATCH, assign to Faisal
      await prisma.order.update({
        where: { id: orderId },
        data: {
          dispatchOfficer: 'Faisal',
          forwardedBy: 'Khawar'
        }
      });

      await createAuditLog(orderId, 'FORWARDED_TO_FAISAL', `Order forwarded from Khawar to Faisal dispatch`, req.user?.id);
      await createDispatchLog({
        orderId,
        officerName: 'Khawar',
        action: 'FORWARDED',
        dispatchMethod: 'FORWARD_TO_FAISAL',
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        city: order.city
      });

      const io = req.app?.get('io');
      if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

      return res.json({ message: 'Order forwarded to Faisal for dispatch' });
    }

    // For ENAMELS (Khawar) or TCS/POST/CUSTOMER_TAKEAWAY (Faisal) — dispatch the order
    const updateData = {};

    // Map dispatch methods
    const deliveryTypeMap = {
      'ENAMELS': 'ENAMELS',
      'TCS': 'TCS',
      'POST': 'POST_EX',
      'CUSTOMER_TAKEAWAY': 'WALK_IN'
    };
    const mappedDeliveryType = deliveryTypeMap[dispatchMethod];
    updateData.deliveryType = mappedDeliveryType;
    if (trackingUrl) updateData.trackingNumber = trackingUrl;

    // Complete the DISPATCH stage
    const currentStage = order.stages.find(s =>
      ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
    );
    if (currentStage) {
      await prisma.orderStage.update({
        where: { id: currentStage.id },
        data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Dispatched via ${dispatchMethod} by ${employeeName}` }
      });
    }

    // Create OUT_FOR_DELIVERY stage with appropriate deadline
    const durations = await getStageDurations(order.priority);
    const deadline = calculateDeadline(new Date(), durations['OUT_FOR_DELIVERY'] || 24);
    await prisma.orderStage.create({
      data: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING', deadlineAt: deadline }
    });

    updateData.currentStage = 'OUT_FOR_DELIVERY';
    updateData.status = 'IN_PROGRESS';
    updateData.dispatchStatus = mappedDeliveryType === 'WALK_IN' ? 'DELIVERED' : 'BOOKED';
    if (mappedDeliveryType === 'WALK_IN') {
      updateData.deliveredAt = new Date();
    }

    await prisma.order.update({ where: { id: orderId }, data: updateData });

    // Routing history for delivery users
    const getRolesForStage = (stage) => {
      const map = {
        'OUT_FOR_DELIVERY': ['OUT_FOR_DELIVERY', 'DELIVERY_BOY']
      };
      return map[stage] || ['ADMIN', 'FAISAL'];
    };

    const recipientUsers = await prisma.user.findMany({
      where: { role: { in: getRolesForStage('OUT_FOR_DELIVERY') } },
      select: { id: true }
    });
    await prisma.routingHistory.create({
      data: {
        orderId,
        sentByUserId: req.user?.id || 'system',
        sentToStage: 'OUT_FOR_DELIVERY',
        sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
        previousStage: 'DISPATCH',
        newStage: 'OUT_FOR_DELIVERY',
        remarks: `Dispatched via ${dispatchMethod} by ${employeeName}. Tracking: ${trackingUrl || 'N/A'}`,
        createdAt: new Date()
      }
    }).catch(() => {});
    await prisma.seenTask.deleteMany({
      where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: 'OUT_FOR_DELIVERY' }
    }).catch(() => {});

    // Audit + Dispatch log
    const auditAction = dispatchMethod === 'ENAMELS' ? 'DISPATCHED_ENAMELS' : 'DISPATCHED_COURIER';
    await createAuditLog(orderId, auditAction, `Dispatched via ${dispatchMethod} by ${employeeName}. Tracking: ${trackingUrl || 'N/A'}`, req.user?.id);
    await createDispatchLog({
      orderId,
      officerName: employeeName,
      action: 'DISPATCHED',
      dispatchMethod,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      city: order.city
    });

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: `Order dispatched via ${dispatchMethod} by ${employeeName}` });
  } catch (error) {
    res.status(500).json({ message: 'Error dispatching order', error: error.message });
  }
};

// GET /api/dispatch-profile/stats?employeeName=Khawar
const getDispatchProfileStats = async (req, res) => {
  try {
    const { employeeName, dateFrom, dateTo } = req.query;
    if (!employeeName || !['Khawar', 'Faisal'].includes(employeeName)) {
      return res.status(400).json({ message: 'employeeName must be Khawar or Faisal' });
    }

    const whereClause = { officerName: employeeName };
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
      if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
    }

    const logs = await prisma.dispatchLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    const accepted = logs.filter(l => l.action === 'ACCEPTED').length;
    const dispatched = logs.filter(l => l.action === 'DISPATCHED').length;
    const forwarded = logs.filter(l => l.action === 'FORWARDED').length;

    const methodBreakdown = {};
    for (const l of logs) {
      if (l.dispatchMethod) {
        methodBreakdown[l.dispatchMethod] = (methodBreakdown[l.dispatchMethod] || 0) + 1;
      }
    }

    res.json({
      totalActions: logs.length,
      accepted,
      dispatched,
      forwarded,
      methodBreakdown,
      recentLogs: logs.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dispatch profile stats', error: error.message });
  }
};

// GET /api/dispatch-profile/dashboard?dateFrom=&dateTo=&employee=&city=&status=&payment=
const getDispatchDashboard = async (req, res) => {
  try {
    const { dateFrom, dateTo, employee, city, status, payment, period } = req.query;

    const dateFilter = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    // Base order query for dispatch-related orders
    const orderWhere = {
      OR: [
        { currentStage: { in: ['DISPATCH', 'OUT_FOR_DELIVERY'] } },
        { dispatchStatus: { not: 'PENDING' } },
        { dispatchOfficer: { not: null } }
      ]
    };
    if (dateFrom || dateTo) {
      orderWhere.createdAt = { ...dateFilter };
    }
    if (city) {
      orderWhere.city = { contains: city, mode: 'insensitive' };
    }
    if (employee) {
      orderWhere.dispatchOfficer = employee;
    }
    if (status === 'pending') {
      orderWhere.currentStage = 'DISPATCH';
      orderWhere.dispatchStatus = { in: ['PENDING', 'COURIER_REQUIRED'] };
    } else if (status === 'active') {
      orderWhere.currentStage = 'OUT_FOR_DELIVERY';
    } else if (status === 'delivered') {
      orderWhere.dispatchStatus = 'DELIVERED';
    } else if (status === 'returned') {
      orderWhere.dispatchStatus = 'RETURNED';
    } else if (status === 'rejected') {
      orderWhere.status = 'REJECTED';
    }
    if (payment === 'paid') {
      orderWhere.paymentStatus = 'PAID';
    } else if (payment === 'cod') {
      orderWhere.paymentStatus = { notIn: ['PAID', 'REFUNDED'] };
    }

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        address: true, city: true, source: true, outletName: true,
        currentStage: true, status: true, dispatchStatus: true,
        deliveryType: true, deliveryMethod: true, priority: true,
        trackingNumber: true, totalPrice: true, paymentStatus: true,
        dispatchOfficer: true, forwardedBy: true,
        createdAt: true, updatedAt: true, deliveredAt: true, returnedAt: true,
        stages: {
          orderBy: { createdAt: 'asc' },
          select: { stageName: true, status: true, startedAt: true, completedAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Summary stats
    const totalOrders = orders.length;
    const pending = orders.filter(o => o.currentStage === 'DISPATCH' && !o.dispatchStatus || o.dispatchStatus === 'PENDING' || o.dispatchStatus === 'COURIER_REQUIRED').length;
    const active = orders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && o.dispatchStatus !== 'DELIVERED' && o.dispatchStatus !== 'RETURNED').length;
    const delivered = orders.filter(o => o.dispatchStatus === 'DELIVERED').length;
    const returned = orders.filter(o => o.dispatchStatus === 'RETURNED').length;
    const rejected = orders.filter(o => o.status === 'REJECTED').length;
    const cod = orders.filter(o => o.paymentStatus !== 'PAID' && o.paymentStatus !== 'REFUNDED').length;
    const paid = orders.filter(o => o.paymentStatus === 'PAID').length;

    // Dispatch log based stats for employee performance
    const logWhere = {};
    if (dateFrom) logWhere.createdAt = { ...logWhere.createdAt, gte: new Date(dateFrom) };
    if (dateTo) logWhere.createdAt = { ...logWhere.createdAt, lte: new Date(dateTo) };

    const allLogs = await prisma.dispatchLog.findMany({
      where: Object.keys(logWhere).length ? logWhere : undefined,
      orderBy: { createdAt: 'desc' }
    });

    const buildEmployeeStats = (name) => {
      const empLogs = allLogs.filter(l => l.officerName === name);
      const accepted = empLogs.filter(l => l.action === 'ACCEPTED').length;
      const dispatched = empLogs.filter(l => l.action === 'DISPATCHED').length;
      const forwarded = empLogs.filter(l => l.action === 'FORWARDED').length;
      const pendingCount = accepted - dispatched;
      const dispatchTimes = [];
      let lastDispatch = null;
      for (const l of empLogs) {
        if (l.action === 'DISPATCHED') {
          lastDispatch = l.createdAt;
          const acceptedLog = empLogs.find(al => al.action === 'ACCEPTED' && al.orderId === l.orderId);
          if (acceptedLog) {
            const diff = (new Date(l.createdAt) - new Date(acceptedLog.createdAt)) / (1000 * 60);
            if (diff > 0) dispatchTimes.push(diff);
          }
        }
      }
      const avgDispatchTime = dispatchTimes.length ? Math.round(dispatchTimes.reduce((a, b) => a + b, 0) / dispatchTimes.length) : null;
      const deliveredCount = empLogs.filter(l => l.action === 'DISPATCHED' && l.dispatchMethod === 'CUSTOMER_TAKEAWAY').length;
      const returnedFromLogs = 0;

      return {
        totalAssigned: accepted,
        totalDispatched: dispatched,
        forwarded,
        pending: Math.max(0, pendingCount),
        delivered: deliveredCount,
        returned: returnedFromLogs,
        rejected: 0,
        averageDispatchTime: avgDispatchTime ? `${avgDispatchTime} min` : 'N/A',
        lastDispatch: lastDispatch ? lastDispatch.toISOString() : null
      };
    };

    const employeeStats = {
      Khawar: buildEmployeeStats('Khawar'),
      Faisal: buildEmployeeStats('Faisal')
    };

    // Tracking data for the table
    const trackingData = orders.map(o => {
      const dispatchStage = o.stages.find(s => s.stageName === 'DISPATCH');
      const deliveryStage = o.stages.find(s => s.stageName === 'OUT_FOR_DELIVERY');
      const dispatchLogEntry = allLogs.find(l => l.orderId === o.id && l.action === 'DISPATCHED');
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        city: o.city,
        dispatchOfficer: o.dispatchOfficer,
        dispatchMethod: o.deliveryType || dispatchLogEntry?.dispatchMethod || '—',
        currentStage: o.currentStage,
        dispatchStatus: o.dispatchStatus,
        paymentStatus: o.paymentStatus,
        assignedAt: dispatchStage?.startedAt || null,
        dispatchedAt: dispatchStage?.completedAt || null,
        deliveredAt: o.deliveredAt || null,
        returnedAt: o.returnedAt || null,
        createdAt: o.createdAt
      };
    });

    // Monthly report
    const monthlyMap = {};
    for (const o of orders) {
      const m = new Date(o.createdAt).toISOString().slice(0, 7);
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, total: 0, delivered: 0, returned: 0, rejected: 0, pending: 0, cod: 0, paid: 0 };
      monthlyMap[m].total++;
      if (o.dispatchStatus === 'DELIVERED') monthlyMap[m].delivered++;
      if (o.dispatchStatus === 'RETURNED') monthlyMap[m].returned++;
      if (o.status === 'REJECTED') monthlyMap[m].rejected++;
      if (o.currentStage === 'DISPATCH' && (!o.dispatchStatus || o.dispatchStatus === 'PENDING')) monthlyMap[m].pending++;
      if (o.paymentStatus !== 'PAID') monthlyMap[m].cod++;
      if (o.paymentStatus === 'PAID') monthlyMap[m].paid++;
    }
    const monthlyReport = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // Employee monthly breakdown
    const employeeMonthly = {};
    for (const name of ['Khawar', 'Faisal']) {
      const empLogs = allLogs.filter(l => l.officerName === name);
      const empMonthlyMap = {};
      for (const l of empLogs) {
        const m = new Date(l.createdAt).toISOString().slice(0, 7);
        if (!empMonthlyMap[m]) empMonthlyMap[m] = { month: m, dispatches: 0, deliveries: 0, returns: 0, pending: 0 };
        if (l.action === 'DISPATCHED') empMonthlyMap[m].dispatches++;
        if (l.dispatchMethod === 'CUSTOMER_TAKEAWAY') empMonthlyMap[m].deliveries++;
      }
      // Also check order status from orders
      const empOrders = orders.filter(o => o.dispatchOfficer === name);
      for (const o of empOrders) {
        const m = new Date(o.createdAt).toISOString().slice(0, 7);
        if (!empMonthlyMap[m]) empMonthlyMap[m] = { month: m, dispatches: 0, deliveries: 0, returns: 0, pending: 0 };
        if (o.dispatchStatus === 'RETURNED') empMonthlyMap[m].returns++;
        if (o.currentStage === 'DISPATCH' && (!o.dispatchStatus || o.dispatchStatus === 'PENDING')) empMonthlyMap[m].pending++;
        if (o.dispatchStatus === 'DELIVERED') empMonthlyMap[m].deliveries++;
      }
      employeeMonthly[name] = Object.values(empMonthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    }

    res.json({
      summary: { totalOrders, pending, active, delivered, returned, rejected, cod, paid },
      employeeStats,
      trackingData,
      monthlyReport,
      employeeMonthly
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dispatch dashboard', error: error.message });
  }
};

module.exports = { getDispatchProfileOrders, acceptDispatchOrder, dispatchFromProfile, getDispatchProfileStats, getDispatchDashboard };
