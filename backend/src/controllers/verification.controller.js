const prisma = require('../prisma');
const notify = require('../utils/notify');
const { getRolesForStage } = require('./order.controller');

const getPendingVerifications = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const where = { goForVerification: true, verifiedAt: null, verificationReturnedAt: null };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { stages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.order.count({ where })
    ]);
    res.json({ orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    res.status(500).json({ message: 'Failed to fetch pending verifications', error: error.message });
  }
};

const getVerificationHistory = async (req, res) => {
  try {
    const { search, page = 1, limit = 50, dateFrom, dateTo } = req.query;
    const where = { goForVerification: true, verifiedAt: { not: null } };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { verifiedByName: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (dateFrom || dateTo) {
      where.verifiedAt = {};
      if (dateFrom) where.verifiedAt.gte = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); where.verifiedAt.lte = d; }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { stages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { verifiedAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.order.count({ where })
    ]);
    res.json({ orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Error fetching verification history:', error);
    res.status(500).json({ message: 'Failed to fetch verification history', error: error.message });
  }
};

const verifyOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { advanceAmountReceived, verificationNote } = req.body;
    const verifierName = req.user?.name || 'Unknown';
    const verifierId = req.user?.id;

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.goForVerification) return res.status(400).json({ message: 'Order was not sent for verification' });
    if (order.verifiedAt) return res.status(400).json({ message: 'Order already verified' });

    const totalAmount = order.totalPrice || 0;
    const advanceReceived = parseFloat(advanceAmountReceived) || 0;
    const remainingBalance = Math.max(0, totalAmount - advanceReceived);

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          verifiedAt: new Date(),
          verifiedBy: verifierId || null,
          verifiedByName: verifierName,
          verifiedAdvanceAmount: advanceReceived,
          verifiedRemainingBalance: remainingBalance,
          verificationNote: verificationNote || null,
          advanceAmount: advanceReceived,
          advancePaid: advanceReceived > 0
        }
      });

      const orderEntryStage = order.stages.find(s => s.stageName === 'ORDER_ENTRY' && s.status !== 'COMPLETED');
      if (orderEntryStage) {
        await tx.orderStage.update({
          where: { id: orderEntryStage.id },
          data: { status: 'COMPLETED', completedAt: new Date() }
        });
      }

      await tx.orderStage.create({
        data: { orderId, stageName: 'STORE', status: 'PENDING' }
      });

      await tx.order.update({
        where: { id: orderId },
        data: { currentStage: 'STORE', status: 'PENDING' }
      });

      // Clear seenTask for STORE so it appears as fresh
      const storeRecipients = await prisma.user.findMany({
        where: { role: { in: getRolesForStage('STORE') } },
        select: { id: true }
      });
      await tx.seenTask.deleteMany({
        where: { userId: { in: storeRecipients.map(u => u.id) }, orderId, stageName: 'STORE' }
      }).catch(() => {});

      await tx.routingHistory.create({
        data: {
          orderId,
          sentByUserId: verifierId || null,
          previousStage: 'ORDER_ENTRY',
          newStage: 'STORE',
          sentToStage: 'STORE',
          remarks: `Verified by ${verifierName}. Advance: PKR ${advanceReceived.toLocaleString()}, Remaining: PKR ${remainingBalance.toLocaleString()}`
        }
      });

      try {
        if (verifierId) {
          await tx.auditLog.create({
            data: {
              orderId,
              action: 'ORDER_VERIFIED',
              details: `Verified by ${verifierName}. Advance: PKR ${advanceReceived.toLocaleString()}, Remaining: PKR ${remainingBalance.toLocaleString()}`,
              performedBy: verifierId
            }
          });
        }
      } catch (auditErr) {
        console.error('Audit log failed (non-critical):', auditErr.message);
      }
    });

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    try {
      const io = req.app.get('io');
      if (io) io.emit('order-verified', updated);
      await notify.create(req, { type: 'store_task', moduleName: 'My Tasks', path: '/tasks', role: 'STORE', title: 'New Order Arrived', message: `Order #${order.orderNumber} requires Store action`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Verified → Store', employeeName: req.user?.name });
    } catch (e) { /* socket emit is non-critical */ }

    res.json(updated);
  } catch (error) {
    console.error('Error verifying order:', error);
    res.status(500).json({ message: 'Failed to verify order', error: error.message });
  }
};

