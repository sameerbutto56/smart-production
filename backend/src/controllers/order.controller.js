const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateDeadline } = require('../utils/deadline');
 
const NEXT_STAGES = {
  'STANDARD': ['STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
  'READY_LOGO': ['STORE', 'LOGO_DESIGN', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
  'FULL_CUSTOM': ['STORE', 'CUTTING', 'LOGO_DESIGN', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY']
};
 
const AUTO_TRANSITION_STAGES = ['CUTTING', 'STITCHING', 'QA', 'DISPATCH', 'OUT_FOR_DELIVERY'];

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
  const { orderNumber: requestedOrderNumber, customerName, customerPhone, address, type, urgent, quantity, logoDesign, logoName, customization, productDetails, sizeData, advancePaid, shopifyOrderId, paymentDeadline, productImage, items } = req.body;

  if (!customerPhone) {
    return res.status(400).json({ error: 'Customer phone number is required' });
  }

  try {
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
        urgent: urgent || false,
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
        const durations = await getStageDurations();
        const deadline = calculateDeadline(new Date(), durations[firstStage] || 2);
        
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

        return res.json([...activeOrders, ...completedOrders]);
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
      } else if (currentStage.stageName === 'OUT_FOR_DELIVERY') {
        // FINAL STAGE COMPLETED
        await prisma.order.update({
          where: { id: orderId },
          data: { 
            currentStage: 'COMPLETED',
            status: 'COMPLETED'
          }
        });
        await createAuditLog(orderId, 'ORDER_COMPLETED', `Order fully completed after final delivery stage. Moved to History.`, req.user.id);
      }
      
      const io = req.app.get('io');
      io.emit('order-updated', { orderId, createdById: order.createdById });
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
     io.emit('stage-completion-requested', { orderId, stage, urgent: order?.urgent });
     io.emit('order-updated', { orderId, createdById: order?.createdById || stage?.order?.createdById });
     io.emit('global-alert', {
       title: 'Approval Required',
       message: `${stage.stageName.replace(/_/g, ' ')} completed. Sent to Faisal.`,
       icon: 'clipboard',
       urgent: order?.urgent
     });

    await createAuditLog(orderId, 'STAGE_COMPLETION_REQUESTED', `Completion requested for ${stage.stageName}. Waiting for Faisal.`, req.user.id);

    res.json({ message: 'Completion requested from Faisal', stage });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting completion', error: error.message });
  }
};

const approveStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { nextStage, customizationPrice, deliveryMethod } = req.body; 

  try {
    const currentStageRecord = await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    
    // Update Customization Price and Delivery Method if provided
    const updateData = {};
    if (customizationPrice && parseFloat(customizationPrice) > 0) {
      updateData.customizationPrice = (order.customizationPrice || 0) + parseFloat(customizationPrice);
    }
    if (deliveryMethod) {
      updateData.deliveryMethod = deliveryMethod;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: updateData
      });
    }

    // --- INVENTORY DEDUCTION ---
    if (currentStageRecord.stageName === 'STORE') {
      let parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
      
      // Handle multi-item orders: productDetails is an array of items
      const productsToDeduct = [];
      if (Array.isArray(parsedDetails)) {
        // Multi-item order: each element has { productDetails: {...}, quantity, ... }
        parsedDetails.forEach(item => {
          const pd = item.productDetails || item;
          if (pd?.productType) {
            productsToDeduct.push({ productType: pd.productType, quantity: item.quantity || 1 });
          }
        });
      } else if (parsedDetails?.productType) {
        // Single-item order (legacy format)
        productsToDeduct.push({ productType: parsedDetails.productType, quantity: order.quantity || 1 });
      }

      for (const prod of productsToDeduct) {
        const inventoryItem = await prisma.inventoryItem.findFirst({
          where: { 
            name: { contains: prod.productType, mode: 'insensitive' },
            category: { not: 'FABRIC' }
          }
        });

        if (inventoryItem && inventoryItem.stock > 0) {
          const deductQty = Math.min(prod.quantity, inventoryItem.stock);
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { stock: { decrement: deductQty } }
          });
          await createAuditLog(orderId, 'INVENTORY_DEDUCTED', `Deducted ${deductQty} unit(s) of ${inventoryItem.name} from stock.`, req.user.id);
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

      const io = req.app.get('io');
      io.emit('global-alert', {
        title: 'Phase Advanced',
        message: `Order moved to ${actualNextStage.replace(/_/g, ' ')}.`,
        icon: 'package',
        urgent: order?.urgent
      });
    } else {
      // It returns to Faisal or is finished
      if (currentStageRecord.stageName === 'OUT_FOR_DELIVERY') {
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

    await createAuditLog(orderId, 'STAGE_APPROVED', `${currentStageRecord.stageName} approved. ${actualNextStage ? `Sent to: ${actualNextStage}` : 'Returned to Faisal Control Center'}${customizationPrice ? ` | Added Cost: $${customizationPrice}` : ''}${deliveryMethod ? ` | Delivery: ${deliveryMethod}` : ''}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order?.createdById || stage?.order?.createdById });

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
      prisma.order.count({ where: { urgent: true } }),
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
  const { deliveryStatus, remarks } = req.body; // deliveryStatus: 'DELIVERED' | 'NOT_RESPONDED'
  const userId = req.user?.id;

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: deliveryStatus === 'DELIVERED' ? 'COMPLETED' : order.status,
        currentStage: deliveryStatus === 'DELIVERED' ? 'DELIVERED' : order.currentStage,
        paymentStatus: deliveryStatus === 'DELIVERED' ? 'FULL_PAID' : order.paymentStatus,
        advancePaid: deliveryStatus === 'DELIVERED' ? true : order.advancePaid,
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

    const durations = await getStageDurations();
    const deadline = calculateDeadline(new Date(), durations['OUT_FOR_DELIVERY'] || 2);

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
  sendForDelivery
};
