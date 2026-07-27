const prisma = require('../prisma');

const getPendingVerifications = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const where = { goForVerification: true, verifiedAt: null };
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
      // 1. Update order with verification details + advance
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

      // 2. Complete the ORDER_ENTRY stage (it was already COMPLETED by createOrder, but just in case)
      const orderEntryStage = order.stages.find(s => s.stageName === 'ORDER_ENTRY' && s.status !== 'COMPLETED');
      if (orderEntryStage) {
        await tx.orderStage.update({
          where: { id: orderEntryStage.id },
          data: { status: 'COMPLETED', completedAt: new Date() }
        });
      }

      // 3. Create STORE stage as PENDING
      await tx.orderStage.create({
        data: { orderId, stageName: 'STORE', status: 'PENDING' }
      });

      // 4. Update currentStage to STORE
      await tx.order.update({
        where: { id: orderId },
        data: { currentStage: 'STORE', status: 'IN_PROGRESS' }
      });

      // 5. Create routing history
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

      // 6. Audit log (wrapped in try-catch to not fail the transaction)
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

module.exports = { getPendingVerifications, getVerificationHistory, verifyOrder, markPendingVerification };
