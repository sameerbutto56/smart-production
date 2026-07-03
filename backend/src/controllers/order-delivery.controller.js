const prisma = require('../prisma');
const {
  isSystemPaused, createAuditLog, calculateAndRecordRevenue,
  reverseInventoryForRefund
} = require('./order-helpers');

const updateDeliveryStatus = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryStatus, remarks, paymentMethod, cashAmount, onlineAmount, deliveryMethod } = req.body;
  const userId = req.user?.id;
  const riderName = req.user?.name;

  try {
    if (await isSystemPaused()) {
      return res.status(503).json({ message: 'System is paused for holidays. Delivery updates are disabled.' });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (deliveryStatus === 'FAILED' || deliveryStatus === 'NOT_RESPONDED') {
      const currentAttempt = (order.noResponseCount || 0) + 1;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      await prisma.deliveryAttempt.create({ data: { orderId, attemptNumber: currentAttempt, status: 'NO_RESPONSE', riderId: userId, riderName, rescheduledTo: currentAttempt < 3 ? tomorrow : null, notes: remarks || 'Customer did not respond' } });
      if (currentAttempt < 3) {
        await prisma.order.update({ where: { id: orderId }, data: { dispatchStatus: 'RESCHEDULED', noResponseCount: currentAttempt, nextDeliveryDate: tomorrow, lastDeliveryAttempt: new Date(), updatedAt: new Date() } });
        const outStage = await prisma.orderStage.findFirst({ where: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING' } });
        if (outStage) await prisma.orderStage.update({ where: { id: outStage.id }, data: { deadlineAt: tomorrow } });
        await createAuditLog(orderId, 'DELIVERY_FAILED', `No Response (Attempt ${currentAttempt}/3). Auto-rescheduled to ${tomorrow.toLocaleDateString()}.`, userId);
      } else {
        await prisma.order.update({ where: { id: orderId }, data: { dispatchStatus: 'FAILED', noResponseCount: currentAttempt, lastDeliveryAttempt: new Date(), status: 'MAX_ATTEMPTS_REACHED', updatedAt: new Date() } });
        await createAuditLog(orderId, 'DELIVERY_FAILED', `No Response (Attempt ${currentAttempt}/3). Maximum delivery attempts reached.`, userId);
      }
    } else if (deliveryStatus === 'RESCHEDULED') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const outStage = await prisma.orderStage.findFirst({ where: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING' } });
      if (outStage) await prisma.orderStage.update({ where: { id: outStage.id }, data: { deadlineAt: tomorrow } });
      await prisma.order.update({ where: { id: orderId }, data: { dispatchStatus: 'RESCHEDULED', nextDeliveryDate: tomorrow, updatedAt: new Date() } });
      await createAuditLog(orderId, 'DELIVERY_RESCHEDULED', remarks || `Rescheduled to ${tomorrow.toLocaleDateString()}.`, userId);
    } else if (deliveryStatus === 'DELIVERED') {
      let courierDetails = order.courierDetails || {};
      if (typeof courierDetails === 'string') courierDetails = JSON.parse(courierDetails);
      if (!courierDetails.payments) courierDetails.payments = [];
      if (paymentMethod === 'HALF_CASH_HALF_ONLINE') {
        courierDetails.payments.push({ method: 'CASH', amount: parseFloat(cashAmount || 0), date: new Date().toISOString(), recordedBy: userId }, { method: 'ONLINE_TRANSFER', amount: parseFloat(onlineAmount || 0), date: new Date().toISOString(), recordedBy: userId });
      } else {
        courierDetails.payments.push({ method: paymentMethod || 'CASH', amount: order.totalPrice || 0, date: new Date().toISOString(), recordedBy: userId });
      }
      const totalPaid = courierDetails.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const paymentStatus = totalPaid >= (order.totalPrice || 0) ? 'FULL_PAID' : 'PARTIAL_PAID';
      const updateData = { status: 'COMPLETED', currentStage: 'DELIVERED', paymentStatus, advancePaid: true, dispatchStatus: 'DELIVERED', paymentMethod: paymentMethod || 'CASH', courierDetails, deliveredAt: new Date(), updatedAt: new Date() };
      if (deliveryMethod) updateData.deliveryMethod = deliveryMethod;
      const updatedOrder = await prisma.order.update({ where: { id: orderId }, data: updateData, include: { stages: true } });
      await prisma.deliveryAttempt.create({ data: { orderId, attemptNumber: (order.noResponseCount || 0) + 1, status: 'DELIVERED', riderId: userId, riderName, notes: remarks || 'Order delivered successfully' } });
      await calculateAndRecordRevenue(updatedOrder);
      await createAuditLog(orderId, 'DELIVERED', remarks || 'Order delivered', userId);
      const io = req.app.get('io');
      io.emit('order-updated', { order: updatedOrder, createdById: order.createdById });
      return res.json(updatedOrder);
    }

    await prisma.order.update({ where: { id: orderId }, data: { updatedAt: new Date() } });
    await createAuditLog(orderId, 'DELIVERY_STATUS_UPDATED', `Status: ${deliveryStatus}. ${remarks || ''}`, userId);
    const io = req.app.get('io');
    const freshOrder = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: { orderBy: { createdAt: 'desc' } } } });
    io.emit('order-updated', { order: freshOrder, createdById: order.createdById });
    res.json(freshOrder);
  } catch (error) {
    console.error('Delivery status update error:', error);
    res.status(500).json({ message: 'Error updating delivery status', error: error.message });
  }
};

