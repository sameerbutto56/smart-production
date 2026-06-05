const prisma = require('../prisma');
const { calculateDeadline } = require('../utils/deadline');

const isSystemPaused = async () => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_PAUSED' } });
    return setting ? setting.value === 'true' : false;
  } catch { return false; }
};

const PRIORITY_ORDER = { 'SUPER_URGENT': 0, 'URGENT': 1, 'NORMAL': 2 };
const sortByPriority = (orders) => {
  return [...orders].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
};

const NEXT_STAGES = {
  'STANDARD': ['STORE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY'],
  'READY_LOGO': ['STORE', 'LOGO_DESIGN', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY'],
  'FULL_CUSTOM': ['STORE', 'LOGO_DESIGN', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY']
};
 
const AUTO_TRANSITION_STAGES = ['STORE', 'LOGO_DESIGN', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY'];

const getStageDurations = async (priority = 'NORMAL') => {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'DEADLINE_CONFIG' }
  });

  let config = {
    stageDurations: { STORE: 24, PRODUCTION: 48, LOGO_DESIGN: 24, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
    slaMultipliers: { NORMAL: 1, URGENT: 0.75, SUPER_URGENT: 0.5 }
  };

  if (setting) {
    try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) { console.error('Error parsing DEADLINE_CONFIG:', e); }
  }

  const slaMultiplier = config.slaMultipliers?.[priority] ?? 1;
  const durations = config.stageDurations || {};

  const adjusted = {};
  for (const [stage, hours] of Object.entries(durations)) {
    adjusted[stage] = Math.round((hours * slaMultiplier) * 100) / 100;
  }
  return adjusted;
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

const setProductionDeadline = async (orderId, deadlineDate, action, userId) => {
  await prisma.order.update({
    where: { id: orderId },
    data: { productionDeadline: deadlineDate }
  });
  await createAuditLog(orderId, action || 'PRODUCTION_DEADLINE_SET', `Production deadline set to ${deadlineDate.toISOString()}`, userId);
};

const checkAndSetProductionDeadline = async (orderId, newStageName, deadlineAt, userId) => {
  if (newStageName === 'PRODUCTION' && deadlineAt) {
    await setProductionDeadline(orderId, deadlineAt, 'PRODUCTION_STARTED', userId);
  }
};




const createOrder = async (req, res) => {
  const { orderNumber: requestedOrderNumber, customerName, customerPhone, address, city, type, urgent, priority, quantity, logoDesign, logoName, customization, productDetails, sizeData, advancePaid, shopifyOrderId, paymentDeadline, productImage, items } = req.body;

  // Derive priority and urgent
  const finalPriority = priority || (urgent ? 'URGENT' : 'NORMAL');
  const finalUrgent = finalPriority !== 'NORMAL';

  if (!customerPhone) {
    return res.status(400).json({ error: 'Customer phone number is required' });
  }

  try {
    if (await isSystemPaused()) {
      return res.status(503).json({ error: 'System is paused for holidays. Order creation is disabled.' });
    }
    let orderNumber = requestedOrderNumber;

    // Handle Order Number Generation for Outlets or if missing
    if (!orderNumber || req.user?.role === 'OUTLET') {
      const prefix = req.user?.role === 'OUTLET' ? 'OUT-' : 'ORD-';
      // Generate a unique random number
      let isUnique = false;
      while (!isUnique) {
        const randomNum = Math.floor(100000 + Math.random() * 900000); // 6 digit random
        orderNumber = `${prefix}${randomNum}`;
        const existing = await prisma.order.findUnique({ where: { orderNumber } });
        if (!existing) isUnique = true;
      }
    } else {
      // Check if manual order number is already taken
      const existing = await prisma.order.findUnique({ where: { orderNumber } });
      if (existing) {
        const io = req.app.get('io');
        if (io) {
          io.emit('global-alert', {
            title: 'Duplicate Order Attempt',
            message: `${req.user?.name || 'User'} attempted to use existing Order Number #${orderNumber}. System blocked the entry.`,
            type: 'SECURITY_ALERT'
          });
        }
        return res.status(400).json({ message: `Order Number ${orderNumber} is already in use. Please use a unique number.` });
      }
    }

    // Check if advance payment is required for FULL_CUSTOM
    const initialStatus = (type === 'FULL_CUSTOM' && !advancePaid) ? 'WAITING_PAYMENT' : 'PENDING';

    // If items array is provided (multi-item cart), store all items in productDetails
    let finalProductDetails = productDetails;
    let finalCustomization = customization;
    let finalSizeData = sizeData;

    if (items && Array.isArray(items) && items.length > 0) {
      // Store all items as an array in productDetails for multi-item orders
      finalProductDetails = items.map(item => ({
        productDetails: item.productDetails,
        customization: item.customization,
        sizeData: item.sizeData,
        quantity: item.quantity || 1,
        totalPrice: item.totalPrice || 0
      }));
      // Keep the first item's customization & sizeData as the primary for backward compat
      finalCustomization = items[0].customization || customization;
      finalSizeData = items[0].sizeData || sizeData;
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName,
        customerPhone,
        address,
        city,
        createdById: req.user?.id,
        source: req.user?.role === 'OUTLET' ? 'OUTLET' : 'INTERNAL',
        outletName: (() => {
          if (req.user?.role === 'FAISAL') return 'ONLINE ORDER';
          if (req.user?.role === 'OUTLET') {
            const name = req.user?.name || '';
            if (name.includes('1') || name.toLowerCase().includes('johar')) return 'JOHAR TOWN BRANCH';
            if (name.includes('2') || name.toLowerCase().includes('jail')) return 'JAIL ROAD BRANCH';
            if (name.includes('3') || name.toLowerCase().includes('abbottabad')) return 'ABBOTTABAD BRANCH';
            return name || 'OUTLET';
          }
          return req.user?.name || 'ADMIN HUB';
        })(),
        type: type || 'STANDARD',
        urgent: finalUrgent,
        priority: finalPriority,
        quantity: parseInt(quantity) || 1,
        logoDesign,
        logoName,
        customization: finalCustomization ? JSON.stringify(finalCustomization) : null,
        productDetails: finalProductDetails ? JSON.stringify(finalProductDetails) : null,
        sizeData: finalSizeData ? JSON.stringify(finalSizeData) : null,
        advancePaid: advancePaid || false,
        productImage,
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
 
    // Automatically start the first stage for STANDARD and READY_LOGO orders
    if (type !== 'FULL_CUSTOM' || (type === 'FULL_CUSTOM' && advancePaid)) {
      const stages = NEXT_STAGES[type || 'STANDARD'] || NEXT_STAGES['STANDARD'];
      const firstStage = stages[0]; // Usually 'STORE'
      
      if (firstStage) {
        const durations = await getStageDurations(order.priority);
        const deadline = calculateDeadline(new Date(), durations[firstStage] || 24);
        
        await prisma.orderStage.create({
          data: {
            orderId: order.id,
            stageName: firstStage,
            status: 'PENDING',
            deadlineAt: deadline
          }
        });
        
        await prisma.order.update({
          where: { id: order.id },
          data: { 
            currentStage: firstStage,
            status: 'IN_PROGRESS'
          }
        });
      }
    }

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
    // Escalation check: auto-log overdue priority stages
    try {
      const overduePriorityStages = await prisma.orderStage.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'] },
          deadlineAt: { lt: new Date() },
          order: { priority: { in: ['URGENT', 'SUPER_URGENT'] } }
        },
        include: { order: { select: { id: true, orderNumber: true, priority: true } } },
        take: 10
      });
      for (const stage of overduePriorityStages) {
        const existingEscalation = await prisma.auditLog.findFirst({
          where: { orderId: stage.orderId, action: 'ESCALATION_OVERDUE', details: { contains: stage.stageName } },
          orderBy: { timestamp: 'desc' }
        });
        if (!existingEscalation || (Date.now() - existingEscalation.timestamp.getTime()) > 3600000) {
          await prisma.auditLog.create({
            data: {
              orderId: stage.orderId,
              action: 'ESCALATION_OVERDUE',
              details: `CRITICAL: ${stage.order.priority} order #${stage.order.orderNumber} - Stage ${stage.stageName} exceeded deadline on ${stage.deadlineAt.toISOString()}`,
              performedBy: req.user?.id || 'SYSTEM'
            }
          }).catch(() => {});
        }
      }
    } catch (e) { /* non-blocking */ }

    const role = String(req.user.role || '').toUpperCase().trim();
    const id = req.user.id;
    const { status: filterStatus, limit } = req.query;

    let where = {};

    // 1. Role boundary isolation
    if (role === 'OUTLET' || role === 'FAISAL') {
      where.createdById = id;
    }

    // 2. Add database-level filters based on page context
    if (filterStatus === 'active') {
      // Return only active/in-progress/waiting orders
      where.status = { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] };
    } else if (filterStatus === 'completed') {
      // History Page: Return completed/delivered/cancelled/rejected orders
      where.OR = [
        { status: { in: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] } },
        { currentStage: { in: ['COMPLETED', 'DELIVERED'] } }
      ];
    } else if (filterStatus === 'delivery') {
      // Delivery Dashboard: Return orders scheduled or completed in delivery
      where.OR = [
        { currentStage: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] } },
        { status: { in: ['COMPLETED', 'OUT_FOR_DELIVERY'] } }
      ];
    } else {
      // Default: If no status specified, load active orders + the 100 most recent completed orders to keep payload tiny!
      // This is backward-compatible with older frontend code that filters in memory!
      if (!limit || limit !== 'all') {
        const activeOrders = await prisma.order.findMany({
          where: {
            ...where,
            status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
          },
          include: {
            stages: { orderBy: { createdAt: 'desc' } },
            auditLogs: { orderBy: { timestamp: 'desc' } },
            createdBy: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        });

        const completedOrders = await prisma.order.findMany({
          where: {
            ...where,
            status: { in: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
          },
          include: {
            stages: { orderBy: { createdAt: 'desc' } },
            auditLogs: { orderBy: { timestamp: 'desc' } },
            createdBy: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 100
        });

        return res.json(sortByPriority([...activeOrders, ...completedOrders]));
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        stages: {
          orderBy: { createdAt: 'desc' }
        },
        auditLogs: {
          orderBy: { timestamp: 'desc' }
        },
        createdBy: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit === 'all' ? undefined : (parseInt(limit) || 200)
    });
    
    res.json(sortByPriority(orders));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

const requestStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { inventoryStatus } = req.body;

  try {
    if (await isSystemPaused()) {
      return res.status(503).json({ message: 'System is paused for holidays. Stage completion is disabled.' });
    }
    const currentStage = await prisma.orderStage.findUnique({ where: { id: stageId } });
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    // Inventory deduction on Store confirmation
    if (currentStage.stageName === 'STORE' && (inventoryStatus === 'have_it' || inventoryStatus === 'Available')) {
      try {
        await deductInventory(order, req.user.id);
        await createAuditLog(orderId, 'INVENTORY_CONFIRMED', 'Store confirmed inventory available & allocated. Stock deducted.', req.user.id);
      } catch (invErr) {
        console.error('Inventory deduction error:', invErr);
      }
    }

    // Mark current stage as completed
    await prisma.orderStage.update({
      where: { id: stageId },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    // Auto-transition to next stage
    const stages = NEXT_STAGES[order.type] || NEXT_STAGES['STANDARD'];
    const currentIndex = stages.indexOf(currentStage.stageName);
    const actualNextStage = stages[currentIndex + 1];

    if (actualNextStage) {
      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations[actualNextStage] || 24);

      await prisma.orderStage.create({
        data: {
          orderId,
          stageName: actualNextStage,
          status: 'PENDING',
          deadlineAt: deadline
        }
      });
      await checkAndSetProductionDeadline(orderId, actualNextStage, deadline, req.user.id);

      await prisma.order.update({
        where: { id: orderId },
        data: { currentStage: actualNextStage }
      });

      await createAuditLog(orderId, 'STAGE_AUTO_TRANSITION', `${currentStage.stageName} completed. Auto-moved to ${actualNextStage}.`, req.user.id);
    } else if (currentStage.stageName === 'OUT_FOR_DELIVERY') {
      // FINAL STAGE COMPLETED
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          currentStage: 'COMPLETED',
          status: 'COMPLETED'
        }
      });
      await createAuditLog(orderId, 'ORDER_COMPLETED', `Order fully completed after final delivery stage.`, req.user.id);
    }
    
    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });
    return res.json({ message: 'Stage completed and auto-moved to next stage', nextStage: actualNextStage });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting completion', error: error.message });
  }
};

const approveStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { nextStage, customizationPrice, deliveryMethod, deliveryType } = req.body; 

  try {
    if (await isSystemPaused()) {
      return res.status(503).json({ message: 'System is paused for holidays. Approvals are disabled.' });
    }
    const currentStageRecord = await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    
    // Update Customization Price, Delivery Method and Delivery Type if provided
    const updateData = {};
    if (customizationPrice && parseFloat(customizationPrice) > 0) {
      updateData.customizationPrice = (order.customizationPrice || 0) + parseFloat(customizationPrice);
    }
    if (deliveryMethod) {
      updateData.deliveryMethod = deliveryMethod;
    }
    if (deliveryType) {
      updateData.deliveryType = deliveryType;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: updateData
      });
    }

    // Determine next stage
    let actualNextStage = nextStage;
    if (!actualNextStage) {
      const stages = NEXT_STAGES[order.type] || NEXT_STAGES['STANDARD'];
      const currentIndex = stages.indexOf(currentStageRecord.stageName);
      actualNextStage = stages[currentIndex + 1];
    }

    if (actualNextStage) {
      const durations = await getStageDurations(order.priority);
      const duration = durations[actualNextStage] || 24;
      const deadline = calculateDeadline(new Date(), duration);

      await prisma.orderStage.create({
        data: {
          orderId,
          stageName: actualNextStage,
          status: 'PENDING',
          deadlineAt: deadline
        }
      });
      await checkAndSetProductionDeadline(orderId, actualNextStage, deadline, req.user.id);

      await prisma.order.update({
        where: { id: orderId },
        data: { 
          currentStage: actualNextStage,
          status: 'IN_PROGRESS'
        }
      });

      const io = req.app.get('io');
      io.emit('global-alert', {
        title: 'Phase Advanced',
        message: `Order moved to ${actualNextStage.replace(/_/g, ' ')}.`,
        icon: 'package'
      });
    } else {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED', currentStage: 'COMPLETED' }
      });
    }

    await createAuditLog(orderId, 'STAGE_APPROVED', `${currentStageRecord.stageName} processed. ${actualNextStage ? `Sent to: ${actualNextStage}` : 'Order completed.'}${customizationPrice ? ` | Added Cost: $${customizationPrice}` : ''}${deliveryMethod ? ` | Delivery: ${deliveryMethod}` : ''}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order?.createdById });

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
      include: { order: true },
      data: {
        status: 'REJECTED',
        requestNextStep: false,
        rejectionReason: reason
      }
    });

    const io = req.app.get('io');
    io.emit('stage-rejected', { orderId, stage, reason });
    io.emit('order-updated', { orderId, createdById: stage.order?.createdById });

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
      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations['STORE'] || 24);
      await prisma.orderStage.create({
        data: {
          orderId,
          stageName: 'STORE',
          status: 'PENDING',
          deadlineAt: deadline
        }
      });
      
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'IN_PROGRESS',
          currentStage: 'STORE'
        }
      });
    }

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, paymentStatus: order.paymentStatus, createdById: order.createdById });
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

    const [totalOrders, completedOrders, inProgressOrders, urgentOrders, todayRevenueData, delayedOrders] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.order.count({ where: { priority: { in: ['URGENT', 'SUPER_URGENT'] } } }),
      prisma.order.aggregate({
        where: {
          updatedAt: { gte: today }
        },
        _sum: {
          totalPrice: true
        }
      }),
      prisma.orderStage.count({
        where: {
          status: { in: ['PENDING', 'STARTED'] },
          deadlineAt: { lt: new Date() }
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
      delayedOrders,
      stagePerformance
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

const clearHistory = async (req, res) => {
  try {
    const completedOrders = await prisma.order.findMany({
      where: { status: { in: ['COMPLETED', 'DELIVERED', 'REJECTED'] } }
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

const holdOrder = async (req, res) => {
  const { orderId } = req.params;
  const { reason, resume } = req.body; // if resume is true, it will move back to WAITING_APPROVAL

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const newStatus = resume ? 'WAITING_APPROVAL' : 'ON_HOLD';
    
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus }
    });

    // Update the active stage status
    await prisma.orderStage.updateMany({
      where: { 
        orderId, 
        status: { in: resume ? ['ON_HOLD'] : ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'] } 
      },
      data: { 
        status: resume ? 'WAITING_APPROVAL' : 'ON_HOLD',
        rejectionReason: resume ? `ORDER RESUMED: ${reason || 'Resumed by admin'}` : `ORDER PUT ON HOLD: ${reason}`
      }
    });

    const io = req.app.get('io');
    io.emit('order-updated', { order: updatedOrder, createdById: order.createdById });

    await createAuditLog(orderId, resume ? 'ORDER_RESUMED' : 'ORDER_ON_HOLD', reason || (resume ? 'Order resumed' : 'Order put on hold'), req.user.id);

    res.json({ message: resume ? 'Order resumed' : 'Order put on hold', order: updatedOrder });
  } catch (error) {
    res.status(500).json({ message: 'Error updating hold status', error: error.message });
  }
};

const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status: 'REJECTED',
        currentStage: 'CANCELLED'
      }
    });

    // Also mark current active stage as REJECTED
    await prisma.orderStage.updateMany({
      where: { orderId, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL', 'ON_HOLD'] } },
      data: { status: 'REJECTED', rejectionReason: `ORDER CANCELLED: ${reason}` }
    });

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order?.createdById });

    await createAuditLog(orderId, 'ORDER_CANCELLED', `Order permanently cancelled by Faisal. Reason: ${reason}`, req.user.id);

    res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling order', error: error.message });
  }
};

const deleteOrder = async (req, res) => {
  const { orderId } = req.params;
  try {
    // Delete related records first due to foreign key constraints
    await prisma.orderStage.deleteMany({ where: { orderId } });
    await prisma.auditLog.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, deleted: true });

    res.json({ message: 'Order deleted permanently' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Error deleting order', error: error.message });
  }
};

const updateDeliveryStatus = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryStatus, remarks, paymentMethod } = req.body; // deliveryStatus: 'DELIVERED' | 'NOT_RESPONDED'
  const userId = req.user?.id;

  try {
    if (await isSystemPaused()) {
      return res.status(503).json({ message: 'System is paused for holidays. Delivery updates are disabled.' });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: deliveryStatus === 'DELIVERED' ? 'COMPLETED' : order.status,
        currentStage: deliveryStatus === 'DELIVERED' ? 'DELIVERED' : order.currentStage,
        paymentStatus: deliveryStatus === 'DELIVERED' ? 'FULL_PAID' : order.paymentStatus,
        advancePaid: deliveryStatus === 'DELIVERED' ? true : order.advancePaid,
        paymentMethod: paymentMethod || (deliveryStatus === 'DELIVERED' ? 'CASH' : order.paymentMethod),
        updatedAt: new Date()
      },
      include: { stages: true }
    });

    await createAuditLog(
      orderId,
      deliveryStatus === 'DELIVERED' ? 'DELIVERED' : 'NOT_RESPONDED',
      remarks || (deliveryStatus === 'DELIVERED' ? 'Order delivered to customer' : 'Customer did not respond'),
      userId
    );

    const io = req.app.get('io');
    io.emit('order-updated', { order: updatedOrder, createdById: order.createdById });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Delivery status update error:', error);
    res.status(500).json({ message: 'Error updating delivery status', error: error.message });
  }
};

const deductInventory = async (order, userId) => {
  if (!order) return;
  let parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
  
  const productsToDeduct = [];
  if (Array.isArray(parsedDetails)) {
    parsedDetails.forEach(item => {
      const pd = item.productDetails || item;
      if (pd?.productType) {
        productsToDeduct.push({ productType: pd.productType, quantity: item.quantity || 1, color: pd.color, size: pd.size });
      }
    });
  } else if (parsedDetails?.productType) {
    productsToDeduct.push({ productType: parsedDetails.productType, quantity: order.quantity || 1, color: parsedDetails.color, size: parsedDetails.size });
  }

  for (const prod of productsToDeduct) {
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: { 
        name: { contains: prod.productType, mode: 'insensitive' },
        category: { not: 'FABRIC' }
      }
    });

    if (!inventoryItem || inventoryItem.stock <= 0) continue;

    const deductQty = Math.min(prod.quantity, inventoryItem.stock);

    // If item has variants, deduct from the matching variant
    if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
      let updatedVariants = [...inventoryItem.variants];
      let remaining = deductQty;

      if (prod.color || prod.size) {
        // Try to match by color and/or size
        const matchIdx = updatedVariants.findIndex(v =>
          (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
          (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase())) &&
          (v.stock || 0) > 0
        );
        if (matchIdx >= 0) {
          const deductFromVariant = Math.min(remaining, updatedVariants[matchIdx].stock || 0);
          updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: (updatedVariants[matchIdx].stock || 0) - deductFromVariant };
          remaining -= deductFromVariant;
        }
      }

      // If specific variant not found or remaining, spread across all variants
      if (remaining > 0) {
        for (let i = 0; i < updatedVariants.length && remaining > 0; i++) {
          if ((updatedVariants[i].stock || 0) > 0) {
            const deductFromVariant = Math.min(remaining, updatedVariants[i].stock);
            updatedVariants[i] = { ...updatedVariants[i], stock: (updatedVariants[i].stock || 0) - deductFromVariant };
            remaining -= deductFromVariant;
          }
        }
      }

      const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { variants: updatedVariants, stock: newTotalStock }
      });
    } else {
      // Legacy item without variants
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { stock: { decrement: deductQty } }
      });
    }
    await createAuditLog(order.id, 'INVENTORY_DEDUCTED', `Deducted ${deductQty} unit(s) of ${inventoryItem.name} from stock (order creation).`, userId);
  }
};

const sendForDelivery = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Complete the current active stage
    await prisma.orderStage.updateMany({
      where: { orderId, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'] } },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    const durations = await getStageDurations(order.priority);
    const deadline = calculateDeadline(new Date(), durations['OUT_FOR_DELIVERY'] || 24);

    // Create the OUT_FOR_DELIVERY stage
    await prisma.orderStage.create({
      data: {
        orderId,
        stageName: 'OUT_FOR_DELIVERY',
        status: 'PENDING',
        deadlineAt: deadline
      }
    });

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: 'OUT_FOR_DELIVERY', status: 'IN_PROGRESS' }
    });

    await createAuditLog(orderId, 'SENT_FOR_DELIVERY', 'Order sent for delivery', req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: 'Order sent for delivery', order: updatedOrder });
  } catch (error) {
    console.error('Send for delivery error:', error);
    res.status(500).json({ message: 'Error sending for delivery', error: error.message });
  }
};

const updateOrderPriority = async (req, res) => {
  const { orderId } = req.params;
  const { priority } = req.body;
  if (!['NORMAL', 'URGENT', 'SUPER_URGENT'].includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority. Must be NORMAL, URGENT, or SUPER_URGENT.' });
  }
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        priority,
        urgent: priority !== 'NORMAL'
      }
    });
    await createAuditLog(orderId, 'PRIORITY_UPDATED', `Priority changed to ${priority} by ${req.user.name}`, req.user.id);
    res.json({ message: `Priority updated to ${priority}`, order });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update priority', error: error.message });
  }
};

const setDeliveryType = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryType } = req.body;
  if (!['PICKUP', 'IN_CITY', 'COURIER'].includes(deliveryType)) {
    return res.status(400).json({ message: 'Invalid delivery type. Must be PICKUP, IN_CITY, or COURIER.' });
  }
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await prisma.order.update({
      where: { id: orderId },
      data: { deliveryType }
    });

    await createAuditLog(orderId, 'DELIVERY_TYPE_SET', `Delivery type set to ${deliveryType} by ${req.user.name}`, req.user.id);
    res.json({ message: `Delivery type set to ${deliveryType}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to set delivery type', error: error.message });
  }
};