const markPendingVerification = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { verificationNote } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.goForVerification) return res.status(400).json({ message: 'Order was not sent for verification' });
    if (order.verifiedAt) return res.status(400).json({ message: 'Order already verified' });

    try {
      if (req.user?.id) {
        await prisma.auditLog.create({
          data: {
            orderId,
            action: 'VERIFICATION_PENDING',
            details: verificationNote || 'Marked as pending verification',
            performedBy: req.user.id
          }
        });
      }
    } catch (e) { console.error('Audit log failed:', e.message); }

    res.json({ message: 'Order marked as pending verification' });
  } catch (error) {
    console.error('Error marking pending:', error);
    res.status(500).json({ message: 'Failed to mark pending', error: error.message });
  }
};

// NEW: Return order to Faisal for corrections
const returnToFaisal = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { returnNote, advanceAmountReceived } = req.body;
    const verifierName = req.user?.name || 'Unknown';

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.goForVerification) return res.status(400).json({ message: 'Order was not sent for verification' });
    if (order.verifiedAt) return res.status(400).json({ message: 'Order already verified, cannot return' });
    if (order.verificationReturnedAt) return res.status(400).json({ message: 'Order already returned to Faisal' });

    const advanceReceived = parseFloat(advanceAmountReceived) || 0;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        verificationReturnedAt: new Date(),
        verificationReturnNote: returnNote || 'Changes requested during verification',
        advanceAmount: advanceReceived,
        advancePaid: advanceReceived > 0
      }
    });

    await prisma.auditLog.create({
      data: {
        orderId,
        action: 'RETURNED_FOR_CORRECTION',
        details: `Returned to Faisal by ${verifierName} for corrections. Advance: PKR ${advanceReceived.toLocaleString()}. Note: ${returnNote || 'N/A'}`,
        performedBy: req.user?.id || 'system'
      }
    }).catch(e => console.error('Audit log failed:', e.message));

    try {
      const io = req.app.get('io');
      if (io) io.emit('order-updated', { orderId });
      await notify.create(req, { type: 'return_from_verification', moduleName: 'Return from Verification', path: '/returned-from-verification', role: 'FAISAL', title: 'Order Returned from Verification', message: `Order #${order.orderNumber} needs changes`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Changes Required', employeeName: req.user?.name });
    } catch (e) {}

    res.json({ message: 'Order returned to Faisal for corrections' });
  } catch (error) {
    console.error('Error returning to Faisal:', error);
    res.status(500).json({ message: 'Failed to return order to Faisal', error: error.message });
  }
};

// NEW: Get orders returned to Faisal (for FAISAL role)
const getReturnedToFaisal = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const where = { goForVerification: true, verifiedAt: null, verificationReturnedAt: { not: null } };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { stages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { verificationReturnedAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.order.count({ where })
    ]);
    res.json({ orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Error fetching returned orders:', error);
    res.status(500).json({ message: 'Failed to fetch returned orders', error: error.message });
  }
};