const acceptDelivery = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user?.id;
  try {
    if (await isSystemPaused()) return res.status(503).json({ message: 'System is paused.' });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.dispatchStatus === 'DELIVERED') return res.status(400).json({ message: 'Already delivered' });
    if (order.riderAcceptedAt) return res.status(400).json({ message: 'Already accepted' });
    const updatedOrder = await prisma.order.update({ where: { id: orderId }, data: { riderAcceptedAt: new Date(), dispatchStatus: 'ACCEPTED', updatedAt: new Date() }, include: { stages: { orderBy: { createdAt: 'desc' } } } });
    await createAuditLog(orderId, 'DELIVERY_ACCEPTED', 'Rider accepted delivery', userId);
    req.app.get('io').emit('order-updated', { order: updatedOrder, createdById: order.createdById });
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error accepting delivery', error: error.message });
  }
};

const getDeliveryHistory = async (req, res) => {
  try {
    const attempts = await prisma.deliveryAttempt.findMany({ where: { orderId: req.params.orderId }, orderBy: { attemptNumber: 'asc' } });
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery history', error: error.message });
  }
};

const refundOrder = async (req, res) => {
  const { orderId } = req.params;
  const { reason, note } = req.body;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    await prisma.order.update({ where: { id: orderId }, data: { refundStatus: 'REQUESTED', refundReason: reason || 'Not specified', refundNote: note || '', refundedAt: new Date(), refundedById: req.user.id, dispatchStatus: 'RETURNED', currentStage: 'RETURNED', status: 'RETURNED', updatedAt: new Date() } });
    await createAuditLog(orderId, 'REFUND_REQUESTED', `Refund by ${req.user.name}. Reason: ${reason || 'N/A'}`, req.user.id);
    req.app.get('io').emit('order-updated', { orderId, createdById: order.createdById });
    res.json({ message: 'Refund requested' });
  } catch (error) {
    res.status(500).json({ message: 'Error processing refund request', error: error.message });
  }
};

const getRefundQueue = async (req, res) => {
  try {
    const role = String(req.user.role || '').toUpperCase().trim();
    let where = { refundStatus: { not: 'NONE' }, OR: [{ dispatchStatus: { in: ['FAILED', 'RETURNED'] } }, { refundStatus: 'REQUESTED' }, { currentStage: { in: ['OUT_FOR_DELIVERY', 'DISPATCH', 'RETURNED'] } }] };
    if (role === 'FAISAL') { where.createdById = req.user.id; where.source = { in: ['ONLINE', 'INTERNAL'] }; }
    const limit = parseInt(req.query.limit) || 200;
    const orders = await prisma.order.findMany({ where, include: { stages: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } }, createdBy: { select: { name: true } } }, orderBy: { refundedAt: 'desc' }, take: limit });
    res.json(orders || []);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching refund queue', error: error.message });
  }
};

const processRefund = async (req, res) => {
  const { orderId } = req.params;
  const { action, note } = req.body;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    let refundStatus = action === 'REFUNDED' ? 'REFUNDED' : 'PROCESSING';
    let auditAction = action === 'REFUNDED' ? 'REFUND_COMPLETED' : 'REFUND_PROCESSING';
    let auditMessage = action === 'REFUNDED' ? `Refund completed by ${req.user.name}. Note: ${note || 'N/A'}` : `Refund processing started by ${req.user.name}. Note: ${note || 'N/A'}`;
    let updateData = { refundStatus, refundNote: note || order.refundNote || '', updatedAt: new Date() };
    if (action === 'REFUNDED') {
      updateData.dispatchStatus = 'REFUNDED';
      updateData.currentStage = 'REFUNDED';
      updateData.status = 'REFUNDED';
      const inventoryAdded = await prisma.auditLog.findFirst({ where: { orderId, action: 'INVENTORY_ADDED' } });
      if (inventoryAdded) { try { await reverseInventoryForRefund(order, req.user.id); auditMessage += '; Inventory reversed.'; } catch (invErr) { console.error('Inventory reverse failed:', invErr); } }
      try { await prisma.revenueRecord.deleteMany({ where: { orderId } }); await prisma.order.update({ where: { id: orderId }, data: { grossProfit: 0, netProfit: 0 } }); auditMessage += '; Revenue reversed.'; } catch (revErr) { console.error('Revenue delete failed:', revErr); }
    }
    await prisma.order.update({ where: { id: orderId }, data: updateData });
    await createAuditLog(orderId, auditAction, auditMessage, req.user.id);
    req.app.get('io').emit('order-updated', { orderId, createdById: order.createdById });
    res.json({ message: `Refund ${action === 'REFUNDED' ? 'completed' : 'processing started'}` });
  } catch (error) {
    res.status(500).json({ message: 'Error processing refund', error: error.message });
  }
};

module.exports = { updateDeliveryStatus, acceptDelivery, getDeliveryHistory, refundOrder, getRefundQueue, processRefund };