const forceAction = async (req, res) => {
  const { orderId } = req.params;
  const { action, stageName, reason } = req.body;

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let response = {};

    switch (action) {
      case 'FORCE_MOVE': {
        // Force move to a specific stage
        if (!stageName) return res.status(400).json({ message: 'Target stage name required' });
        
        // Complete current stage
        const currentStage = order.stages.find(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS' || s.status === 'WAITING_APPROVAL');
        if (currentStage) {
          await prisma.orderStage.update({
            where: { id: currentStage.id },
            data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Force completed by ${req.user.name}: ${reason || 'No reason'}` }
          });
        }

        // Create new stage
        const durations = await getStageDurations(order.priority);
        const deadline = calculateDeadline(new Date(), durations[stageName] || 24);
        await prisma.orderStage.create({
          data: { orderId, stageName, status: 'PENDING', deadlineAt: deadline }
        });
        await checkAndSetProductionDeadline(orderId, stageName, deadline, req.user.id);

        await prisma.order.update({
          where: { id: orderId },
          data: { currentStage: stageName, status: 'IN_PROGRESS' }
        });

        await createAuditLog(orderId, 'FORCE_MOVE', `Force moved to stage ${stageName} by ${req.user.name}. Reason: ${reason || 'No reason'}`, req.user.id);
        response = { message: `Order force-moved to ${stageName}` };
        break;
      }

      case 'EXTEND_DEADLINE': {
        const { hours } = req.body;
        if (!hours) return res.status(400).json({ message: 'Hours required' });
        
        const pendingStage = order.stages.find(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS' || s.status === 'WAITING_APPROVAL');
        if (!pendingStage) return res.status(400).json({ message: 'No active stage to extend' });

        const newDeadline = calculateDeadline(new Date(), parseFloat(hours));
        await prisma.orderStage.update({
          where: { id: pendingStage.id },
          data: { deadlineAt: newDeadline }
        });

        await createAuditLog(orderId, 'DEADLINE_EXTENDED', `Deadline extended by ${hours}h. New deadline: ${newDeadline.toISOString()}. By ${req.user.name}`, req.user.id);
        response = { message: `Deadline extended by ${hours} hours`, deadlineAt: newDeadline };
        break;
      }

      case 'FORCE_COMPLETE': {
        const currentActive = order.stages.find(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS' || s.status === 'WAITING_APPROVAL');
        if (currentActive) {
          await prisma.orderStage.update({
            where: { id: currentActive.id },
            data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Force completed by ${req.user.name}: ${reason || 'No reason'}` }
          });
        }

        await prisma.order.update({
          where: { id: orderId },
          data: { currentStage: 'COMPLETED', status: 'COMPLETED' }
        });

        await createAuditLog(orderId, 'FORCE_COMPLETE', `Order force-completed by ${req.user.name}. Reason: ${reason || 'No reason'}`, req.user.id);
        response = { message: 'Order force-completed' };
        break;
      }

      default:
        return res.status(400).json({ message: `Unknown action: ${action}` });
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Force action failed', error: error.message });
  }
};