// NEW: Faisal resubmits a corrected order directly to Store (bypassing verification)
const resubmitFromVerification = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;
    const userName = req.user?.name || 'Faisal';

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.goForVerification) return res.status(400).json({ message: 'Order was not sent for verification' });
    if (order.verifiedAt) return res.status(400).json({ message: 'Order already verified' });
    if (!order.verificationReturnedAt) return res.status(400).json({ message: 'Order was not returned for correction' });

    // Build update payload from submitted data
    const payload = {};
    const updatableFields = [
      'productDetails', 'quantity', 'totalPrice', 'customization', 'sizeData',
      'customerName', 'customerPhone', 'address', 'city', 'type', 'priority',
      'advancePaid', 'advanceAmount', 'paymentStatus',
      'logoDesign', 'logoName',
      'logoCharges', 'namePrintingCharges', 'customizationPrice',
      'deliveryCharges', 'deliveryType', 'instructionNotes',
      'engravingInstructions', 'engravingRequired',
      'shopifyOrderDate'
    ];
    updatableFields.forEach(f => {
      if (updateData[f] !== undefined) payload[f] = updateData[f];
    });

    // If items array is provided, format it into productDetails
    if (updateData.items && Array.isArray(updateData.items)) {
      const items = updateData.items.map(item => ({
        productDetails: item.productDetails,
        customization: item.customization,
        sizeData: item.sizeData,
        quantity: item.quantity || 1,
        totalPrice: item.totalPrice || 0,
        logoName: item.logoName || '',
        logoDesign: item.logoDesign || '',
        logoCharges: parseFloat(item.logoCharges) || 0,
        namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
        customizationPrice: parseFloat(item.customizationPrice) || 0,
        capCharges: parseInt(item.capCharges) || 0
      }));
      payload.productDetails = items;
      payload.quantity = items.reduce((s, i) => s + (i.quantity || 1), 0);
    }

    // Clear the verification return flag so it won't show in returned list
    payload.verificationReturnedAt = null;
    payload.verificationReturnNote = null;

    await prisma.$transaction(async (tx) => {
      // 1. Update order data
      await tx.order.update({ where: { id: orderId }, data: payload });

      // 2. Mark any existing ORDER_ENTRY or pending stage as COMPLETED
      await tx.orderStage.updateMany({
        where: { orderId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });

      // 3. Create STORE stage
      await tx.orderStage.create({
        data: { orderId, stageName: 'STORE', status: 'PENDING' }
      });

      // 4. Update order to STORE with PENDING status
      await tx.order.update({
        where: { id: orderId },
        data: { currentStage: 'STORE', status: 'PENDING' }
      });

      // 5. Clear seenTask for STORE
      const storeRecipients = await prisma.user.findMany({
        where: { role: { in: getRolesForStage('STORE') } },
        select: { id: true }
      });
      await tx.seenTask.deleteMany({
        where: { userId: { in: storeRecipients.map(u => u.id) }, orderId, stageName: 'STORE' }
      }).catch(() => {});

      // 6. Routing history
      await tx.routingHistory.create({
        data: {
          orderId,
          sentByUserId: req.user?.id || null,
          previousStage: 'ORDER_ENTRY',
          newStage: 'STORE',
          sentToStage: 'STORE',
          remarks: `Resubmitted after correction by ${userName}. Bypassed verification.`
        }
      });

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          orderId,
          action: 'RESUBMITTED_AFTER_VERIFICATION',
          details: `Order corrected and resubmitted by ${userName} directly to Store (bypassed verification)`,
          performedBy: req.user?.id || 'system'
        }
      }).catch(() => {});
    });

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    try {
      const io = req.app.get('io');
      if (io) io.emit('order-updated', { orderId });
      await notify.create(req, { type: 'store_task', moduleName: 'My Tasks', path: '/tasks', role: 'STORE', title: 'Order Re-submitted', message: `Order #${order.orderNumber} re-submitted after verification`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Re-submitted → Store', employeeName: req.user?.name });
    } catch (e) {}

    res.json({ message: 'Order resubmitted to Store', order: updated });
  } catch (error) {
    console.error('Error resubmitting order:', error);
    res.status(500).json({ message: 'Failed to resubmit order', error: error.message });
  }
};

module.exports = { getPendingVerifications, getVerificationHistory, verifyOrder, markPendingVerification, returnToFaisal, getReturnedToFaisal, resubmitFromVerification };
