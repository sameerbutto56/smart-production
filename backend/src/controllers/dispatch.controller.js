const prisma = require('../prisma');
const { calculateDeadline } = require('../utils/deadline');
const notify = require('../utils/notify');
const { syncReplacementCaseOnOrderCompletion } = require('./order-helpers');

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

const getDispatchQueue = async (req, res) => {
  try {
    const whereClause = {
      currentStage: { notIn: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'] },
      OR: [
        { currentStage: 'DISPATCH' },
        { dispatchStatus: { in: ['COURIER_REQUIRED', 'READY_FOR_DISPATCH', 'BOOKED', 'DISPATCHED', 'IN_TRANSIT'] } }
      ]
    };

    if (req.user?.role === 'OUTLET') {
      const name = req.user?.name || '';
      let outletName = 'OUTLET';
      if (name.includes('1') || name.toLowerCase().includes('johar')) outletName = 'JOHAR TOWN BRANCH';
      else if (name.includes('2') || name.toLowerCase().includes('jail')) outletName = 'JAIL ROAD BRANCH';
      else if (name.includes('3') || name.toLowerCase().includes('abbottabad')) outletName = 'ABBOTTABAD BRANCH';
      whereClause.outletName = outletName;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
    });

    const PRIORITY_SORT = { 'SUPER_URGENT': 0, 'URGENT': 1, 'NORMAL': 2 };
    const sorted = [...orders].sort((a, b) => {
      const pa = PRIORITY_SORT[a.priority] ?? 2;
      const pb = PRIORITY_SORT[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(sorted);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dispatch queue', error: error.message });
  }
};

const requestCourierDispatch = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryMethod, destinationCity, notes } = req.body;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryMethod: deliveryMethod || order.deliveryMethod,
        dispatchStatus: 'COURIER_REQUIRED',
        city: destinationCity || order.city
      }
    });

    await createAuditLog(orderId, 'COURIER_DISPATCH_REQUESTED', `Courier dispatch requested. Method: ${deliveryMethod}. ${notes ? `Notes: ${notes}` : ''}. Requested by: ${req.user.name}`, req.user.id);

    const io = req.app?.get('io');
    if (io) {
      const orderWithDetails = await prisma.order.findUnique({
        where: { id: orderId },
        include: { createdBy: { select: { name: true, role: true } } }
      });
      io.to('role:DISPATCH').emit('dispatch-request', {
        orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        outletName: order.outletName,
        source: order.source,
        city: destinationCity || order.city,
        priority: order.priority,
        requestedBy: req.user.name,
        message: `New courier dispatch request from ${req.user.name} for Order #${order.orderNumber || order.id.substring(0, 8)}`
      });
      io.to('role:DISPATCH').emit('global-alert', {
        title: '📦 Courier Dispatch Requested',
        message: `Order #${order.orderNumber || order.id.substring(0, 8)} — ${order.customerName}. ${order.outletName ? `From: ${order.outletName}. ` : ''}Destination: ${destinationCity || order.city || 'N/A'}.`,
        type: 'DISPATCH_REQUEST',
        urgent: order.priority === 'SUPER_URGENT' || order.priority === 'URGENT'
      });
    }

    await notify.create(req, { type: 'dispatch_request', moduleName: 'My Tasks', path: '/dispatch', role: 'DISPATCH', title: 'Courier Required', message: `Order #${order.orderNumber} needs courier dispatch`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Courier Required', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: 'Courier dispatch requested. Dispatch department has been notified.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to request courier dispatch', error: error.message });
  }
};