const checkOrderInventory = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
    const productsToCheck = [];

    if (Array.isArray(parsedDetails)) {
      parsedDetails.forEach(item => {
        const pd = item.productDetails || item;
        if (pd?.productType) {
          productsToCheck.push({
            productType: pd.productType,
            quantity: item.quantity || 1,
            color: pd.color,
            size: pd.size,
            customization: item.customization || pd.customization
          });
        }
      });
    } else if (parsedDetails?.productType) {
      productsToCheck.push({
        productType: parsedDetails.productType,
        quantity: order.quantity || 1,
        color: parsedDetails.color,
        size: parsedDetails.size,
        customization: parsedDetails.customization
      });
    }

    const report = [];
    for (const prod of productsToCheck) {
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: {
          name: { contains: prod.productType, mode: 'insensitive' },
          category: { not: 'FABRIC' }
        }
      });

      if (!inventoryItem) {
        report.push({
          itemName: prod.productType,
          requiredQty: prod.quantity,
          availableQty: 0,
          status: 'not_found',
          variants: []
        });
        continue;
      }

      // Check variant-specific availability
      let availableQty = 0;
      let variantDetails = [];
      if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
        variantDetails = inventoryItem.variants.map(v => ({
          color: v.color,
          size: v.size,
          stock: v.stock || 0
        }));
        availableQty = inventoryItem.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      } else {
        availableQty = inventoryItem.stock || 0;
      }

      let status = 'available';
      if (availableQty === 0) status = 'out_of_stock';
      else if (availableQty < prod.quantity) status = 'insufficient';

      report.push({
        itemId: inventoryItem.id,
        itemName: inventoryItem.name,
        category: inventoryItem.category,
        requiredQty: prod.quantity,
        availableQty,
        status,
        variants: variantDetails,
        requestedColor: prod.color,
        requestedSize: prod.size,
        customization: prod.customization
      });
    }

    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      report,
      summary: {
        totalItems: report.length,
        available: report.filter(r => r.status === 'available').length,
        insufficient: report.filter(r => r.status === 'insufficient').length,
        outOfStock: report.filter(r => r.status === 'out_of_stock' || r.status === 'not_found').length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error checking inventory', error: error.message });
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
  clearHistory,
  cancelOrder,
  deleteOrder,
  updateDeliveryStatus,
  holdOrder,
  sendForDelivery,
  updateOrderPriority,
  forceAction,
  setDeliveryType,
  checkOrderInventory
};
