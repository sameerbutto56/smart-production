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

// GET /api/dispatch-profile/orders?employeeName=Khawar
const getDispatchProfileOrders = async (req, res) => {
  try {
    const { employeeName } = req.query;
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

    // Helper: check if city is Lahore-like (handles trailing spaces, mixed case)
    const isLahore = (c) => c && c.trim().toLowerCase() === 'lahore';

    if (employeeName === 'Khawar') {
      // Khawar — Lahore only
      const orders = await prisma.order.findMany({
        where: {
          currentStage: 'DISPATCH',
          status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
        },
        select: baseSelect,
        orderBy: baseOrder
      });

      const unseen = [];
      const active = [];
      for (const order of orders) {
        if (!isLahore(order.city)) continue;
        const dispatchStage = order.stages.find(s => s.stageName === 'DISPATCH');
        if (!dispatchStage?.startedAt && !order.dispatchOfficer) {
          unseen.push(order);
        } else if (order.dispatchOfficer === 'Khawar') {
          active.push(order);
        } else {
          unseen.push(order);
        }
      }
      return res.json({ unseen, active, counts: { unseen: unseen.length, active: active.length } });
    }

    // ─── FAISAL: three-way split ───

    // 1) DISPATCH stage orders — split into unseen (not accepted) and seen (accepted, awaiting dispatch)
    const dispatchOrders = await prisma.order.findMany({
      where: {
        currentStage: 'DISPATCH',
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
      },
      select: baseSelect,
      orderBy: baseOrder
    });

    const unseen = [];
    const seen = [];
    for (const order of dispatchOrders) {
      // Exclude non-forwarded Lahore orders
      if (isLahore(order.city) && order.forwardedBy !== 'Khawar') continue;
      const dispatchStage = order.stages.find(s => s.stageName === 'DISPATCH');
      const isAccepted = dispatchStage?.startedAt != null;
      const isAssignedToFaisal = order.dispatchOfficer === 'Faisal' || order.forwardedBy === 'Khawar';
      if (!isAccepted || !isAssignedToFaisal) {
        unseen.push(order);
      } else {
        seen.push(order);
      }
    }

    // 2) OUT_FOR_DELIVERY stage orders dispatched by Faisal — active, awaiting final outcome
    const activeOrders = await prisma.order.findMany({
      where: {
        currentStage: 'OUT_FOR_DELIVERY',
        dispatchOfficer: 'Faisal',
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
      },
      select: baseSelect,
      orderBy: baseOrder
    });

    res.json({
      unseen,
      seen,
      active: activeOrders,
      counts: { unseen: unseen.length, seen: seen.length, active: activeOrders.length }
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

module.exports = { getDispatchProfileOrders, acceptDispatchOrder, dispatchFromProfile, getDispatchProfileStats };
