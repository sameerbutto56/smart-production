const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateDeadline } = require('../utils/deadline');

const getStageDurations = async () => {
  const settings = await prisma.systemSetting.findUnique({
    where: { key: 'STAGE_DURATIONS' }
  });
  
  if (settings) {
    try {
      return JSON.parse(settings.value);
    } catch (e) {
      console.error('Error parsing durations setting:', e);
    }
  }
  
  return {
    'STORE': 2,
    'CUTTING': 24,
    'STITCHING': 96,
    'QA': 2,
    'PRESSING_PACKING': 2,
    'LOGO_DESIGN': 2,
    'DISPATCH': 2,
    'FAISAL_APPROVAL': 2
  };
};

const createAuditLog = async (orderId, action, details, userId) => {
  try {
    // If no userId, we can't create the log because it's required in schema
    // In production, everything should be authenticated, but we'll fallback to a known ID if possible
    if (!userId) {
      console.warn('Audit Log: No userId provided for action:', action);
      return; 
    }

    await prisma.auditLog.create({
      data: {
        orderId,
        action,
        details,
        performedBy: userId,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};



const createOrder = async (req, res) => {
  const { orderNumber, customerName, type, urgent, logoDesign, logoName, customization, productDetails, sizeData, advancePaid, shopifyOrderId, paymentDeadline } = req.body;

  try {
    // Check if advance payment is required for FULL_CUSTOM
    const initialStatus = (type === 'FULL_CUSTOM' && !advancePaid) ? 'WAITING_PAYMENT' : 'PENDING';

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName,
        type: type || 'STANDARD',
        urgent: urgent || false,
        logoDesign,
        logoName,
        customization: customization ? JSON.stringify(customization) : null,
        productDetails: productDetails ? JSON.stringify(productDetails) : null,
        sizeData: sizeData ? JSON.stringify(sizeData) : null,
        advancePaid: advancePaid || false,
        totalPrice: parseFloat(req.body.totalPrice) || 0,
        shopifyOrderId,
        paymentDeadline: paymentDeadline ? new Date(paymentDeadline) : (type === 'READY_LOGO' ? new Date(Date.now() + 48 * 60 * 60 * 1000) : null),
        currentStage: 'ORDER_ENTRY',
        status: initialStatus
      }
    });

    // Initial stage is Faisal's review after Order Entry
    await prisma.orderStage.create({
      data: {
        orderId: order.id,
        stageName: 'ORDER_ENTRY',
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    await createAuditLog(order.id, 'ORDER_CREATED', `Order initiated with status: ${initialStatus}`, req.user?.id);

    const io = req.app.get('io');
    io.emit('new-order', order);

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    let message = 'Error creating order';
    if (error.code === 'P2002') {
      message = 'Order ID already exists. Please use a unique ID.';
    }
    res.status(500).json({ message, error: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        stages: {
          orderBy: { createdAt: 'desc' }
        },
        auditLogs: {
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

const requestStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { inventoryStatus } = req.body;

  try {
    const currentStage = await prisma.orderStage.findUnique({ where: { id: stageId } });
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    // If it's an auto-transition stage, move it immediately
    if (AUTO_TRANSITION_STAGES.includes(currentStage.stageName)) {
      await prisma.orderStage.update({
        where: { id: stageId },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });

      const stages = NEXT_STAGES[order.type] || NEXT_STAGES['STANDARD'];
      const currentIndex = stages.indexOf(currentStage.stageName);
      const actualNextStage = stages[currentIndex + 1];

      if (actualNextStage) {
        const durations = await getStageDurations();
        const deadline = calculateDeadline(new Date(), durations[actualNextStage] || 2);

        await prisma.orderStage.create({
          data: {
            orderId,
            stageName: actualNextStage,
            status: 'PENDING',
            deadlineAt: deadline
          }
        });

        await prisma.order.update({
          where: { id: orderId },
          data: { currentStage: actualNextStage }
        });

        await createAuditLog(orderId, 'STAGE_AUTO_TRANSITION', `${currentStage.stageName} completed by worker. Auto-moved to ${actualNextStage}`, req.user.id);
      }
      
      const io = req.app.get('io');
      io.emit('order-updated', { orderId });
      return res.json({ message: 'Auto-moved to next stage', nextStage: actualNextStage });
    }

    // Otherwise, go to Faisal for approval (Hub Pattern)
    const durations = await getStageDurations();
    const approvalDuration = durations['FAISAL_APPROVAL'] || 2; 
    const deadline = calculateDeadline(new Date(), approvalDuration);

    const stage = await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        requestNextStep: true,
        status: 'WAITING_APPROVAL',
        assignedEmployeeId: req.user.id,
        deadlineAt: deadline,
        ...(inventoryStatus && { rejectionReason: `Inventory Check: ${inventoryStatus}` })
      }
    });

    const io = req.app.get('io');
    io.emit('stage-completion-requested', { orderId, stage });
    io.emit('order-updated', { orderId });

    await createAuditLog(orderId, 'STAGE_COMPLETION_REQUESTED', `Completion requested for ${stage.stageName}. Waiting for Faisal.`, req.user.id);

    res.json({ message: 'Completion requested from Faisal', stage });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting completion', error: error.message });
  }
};

const NEXT_STAGES = {
  'STANDARD': ['STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
  'READY_LOGO': ['STORE', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY'],
  'FULL_CUSTOM': ['STORE', 'CUTTING', 'STITCHING', 'QA', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY']
};

// Stages that move automatically to the next one without Faisal's intermediate approval
const AUTO_TRANSITION_STAGES = ['CUTTING', 'STITCHING', 'QA'];

const approveStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { nextStage, customizationPrice } = req.body; 

  try {
    const currentStageRecord = await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    
    // Update Customization Price if provided
    if (customizationPrice && parseFloat(customizationPrice) > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          customizationPrice: (order.customizationPrice || 0) + parseFloat(customizationPrice)
        }
      });
    }

    // --- INVENTORY DEDUCTION ---
    if (currentStageRecord.stageName === 'STORE') {
      const product = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
      if (product?.productType) {
        const inventoryItem = await prisma.inventoryItem.findFirst({
          where: { 
            name: { contains: product.productType, mode: 'insensitive' },
            category: { not: 'FABRIC' }
          }
        });

        if (inventoryItem && inventoryItem.stock > 0) {
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { stock: { decrement: 1 } }
          });
          await createAuditLog(orderId, 'INVENTORY_DEDUCTED', `Deducted 1 unit of ${inventoryItem.name} from stock.`, req.user.id);
        }
      }
    }

    let actualNextStage = null;

    // HUB-AND-SPOKE LOGIC
    // 1. If the stage is one that auto-transitions, move to the next in sequence
    if (AUTO_TRANSITION_STAGES.includes(currentStageRecord.stageName)) {
      const stages = NEXT_STAGES[order.type] || NEXT_STAGES['STANDARD'];
      const currentIndex = stages.indexOf(currentStageRecord.stageName);
      actualNextStage = stages[currentIndex + 1];
    } 
    // 2. If Faisal explicitly specified a next stage in the approval dialog
    else if (nextStage) {
      actualNextStage = nextStage;
    }
    // 3. Otherwise, it defaults to Faisal's control (the hub)
    // In this case, actualNextStage remains null, and the order stays in Faisal's list 
    // waiting for him to "Initiate" the next stage.

    if (actualNextStage) {
      const durations = await getStageDurations();
      const duration = durations[actualNextStage] || 2;
      const deadline = calculateDeadline(new Date(), duration);

      await prisma.orderStage.create({
        data: {
          orderId,
          stageName: actualNextStage,
          status: 'PENDING',
          deadlineAt: deadline
        }
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { 
          currentStage: actualNextStage,
          status: 'IN_PROGRESS'
        }
      });
    } else {
      // It returns to Faisal or is finished
      if (currentStageRecord.stageName === 'DISPATCH') {
        await prisma.order.update({
          where: { id: orderId },
          data: { 
            currentStage: 'COMPLETED',
            status: 'COMPLETED'
          }
        });
      } else {
        // Returned to Faisal (WAITING_APPROVAL/HUB state)
        await prisma.order.update({
          where: { id: orderId },
          data: { 
            status: 'WAITING_APPROVAL' // Or a special HUB status
          }
        });
      }
    }

    await createAuditLog(orderId, 'STAGE_APPROVED', `${currentStageRecord.stageName} approved. ${actualNextStage ? `Sent to: ${actualNextStage}` : 'Returned to Faisal Control Center'}${customizationPrice ? ` | Added Cost: $${customizationPrice}` : ''}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId });

    res.json({ message: 'Stage processed successfully', nextStage: actualNextStage });
  } catch (error) {
    res.status(500).json({ message: 'Error processing stage transition', error: error.message });
  }
};

const rejectStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { reason } = req.body;

  try {
    const stage = await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        status: 'REJECTED',
        requestNextStep: false,
        rejectionReason: reason
      }
    });

    const io = req.app.get('io');
    io.emit('stage-rejected', { orderId, stage, reason });
    io.emit('order-updated', { orderId }); // Ensure general update is also sent

    await createAuditLog(orderId, 'STAGE_REJECTED', `${stage.stageName} rejected by Faisal. Reason: ${reason}`, req.user.id);

    res.json({ message: 'Stage rejected and sent back to employee', stage });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting stage', error: error.message });
  }
};

const updatePaymentStatus = async (req, res) => {
  const { orderId } = req.params;
  const { paymentStatus } = req.body;

  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { 
        paymentStatus,
        advancePaid: paymentStatus === 'ADVANCE_PAID' || paymentStatus === 'FULL_PAID'
      }
    });

    // If it was waiting for payment and now advance is paid, move to first module (STORE)
    if (order.status === 'WAITING_PAYMENT' && order.advancePaid) {
      const durations = await getStageDurations();
      const deadline = calculateDeadline(new Date(), durations['STORE']);
      await prisma.orderStage.create({
        data: {
          orderId,
          stageName: 'STORE',
          status: 'PENDING',
          deadlineAt: deadline
        }
      });
      
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'IN_PROGRESS',
          currentStage: 'STORE'
        }
      });
    }

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, paymentStatus: order.paymentStatus });
    io.emit('payment-updated', { orderId, order });

    await createAuditLog(orderId, 'PAYMENT_UPDATED', `Payment status changed to: ${paymentStatus}`, req.user.id);

    res.json({ message: 'Payment status updated', order });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment', error: error.message });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, completedOrders, inProgressOrders, urgentOrders, todayRevenueData] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.order.count({ where: { urgent: true } }),
      prisma.order.aggregate({
        where: {
          updatedAt: { gte: today }
        },
        _sum: {
          totalPrice: true
        }
      })
    ]);

    const todayRevenue = todayRevenueData._sum.totalPrice || 0;

    // For stage performance, we still need completed stages, but we can filter specifically
    const completedStages = await prisma.orderStage.findMany({
      where: { 
        status: 'COMPLETED',
        completedAt: { not: null }
      },
      select: {
        stageName: true,
        createdAt: true,
        completedAt: true
      }
    });

    const stageStats = {};
    completedStages.forEach(stage => {
      if (!stageStats[stage.stageName]) {
        stageStats[stage.stageName] = { totalTime: 0, count: 0 };
      }
      const duration = new Date(stage.completedAt) - new Date(stage.createdAt);
      stageStats[stage.stageName].totalTime += duration;
      stageStats[stage.stageName].count += 1;
    });

    const stagePerformance = {};
    for (const [stage, stats] of Object.entries(stageStats)) {
      stagePerformance[stage] = {
        avgHours: (stats.totalTime / stats.count / (1000 * 60 * 60)).toFixed(1),
        count: stats.count
      };
    }

    res.json({
      totalOrders,
      completedOrders,
      inProgressOrders,
      urgentOrders,
      todayRevenue,
      stagePerformance
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

const clearHistory = async (req, res) => {
  try {
    const completedOrders = await prisma.order.findMany({
      where: { status: { in: ['COMPLETED', 'DELIVERED'] } }
    });
    const orderIds = completedOrders.map(o => o.id);
    
    if (orderIds.length > 0) {
      await prisma.orderStage.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.auditLog.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    res.json({ message: 'History cleared successfully', count: orderIds.length });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ message: 'Error clearing history', error: error.message });
  }
};

module.exports = { 
  createOrder, 
  getOrders, 
  requestStageCompletion, 
  approveStageCompletion, 
  rejectStageCompletion,
  updatePaymentStatus,
  getAnalytics,
  clearHistory
};
