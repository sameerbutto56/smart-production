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

const getStageDurations = async (priority = 'NORMAL') => {
  const settings = await prisma.systemSetting.findUnique({ where: { key: 'STAGE_DURATIONS' } });
  const slaSettings = await prisma.systemSetting.findUnique({ where: { key: 'SLA_CONFIG' } });
  const profileSettings = await prisma.systemSetting.findUnique({ where: { key: 'PROFILE_DEADLINES' } });
  let slaMultiplier = 1;
  if (slaSettings) {
    try {
      const sla = JSON.parse(slaSettings.value);
      if (priority === 'SUPER_URGENT') slaMultiplier = sla.superUrgentMultiplier || 0.5;
      else if (priority === 'URGENT') slaMultiplier = sla.urgentMultiplier || 0.75;
    } catch (e) {}
  }
  let durations = { 'STORE': 24, 'PRODUCTION': 48, 'LOGO_DESIGN': 24, 'DISPATCH': 12, 'OUT_FOR_DELIVERY': 12 };
  if (profileSettings) {
    try {
      const profileDeadlines = JSON.parse(profileSettings.value);
      const roleStageMap = { 'ORDER_ENTRY': 'ORDER_ENTRY', 'STORE': 'STORE', 'PRODUCTION': 'PRODUCTION', 'LOGO_DESIGN': 'LOGO_DESIGN', 'DISPATCH': 'DISPATCH', 'OUT_FOR_DELIVERY': 'OUT_FOR_DELIVERY', 'DELIVERY_BOY': 'OUT_FOR_DELIVERY', 'FAISAL': 'FAISAL_APPROVAL' };
      for (const [role, hours] of Object.entries(profileDeadlines)) {
        const stage = roleStageMap[role];
        if (stage && hours > 0) durations[stage] = hours;
      }
    } catch (e) {}
  }
  if (settings) {
    try { durations = { ...durations, ...JSON.parse(settings.value) }; } catch (e) {}
  }
  const adjusted = {};
  for (const [stage, hours] of Object.entries(durations)) {
    adjusted[stage] = Math.round((hours * slaMultiplier) * 100) / 100;
  }
  return adjusted;
};

const getDispatchQueue = async (req, res) => {
  try {
    const whereClause = {
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
        stages: { orderBy: { createdAt: 'desc' } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5 },
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
      io.emit('dispatch-request', {
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
      io.emit('global-alert', {
        title: '📦 Courier Dispatch Requested',
        message: `Order #${order.orderNumber || order.id.substring(0, 8)} — ${order.customerName}. ${order.outletName ? `From: ${order.outletName}. ` : ''}Destination: ${destinationCity || order.city || 'N/A'}.`,
        type: 'DISPATCH_REQUEST',
        urgent: order.priority === 'SUPER_URGENT' || order.priority === 'URGENT'
      });
    }

    res.json({ message: 'Courier dispatch requested. Dispatch department has been notified.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to request courier dispatch', error: error.message });
  }
};

const bookCourier = async (req, res) => {
  const { orderId } = req.params;
  const { courierName, trackingNumber, estimatedDelivery } = req.body;

  if (!courierName || !trackingNumber) {
    return res.status(400).json({ message: 'Courier name and tracking number are required' });
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

    await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingNumber,
        courierDetails,
        deliveryMethod: courierName,
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

    res.json({ message: `Courier booked: ${courierName}`, trackingNumber });
  } catch (error) {
    res.status(500).json({ message: 'Failed to book courier', error: error.message });
  }
};

const updateCourierStatus = async (req, res) => {
  const { orderId } = req.params;
  const { dispatchStatus } = req.body;

  const validStatuses = ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
  if (!validStatuses.includes(dispatchStatus)) {
    return res.status(400).json({ message: `Invalid status. Must be: ${validStatuses.join(', ')}` });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const existingDetails = order.courierDetails || {};
    const updateData = { dispatchStatus };

    if (dispatchStatus === 'DELIVERED' || dispatchStatus === 'COMPLETED') {
      updateData.currentStage = 'COMPLETED';
      updateData.status = 'COMPLETED';
    }

    if (dispatchStatus === 'DISPATCHED') {
      existingDetails.dispatchedAt = new Date().toISOString();
    }
    if (dispatchStatus === 'IN_TRANSIT') {
      existingDetails.inTransitAt = new Date().toISOString();
    }
    if (dispatchStatus === 'DELIVERED') {
      existingDetails.deliveredAt = new Date().toISOString();
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
        stages: { orderBy: { createdAt: 'desc' } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5 },
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

    const io = req.app?.get('io');
    if (io) {
      io.emit('order-updated', { orderId, createdById: order.createdById });
      io.emit('global-alert', {
        title: '✅ Order Picked Up',
        message: `Order #${order.orderNumber || order.id.substring(0, 8)} has been picked up by customer.`,
        type: 'PICKUP'
      });
    }

    res.json({ message: 'Order marked as picked up' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark as picked up', error: error.message });
  }
};

module.exports = { getDispatchQueue, requestCourierDispatch, bookCourier, updateCourierStatus, getPickupOrders, markPickedUp };