const bookCourier = async (req, res) => {
  const { orderId } = req.params;
  const { courierName, trackingNumber, estimatedDelivery } = req.body;

  if (!courierName) {
    return res.status(400).json({ message: 'Courier name is required' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const courierDetails = {
      courierName,
      trackingNumber,
      bookedAt: new Date().toISOString(),
      estimatedDelivery: estimatedDelivery || null,
      status: 'BOOKED'
    };

    const deliveryTypeMap = {
      'Enamels Delivery': 'ENAMELS',
      'TCS': 'TCS',
      'PostEx': 'POST_EX',
    };
    const mappedDeliveryType = deliveryTypeMap[courierName] || null;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingNumber,
        courierDetails,
        deliveryMethod: courierName,
        deliveryType: mappedDeliveryType,
        dispatchStatus: 'BOOKED'
      }
    });

    await prisma.auditLog.create({
      data: {
        orderId,
        action: 'COURIER_BOOKED',
        details: `Courier booked: ${courierName}. Tracking: ${trackingNumber}. Booked by: ${req.user.name}`,
        performedBy: req.user.id
      }
    });

    // Auto-create OUT_FOR_DELIVERY stage
    const existingStage = order.stages?.find(s => s.stageName === 'OUT_FOR_DELIVERY' && s.status === 'PENDING');
    if (!existingStage) {
      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations['OUT_FOR_DELIVERY'] || 24);
      await prisma.orderStage.create({
        data: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING', deadlineAt: deadline }
      });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: 'OUT_FOR_DELIVERY' }
    });

    // Routing history + SeenTask for delivery users
    if (mappedDeliveryType === 'ENAMELS') {
      const recipientUsers = await prisma.user.findMany({
        where: { role: { in: ['OUT_FOR_DELIVERY', 'DELIVERY_BOY'] } },
        select: { id: true }
      });
      await prisma.routingHistory.create({
        data: {
          orderId,
          sentByUserId: req.user.id,
          sentToStage: 'OUT_FOR_DELIVERY',
          sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
          previousStage: 'DISPATCH',
          newStage: 'OUT_FOR_DELIVERY',
          remarks: `Dispatched via Enamels Delivery. Tracking: ${trackingNumber || 'N/A'}`,
          createdAt: new Date()
        }
      }).catch(() => {});
      await prisma.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: 'OUT_FOR_DELIVERY' }
      }).catch(() => {});
    }

    await notify.create(req, { type: 'delivery_task', moduleName: 'Deliveries', path: '/delivery', role: 'DELIVERY_BOY', title: 'New Delivery', message: `Order #${order.orderNumber} booked with courier`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Courier Booked', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: `Courier booked: ${courierName}`, trackingNumber });
  } catch (error) {
    res.status(500).json({ message: 'Failed to book courier', error: error.message });
  }
};

const updateCourierStatus = async (req, res) => {
  const { orderId } = req.params;
  const { dispatchStatus } = req.body;

  const validStatuses = ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'RETURNED', 'REJECTED'];
  if (!validStatuses.includes(dispatchStatus)) {
    return res.status(400).json({ message: `Invalid status. Must be: ${validStatuses.join(', ')}` });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const existingDetails = order.courierDetails || {};
    const updateData = { dispatchStatus };

    if (dispatchStatus === 'DISPATCHED' || dispatchStatus === 'IN_TRANSIT') {
      if (order.currentStage !== 'OUT_FOR_DELIVERY') {
        updateData.currentStage = 'OUT_FOR_DELIVERY';
      }
    }
    if (dispatchStatus === 'DELIVERED' || dispatchStatus === 'COMPLETED') {
      updateData.currentStage = 'COMPLETED';
      updateData.status = 'COMPLETED';
    }
    if (dispatchStatus === 'RETURNED' || dispatchStatus === 'REJECTED') {
      const now = new Date();
      existingDetails.returnedAt = now.toISOString();
      updateData.returnedAt = now;
    }

    if (dispatchStatus === 'DISPATCHED') {
      existingDetails.dispatchedAt = new Date().toISOString();
    }
    if (dispatchStatus === 'IN_TRANSIT') {
      existingDetails.inTransitAt = new Date().toISOString();
    }
    if (dispatchStatus === 'DELIVERED') {
      existingDetails.deliveredAt = new Date().toISOString();
      updateData.deliveredAt = new Date();
    }

    updateData.courierDetails = existingDetails;

    await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    await prisma.auditLog.create({
      data: {
        orderId,
        action: `COURIER_${dispatchStatus}`,
        details: `Courier status updated to ${dispatchStatus} by ${req.user.name}`,
        performedBy: req.user.id
      }
    });

    // Log status change in DispatchLog for activity tracking
    await createDispatchLog({
      orderId,
      officerName: order.dispatchOfficer || 'SYSTEM',
      action: dispatchStatus,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      city: order.city
    });

    res.json({ message: `Courier status updated to ${dispatchStatus}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update courier status', error: error.message });
  }
};

const getPickupOrders = async (req, res) => {
  try {
    const whereClause = {
      deliveryType: 'PICKUP',
      currentStage: { in: ['DISPATCH', 'OUT_FOR_DELIVERY', 'COMPLETED'] }
    };

    if (req.user?.role === 'OUTLET') {
      const name = req.user?.name || '';
      let outletName = 'OUTLET';
      if (name.includes('1') || name.toLowerCase().includes('johar')) outletName = 'JOHAR TOWN BRANCH';
      else if (name.includes('2') || name.toLowerCase().includes('jail')) outletName = 'JAIL ROAD BRANCH';
      else if (name.includes('3') || name.toLowerCase().includes('abbottabad')) outletName = 'ABBOTTABAD BRANCH';
      whereClause.outletName = outletName;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pickup orders', error: error.message });
  }
};

const markPickedUp = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.deliveryType !== 'PICKUP') return res.status(400).json({ message: 'Order is not marked for pickup' });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        currentStage: 'COMPLETED',
        status: 'COMPLETED',
        dispatchStatus: 'PICKED_UP'
      }
    });

    await createAuditLog(orderId, 'PICKED_UP', `Order picked up by customer. Marked by: ${req.user.name}`, req.user.id);
    await syncReplacementCaseOnOrderCompletion(order);

    const io = req.app?.get('io');
    if (io) {
      io.emit('order-updated', { orderId, createdById: order.createdById });
      io.emit('global-alert', {
        title: '✅ Order Picked Up',
        message: `Order #${order.orderNumber || order.id.substring(0, 8)} has been picked up by customer.`,
        type: 'PICKUP'
      });
    }

    await notify.create(req, { type: 'order_completed', moduleName: 'Orders', path: '/orders', role: 'FAISAL', title: 'Order Picked Up', message: `Order #${order.orderNumber} was picked up`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Picked Up', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: 'Order marked as picked up' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark as picked up', error: error.message });
  }
};

