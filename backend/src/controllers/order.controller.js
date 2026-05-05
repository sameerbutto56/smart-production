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
  
  // Default values
  return {
    'STORE': 2,
    'CUTTING': 24,
    'STITCHING': 96,
    'QA': 2,
    'PRESSING_PACKING': 2,
    'NAME_LOGO': 2,
    'CUSTOM_LOGO': 2,
    'DISPATCH': 2,
    'FAISAL_APPROVAL': 2
  };
};

const NEXT_STAGES = {
  'STANDARD': ['STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH'],
  'READY_LOGO': ['STORE', 'NAME_LOGO', 'DISPATCH'],
  'FULL_CUSTOM': ['STORE', 'CUTTING', 'STITCHING', 'QA', 'CUSTOM_LOGO', 'DISPATCH']
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

    const io = req.app.get('io');
    io.emit('new-order', order);

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        stages: {
          orderBy: { createdAt: 'desc' }
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

  try {
    const durations = await getStageDurations();
    const approvalDuration = durations['FAISAL_APPROVAL'] || 2; // Default 2 hours
    const deadline = calculateDeadline(new Date(), approvalDuration);

    const stage = await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        requestNextStep: true,
        status: 'WAITING_APPROVAL',
        assignedEmployeeId: req.user.id,
        deadlineAt: deadline // Faisal's deadline to approve
      }
    });

    const io = req.app.get('io');
    io.emit('stage-completion-requested', { orderId, stage });

    res.json({ message: 'Completion requested from Faisal', stage });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting completion', error: error.message });
  }
};

const approveStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { nextStage, skipStages } = req.body; // Faisal can choose to skip stages (e.g. Store -> Dispatch)

  try {
    const currentStageRecord = await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    
    let actualNextStage = nextStage;
    if (!actualNextStage) {
      const stages = NEXT_STAGES[order.type];
      const currentIndex = stages.indexOf(currentStageRecord.stageName);
      actualNextStage = stages[currentIndex + 1];
    }

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
      // Final completion
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          currentStage: 'COMPLETED',
          status: 'COMPLETED'
        }
      });
    }

    const io = req.app.get('io');
    io.emit('order-updated', { orderId });

    res.json({ message: 'Stage approved and moved forward' });
  } catch (error) {
    res.status(500).json({ message: 'Error approving stage', error: error.message });
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
    io.emit('order-updated', { orderId });

    res.json({ message: 'Payment status updated', order });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment', error: error.message });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { stages: true }
    });

    const analytics = {
      totalOrders: orders.length,
      completedOrders: orders.filter(o => o.status === 'COMPLETED').length,
      inProgressOrders: orders.filter(o => o.status === 'IN_PROGRESS').length,
      urgentOrders: orders.filter(o => o.urgent).length,
      stagePerformance: {}
    };

    // Calculate average time per stage
    const stageStats = {};
    orders.forEach(order => {
      order.stages.forEach(stage => {
        if (stage.status === 'COMPLETED' && stage.completedAt) {
          if (!stageStats[stage.stageName]) {
            stageStats[stage.stageName] = { totalTime: 0, count: 0 };
          }
          const duration = new Date(stage.completedAt) - new Date(stage.createdAt);
          stageStats[stage.stageName].totalTime += duration;
          stageStats[stage.stageName].count += 1;
        }
      });
    });

    for (const [stage, stats] of Object.entries(stageStats)) {
      analytics.stagePerformance[stage] = {
        avgHours: (stats.totalTime / stats.count / (1000 * 60 * 60)).toFixed(1),
        count: stats.count
      };
    }

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

module.exports = { 
  createOrder, 
  getOrders, 
  requestStageCompletion, 
  approveStageCompletion, 
  rejectStageCompletion,
  updatePaymentStatus,
  getAnalytics
};