// Dispatch dashboard with 3 categories: unseen, seen, active
const getDispatchDashboard = async (req, res) => {
  try {
    const baseWhere = {};
    if (req.user?.role === 'OUTLET') {
      const name = req.user?.name || '';
      let outletName = 'OUTLET';
      if (name.includes('1') || name.toLowerCase().includes('johar')) outletName = 'JOHAR TOWN BRANCH';
      else if (name.includes('2') || name.toLowerCase().includes('jail')) outletName = 'JAIL ROAD BRANCH';
      else if (name.includes('3') || name.toLowerCase().includes('abbottabad')) outletName = 'ABBOTTABAD BRANCH';
      baseWhere.outletName = outletName;
    }

    // Include completed/delivered so active orders stay visible until final status
    const orders = await prisma.order.findMany({
      where: {
        ...baseWhere,
        OR: [
          { currentStage: { in: ['DISPATCH', 'OUT_FOR_DELIVERY'] } },
          { dispatchStatus: { in: ['BOOKED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'REJECTED'] } },
          { dispatchOfficer: { not: null } }
        ]
      },
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        address: true, city: true, source: true, outletName: true,
        currentStage: true, status: true, dispatchStatus: true,
        deliveryType: true, deliveryMethod: true, priority: true,
        trackingNumber: true, courierDetails: true,
        totalPrice: true, paymentStatus: true, advanceAmount: true,
        type: true, productDetails: true, customization: true, sizeData: true,
        instructionNotes: true, dispatchOfficer: true, forwardedBy: true,
        createdAt: true, updatedAt: true, deliveredAt: true, returnedAt: true,
        riderAcceptedAt: true, noResponseCount: true,
        stages: { orderBy: { createdAt: 'asc' }, select: { stageName: true, status: true, deadlineAt: true, startedAt: true, rejectionReason: true, completedAt: true } },
        createdBy: { select: { name: true, role: true } }
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
    });

    // Categorize into unseen / seen / active
    const unseen = [];
    const seen = [];
    const active = [];

    for (const order of orders) {
      const dispatchStages = (order.stages || []).filter(s => s.stageName === 'DISPATCH');
      const dispatchStage = dispatchStages[dispatchStages.length - 1];
      const isAccepted = (dispatchStage?.startedAt != null) || order.dispatchOfficer != null;
      const isDispatched = order.currentStage === 'OUT_FOR_DELIVERY' || order.dispatchStatus === 'BOOKED' || order.dispatchStatus === 'DISPATCHED';

      if (order.currentStage === 'OUT_FOR_DELIVERY' || ['BOOKED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'REJECTED', 'PICKED_UP'].includes(order.dispatchStatus)) {
        // Order has been dispatched — active tasks
        active.push(order);
      } else if (order.currentStage === 'DISPATCH' && order.dispatchOfficer && isAccepted) {
        // Accepted by an officer, awaiting dispatch — seen
        seen.push(order);
      } else if (order.currentStage === 'DISPATCH' && !order.dispatchOfficer && !isAccepted) {
        // Not yet accepted — unseen
        unseen.push(order);
      } else if (order.currentStage === 'DISPATCH' && isAccepted) {
        seen.push(order);
      } else {
        unseen.push(order);
      }
    }

    const terminalStatuses = ['DELIVERED', 'RETURNED', 'REJECTED', 'PICKED_UP'];
    const filteredActive = active.filter(o => !terminalStatuses.includes(o.dispatchStatus));

    res.json({ unseen, seen, active: filteredActive, counts: { unseen: unseen.length, seen: seen.length, active: filteredActive.length } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dispatch dashboard', error: error.message });
  }
};

module.exports = { getDispatchQueue, requestCourierDispatch, bookCourier, updateCourierStatus, getPickupOrders, markPickedUp, getDispatchDashboard };
