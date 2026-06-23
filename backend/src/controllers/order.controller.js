const prisma = require('../prisma');
const { calculateDeadline } = require('../utils/deadline');

// In-memory cache for frequently accessed settings
const cache = {
  systemPaused: { value: false, expiresAt: 0 },
  stageDurations: { value: null, expiresAt: 0 },
};

const CACHE_TTL = 30000; // 30 seconds

const isSystemPaused = async () => {
  if (Date.now() < cache.systemPaused.expiresAt) return cache.systemPaused.value;
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_PAUSED' } });
    cache.systemPaused = { value: setting ? setting.value === 'true' : false, expiresAt: Date.now() + CACHE_TTL };
    return cache.systemPaused.value;
  } catch { return false; }
};

const PRIORITY_ORDER = { 'SUPER_URGENT': 0, 'URGENT': 1, 'NORMAL': 2 };

const getProductCategory = (productType) => {
  if (!productType) return 'GENERAL';
  const pt = productType.toUpperCase();
  if (pt.includes('CAP') || pt.includes('HAT')) return 'CAPS';
  if (pt.includes('SHIRT') || pt.includes('T-SHIRT') || pt.includes('TEE') || pt.includes('POLO') || pt.includes('KURTA')) return 'SHIRTS';
  if (pt.includes('JACKET') || pt.includes('BLAZER') || pt.includes('SWEATER') || pt.includes('HOODIE') || pt.includes('COAT')) return 'JACKETS';
  if (pt.includes('PANT') || pt.includes('TROUSER') || pt.includes('JEANS') || pt.includes('SHORTS') || pt.includes('SALWAR')) return 'PANTS';
  if (pt.includes('BAG') || pt.includes('BELT') || pt.includes('WALLET') || pt.includes('SCARF') || pt.includes('TIE')) return 'ACCESSORIES';
  return 'GENERAL';
};

const sortByPriority = (orders) => {
  return [...orders].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
};

const NEXT_STAGES = {
  'STANDARD': ['STORE', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'],
  'READY_LOGO': ['STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'],
  'FULL_CUSTOM': ['STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY']
};
 
const AUTO_TRANSITION_STAGES = ['STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'];

// Validates forward-only stage transitions to prevent routing loops
const validateStageTransition = (fromStage, toStage, orderType) => {
  const validTransitions = {
    'STORE': { 'STANDARD': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'], 'READY_LOGO': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'], 'FULL_CUSTOM': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'] },
    'LOGO_DESIGN': { 'STANDARD': ['PRODUCTION_ACCEPTANCE', 'PRODUCTION'], 'READY_LOGO': ['PRODUCTION_ACCEPTANCE', 'PRODUCTION'], 'FULL_CUSTOM': ['PRODUCTION_ACCEPTANCE', 'PRODUCTION'] },
    'PRODUCTION_ACCEPTANCE': { 'STANDARD': ['PRODUCTION'], 'READY_LOGO': ['PRODUCTION'], 'FULL_CUSTOM': ['PRODUCTION'] },
    'PRODUCTION': { 'STANDARD': ['STORE_RECEIVE', 'STORE'], 'READY_LOGO': ['STORE_RECEIVE', 'STORE'], 'FULL_CUSTOM': ['STORE_RECEIVE', 'STORE'] },
    'STORE_RECEIVE': { 'STANDARD': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'], 'READY_LOGO': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'], 'FULL_CUSTOM': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'] },
    'DISPATCH': { 'STANDARD': ['OUT_FOR_DELIVERY'], 'READY_LOGO': ['OUT_FOR_DELIVERY'], 'FULL_CUSTOM': ['OUT_FOR_DELIVERY'] },
    'OUT_FOR_DELIVERY': { 'STANDARD': [], 'READY_LOGO': [], 'FULL_CUSTOM': [] }
  };

  const allowed = validTransitions[fromStage]?.[orderType];
  if (!allowed || !allowed.includes(toStage)) {
    return { valid: false, expected: allowed?.[0], message: `Invalid transition from ${fromStage} to ${toStage}. ${allowed?.length ? `Allowed: ${allowed.join(', ')}.` : 'No forward transition available from this stage.'}` };
  }
  return { valid: true, expected: toStage };
};

const getRolesForStage = (stageName) => {
  const map = {
    'STORE': ['STORE', 'STORE_EMPLOYEE'],
    'LOGO_DESIGN': ['LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER'],
    'PRODUCTION_ACCEPTANCE': ['PRODUCTION'],
    'PRODUCTION': ['PRODUCTION'],
    'STORE_RECEIVE': ['STORE', 'STORE_EMPLOYEE'],
    'DISPATCH': ['DISPATCH', 'MAIN_EMPLOYEE'],
    'OUT_FOR_DELIVERY': ['OUT_FOR_DELIVERY', 'DELIVERY_BOY']
  };
  return map[stageName] || ['ADMIN', 'FAISAL'];
};

const getStageDurations = async (priority = 'NORMAL') => {
  if (Date.now() < cache.stageDurations.expiresAt && cache.stageDurations.value) {
    const slaMultiplier = cache.stageDurations.value.slaMultipliers?.[priority] ?? 1;
    const adjusted = {};
    for (const [stage, hours] of Object.entries(cache.stageDurations.value.stageDurations)) {
      adjusted[stage] = Math.round((hours * slaMultiplier) * 100) / 100;
    }
    return adjusted;
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'DEADLINE_CONFIG' }
  });

  let config = {
    stageDurations: { STORE: 24, LOGO_DESIGN: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48, STORE_RECEIVE: 12, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
    slaMultipliers: { NORMAL: 1, URGENT: 0.75, SUPER_URGENT: 0.5 }
  };

  if (setting) {
    try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) { console.error('Error parsing DEADLINE_CONFIG:', e); }
  }

  cache.stageDurations = { value: config, expiresAt: Date.now() + CACHE_TTL };

  const slaMultiplier = config.slaMultipliers?.[priority] ?? 1;
  const durations = config.stageDurations || {};

  const adjusted = {};
  for (const [stage, hours] of Object.entries(durations)) {
    adjusted[stage] = Math.round((hours * slaMultiplier) * 100) / 100;
  }
  return adjusted;
};
 


const getBrandingRates = async () => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'BRANDING_CHARGES' } });
    if (setting) {
      const parsed = JSON.parse(setting.value);
      return {
        logoCharge: parsed.logoCharge ?? 500,
        namePrintingCharge: parsed.namePrintingCharge ?? 300,
        customizationCharge: parsed.customizationCharge ?? 200
      };
    }
  } catch (e) {
    console.error('Error parsing BRANDING_CHARGES:', e);
  }
  return { logoCharge: 500, namePrintingCharge: 300, customizationCharge: 200 };
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

const createProductionRecordFromOrder = async (order, stageCompleted) => {
  if (stageCompleted !== 'PRODUCTION') return;
  try {
    let items = [];
    let parsedDetails;
    try {
      parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
    } catch { return; }
    if (!parsedDetails) return;

    if (Array.isArray(parsedDetails)) {
      items = parsedDetails;
    } else {
      items = [{ productDetails: parsedDetails, quantity: order.quantity || 1 }];
    }

    const orderSource = order.source === 'ONLINE' || order.source === 'INTERNAL' ? 'ONLINE' : 'OUTLET';

    for (const item of items) {
      const pd = item.productDetails || item;
      const productName = pd.productType || pd.name || 'Unknown Product';
      const qty = item.quantity || 1;
      const rawCost = parseFloat(order.productCost || 0) / items.length;
      const prodCost = parseFloat(order.productionCost || 0) / items.length;
      const totalCost = rawCost + prodCost;
      const sellVal = parseFloat(order.totalPrice || 0) / items.length;
      const profit = sellVal - totalCost;

      try {
        await prisma.productionRecord.create({
          data: {
            productName,
            quantity: qty,
            rawMaterialCost: rawCost,
            productionCost: prodCost,
            totalCost,
            sellingValue: sellVal,
            profit,
            source: orderSource,
            orderId: order.id,
            notes: `Auto-created from order stage completion`,
            productionDate: new Date()
          }
        });
      } catch (e) {
        if (e?.code === 'P2021') { continue; }
        throw e;
      }

      try {
        const existing = await prisma.productionInventory.findFirst({
          where: { orderId: order.id }
        });
        if (existing) {
          await prisma.productionInventory.update({
            where: { id: existing.id },
            data: { quantity: { increment: qty }, profitMargin: sellVal > 0 ? ((sellVal - totalCost) / sellVal) * 100 : 0 }
          });
        } else {
          await prisma.productionInventory.create({
            data: {
              productName, category: getProductCategory(productName), quantity: qty,
              productionCost: prodCost, sellingValue: sellVal,
              profitMargin: sellVal > 0 ? ((sellVal - totalCost) / sellVal) * 100 : 0,
              source: orderSource, orderId: order.id, productionDate: new Date()
            }
          });
        }
      } catch (e) {
        if (e?.code !== 'P2021') throw e;
      }
    }
  } catch (e) {
    console.error('Error creating production record from order:', e);
  }
};




const createOrder = async (req, res) => {
  const { orderNumber: requestedOrderNumber, customerName, customerPhone, address, city, type, urgent, priority, quantity, logoDesign, logoName, customization, productDetails, sizeData, advancePaid, advanceAmount, shopifyOrderId, paymentDeadline, productImage, items, paymentStatus, deliveryCharges, instructionNotes, shopifyOrderDate } = req.body;

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
        const existing = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
        if (!existing) isUnique = true;
      }
    } else {
      // Check if manual order number is already taken
      const existing = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
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
      // Look up inventory prices and calculate server-side pricing (batched)
      const productTypes = [...new Set(items.map(i => (i.productDetails?.productType || '').trim()).filter(Boolean))];
      const inventoryItems = productTypes.length > 0
        ? await prisma.inventoryItem.findMany({
            where: {
              OR: productTypes.map(p => ({ name: { contains: p, mode: 'insensitive' } })),
              category: { not: 'FABRIC' }
            }
          })
        : [];
      const inventoryByProduct = {};
      for (const inv of inventoryItems) {
        for (const pt of productTypes) {
          if (inv.name.toLowerCase().includes(pt.toLowerCase())) {
            inventoryByProduct[pt.toLowerCase()] = inv;
          }
        }
      }
      const processedItems = [];
      for (const item of items) {
        const pd = item.productDetails || {};
        let unitPrice = 0;
        if (pd.productType) {
          const inventoryItem = inventoryByProduct[pd.productType.toLowerCase()];
          if (inventoryItem) {
            if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
              const matchingVariant = inventoryItem.variants.find(v =>
                (!pd.color || (v.color && v.color.toLowerCase() === pd.color.toLowerCase())) &&
                (!pd.size || (v.size && v.size.toLowerCase() === pd.size.toLowerCase()))
              );
              unitPrice = matchingVariant?.price || inventoryItem.price || 0;
            } else {
              unitPrice = inventoryItem.price || 0;
            }
          }
        }
        const qty = item.quantity || 1;
        processedItems.push({
          productDetails: pd,
          customization: item.customization,
          sizeData: item.sizeData,
          quantity: qty,
          unitPrice,
          totalPrice: unitPrice * qty,
          logoName: item.logoName || '',
          logoDesign: item.logoDesign || '',
          logoCharges: parseFloat(item.logoCharges) || 0,
          namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
          customizationPrice: parseFloat(item.customizationPrice) || 0,
          capCharges: parseInt(item.capCharges) || 0
        });
      }
      finalProductDetails = processedItems;
      // Keep the first item's customization & sizeData as the primary for backward compat
      finalCustomization = items[0].customization || customization;
      finalSizeData = items[0].sizeData || sizeData;
    }

    // Calculate branding/logo charges
    let parsedCustomization = finalCustomization;
    if (typeof finalCustomization === 'string') {
      try { parsedCustomization = JSON.parse(finalCustomization); } catch (e) { parsedCustomization = {}; }
    }
    const brandingRates = await getBrandingRates();
    const hasLogo = !!(logoDesign || (items && items.some(i => i.logoDesign || i.customization?.logoDetails)));
    const hasNamePrinting = !!(parsedCustomization?.nameSpelling || (items && items.some(i => i.customization?.nameSpelling)));
    const hasCustomization = !!(type === 'FULL_CUSTOM' || parsedCustomization?.stitchingStyle === 'DBL' || (items && items.some(i => i.customization?.stitchingStyle === 'DBL')));

    const finalLogoCharges = parseFloat(req.body.logoCharges) || (hasLogo ? brandingRates.logoCharge : 0);
    const finalNamePrintingCharges = parseFloat(req.body.namePrintingCharges) || (hasNamePrinting ? brandingRates.namePrintingCharge : 0);
    const finalCustomizationPrice = parseFloat(req.body.customizationPrice) || (hasCustomization ? brandingRates.customizationCharge : 0);
    let finalDeliveryCharges = parseFloat(req.body.deliveryCharges) || 0;

    let baseTotal = finalProductDetails && Array.isArray(finalProductDetails)
      ? finalProductDetails.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
      : (parseFloat(req.body.totalPrice) || 0);
    const orderTotalBeforeDelivery = baseTotal + finalLogoCharges + finalNamePrintingCharges + finalCustomizationPrice;
    if (orderTotalBeforeDelivery > 7000) {
      finalDeliveryCharges = 0;
    }
    const finalTotalPrice = orderTotalBeforeDelivery + finalDeliveryCharges;

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
        logoCharges: finalLogoCharges,
        namePrintingCharges: finalNamePrintingCharges,
        customizationPrice: finalCustomizationPrice,
        deliveryCharges: finalDeliveryCharges,
        customization: finalCustomization ? JSON.stringify(finalCustomization) : null,
        productDetails: finalProductDetails ? JSON.stringify(finalProductDetails) : null,
        sizeData: finalSizeData ? JSON.stringify(finalSizeData) : null,
        advancePaid: advancePaid || (advanceAmount > 0) || false,
        advanceAmount: advanceAmount || 0,
        paymentStatus: paymentStatus || 'PENDING',
        instructionNotes: instructionNotes || null,
        shopifyOrderDate: shopifyOrderDate ? new Date(shopifyOrderDate) : null,
        productImage,
        totalPrice: finalTotalPrice,
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

    // If order is prepaid, record revenue immediately
    if (paymentStatus === 'PAID') {
      await calculateAndRecordRevenue(order);
    }

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
    const { status: filterStatus, limit, skip, page } = req.query;
    const pageNum = parseInt(page) || 0;
    const skipVal = parseInt(skip) || 0;
    const takeLimit = limit === 'all' ? undefined : (parseInt(limit) || 200);

    let where = {};

    // 1. Role boundary isolation
    if (role === 'OUTLET' || role === 'FAISAL') {
      where.createdById = id;
      // STORE_RECEIVE is Store-only — never show in Online/Outlet modules
      where.currentStage = { not: 'STORE_RECEIVE' };
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
      // Optionally filter by deliveryType (e.g., ENAMELS, TCS, POST_EX)
      if (req.query.deliveryType) {
        where.deliveryType = req.query.deliveryType;
      }
    } else {
      // Default: If no status specified, load active orders + the 100 most recent completed orders to keep payload tiny!
      // This is backward-compatible with older frontend code that filters in memory!
      if (!limit || limit !== 'all') {
        const [activeOrders, completedOrders] = await prisma.$transaction([
          prisma.order.findMany({
            where: {
              ...where,
              status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
            },
            include: {
              stages: { orderBy: { createdAt: 'desc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
              auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
              createdBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 500
          }),
          prisma.order.findMany({
            where: {
              ...where,
              status: { in: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
            },
            include: {
              stages: { orderBy: { createdAt: 'desc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
              auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
              createdBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
          })
        ]);

        return res.json(sortByPriority([...activeOrders, ...completedOrders]));
      }
    }

    const orders = await prisma.order.findMany({
      where,
      skip: pageNum > 0 ? (pageNum - 1) * takeLimit : skipVal,
      take: takeLimit,
      include: {
        stages: {
          orderBy: { createdAt: 'desc' },
          select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true }
        },
        auditLogs: {
          orderBy: { timestamp: 'desc' },
          select: { action: true, timestamp: true, details: true, performedBy: true }
        },
        createdBy: {
          select: { name: true }
        },
        deliveryAttempts: {
          orderBy: { attemptNumber: 'asc' },
          select: { attemptNumber: true, status: true, riderName: true, attemptedAt: true, rescheduledTo: true, notes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // When pagination is requested, include total count
    if (pageNum > 0 || skipVal > 0) {
      const total = await prisma.order.count({ where });
      return res.json({ orders: sortByPriority(orders), total, page: pageNum || 1, totalPages: Math.ceil(total / takeLimit) });
    }
    
    res.json(sortByPriority(orders));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

const requestStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { inventoryStatus, nextStage: manualNextStage, remarks } = req.body;

  try {
    if (await isSystemPaused()) {
      return res.status(503).json({ message: 'System is paused for holidays. Stage completion is disabled.' });
    }
    const currentStage = await prisma.orderStage.findUnique({ where: { id: stageId } });
    if (!currentStage) {
      return res.status(404).json({ message: 'Stage not found' });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // STORE stage: classify items + deduct only available items
    if (currentStage.stageName === 'STORE' && (inventoryStatus === 'have_it' || inventoryStatus === 'Available')) {
      try {
        // Parse productDetails and filter by per-product availability
        let parsedDetails;
        try {
          parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
        } catch {
          parsedDetails = [];
        }
        const items = Array.isArray(parsedDetails) ? parsedDetails : (parsedDetails?.productType ? [parsedDetails] : []);
        const productAvailability = req.body.productAvailability || {};

        let updatedItems = items;
        // Update productDetails with availability status in DB
        if (Object.keys(productAvailability).length > 0) {
          updatedItems = items.map((item, idx) => {
            const av = productAvailability[idx];
            if (av !== undefined) {
              return { ...item, availabilityStatus: av ? 'available' : 'not_available' };
            }
            return item;
          });
          await prisma.order.update({
            where: { id: orderId },
            data: { productDetails: JSON.stringify(updatedItems) }
          });
        }

        // Only classify items marked as available
        const availableItems = updatedItems.filter(item =>
          item.availabilityStatus !== 'not_available'
        );

        if (availableItems.length > 0) {
          const { inventoryItems, productionItems } = await classifyOrderItems(order, availableItems);
          await deductInventoryItems(order, req.user.id, inventoryItems);
          await createAuditLog(orderId, 'INVENTORY_CONFIRMED',
            `Classified ${inventoryItems.length} available inventory item(s) and ${productionItems.length} production item(s). Stock deducted for available items.`,
            req.user.id);
        } else {
          await createAuditLog(orderId, 'INVENTORY_CONFIRMED',
            'No items marked as available. Skipping inventory deduction.',
            req.user.id);
        }
      } catch (invErr) {
        console.error('Classification / deduction error:', invErr);
      }
    }

    // Mark current stage as completed
    await prisma.orderStage.update({
      where: { id: stageId },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    // Determine next stage — use manual route if provided, else auto-advance via pipeline
    let actualNextStage = manualNextStage || null;
    if (!actualNextStage) {
      const stageName = currentStage.stageName;
      const stages = NEXT_STAGES[order.type] || NEXT_STAGES['STANDARD'];
      const currentIndex = stages.indexOf(stageName);
      if (currentIndex >= 0 && currentIndex < stages.length - 1) {
        actualNextStage = stages[currentIndex + 1];
      }
    }

    // Enforce forward-only routing to prevent loops (except for SUPER_ADMIN, STORE, STORE_EMPLOYEE)
    if (actualNextStage && currentStage.stageName !== 'ORDER_ENTRY' && !['SUPER_ADMIN', 'STORE', 'STORE_EMPLOYEE'].includes(req.user.role)) {
      const validation = validateStageTransition(currentStage.stageName, actualNextStage, order.type);
      if (!validation.valid) {
        await createAuditLog(orderId, 'ROUTE_BLOCKED',
          `Blocked invalid transition from ${currentStage.stageName} to ${actualNextStage} by ${req.user.name}. ${validation.message}`,
          req.user.id);
        return res.status(400).json({ message: validation.message, expectedNext: validation.expected });
      }
    }

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

      const isStoreRoutingBack = ['STORE', 'STORE_EMPLOYEE'].includes(req.user.role) && actualNextStage !== 'DISPATCH';
      await prisma.order.update({
        where: { id: orderId },
        data: {
          currentStage: actualNextStage,
          ...(isStoreRoutingBack ? { storeRequested: true, storeRequestedAt: new Date() } : {})
        }
      });

      // Log routing history
      const recipientUsers = await prisma.user.findMany({
        where: { role: { in: getRolesForStage(actualNextStage) } },
        select: { id: true }
      });
      await prisma.routingHistory.create({
        data: {
          orderId,
          sentByUserId: req.user.id,
          sentToStage: actualNextStage,
          sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
          previousStage: currentStage.stageName,
          newStage: actualNextStage,
          remarks: remarks || (manualNextStage ? `Manually routed to ${actualNextStage} by ${req.user.name || 'Worker'}` : `Auto-advanced to ${actualNextStage}`),
          createdAt: new Date()
        }
      }).catch(e => console.error('Routing history log error:', e));

      // Reset seen status for recipients — single batch query
      await prisma.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: actualNextStage }
      }).catch(() => {});

      await createAuditLog(orderId, manualNextStage ? 'MANUAL_ROUTE' : 'STAGE_AUTO_TRANSITION',
        `${currentStage.stageName} completed. ${manualNextStage ? `Manually routed to ${actualNextStage}` : `Auto-moved to ${actualNextStage}`}.`,
        req.user.id);
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
      const completedOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (completedOrder) await calculateAndRecordRevenue(completedOrder);
    }
    
    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });
    return res.json({ message: 'Stage completed and auto-moved to next stage', nextStage: actualNextStage });
  } catch (error) {
    console.error('requestStageCompletion error:', error.stack || error);
    res.status(500).json({ message: 'Error requesting completion', error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
};

const approveStageCompletion = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { nextStage, customizationPrice, deliveryMethod, deliveryType } = req.body; 

  try {
    if (await isSystemPaused()) {
      return res.status(503).json({ message: 'System is paused for holidays. Approvals are disabled.' });
    }
    const currentStageRecord = await prisma.orderStage.findUnique({ where: { id: stageId } });
    if (!currentStageRecord) {
      return res.status(404).json({ message: 'Stage not found' });
    }
    await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // STORE stage classification on approval — respect per-product availability
    if (currentStageRecord.stageName === 'STORE') {
      try {
        // Read per-product availability from stored productDetails
        let parsedDetails;
        try {
          parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
        } catch {
          parsedDetails = [];
        }
        const items = Array.isArray(parsedDetails) ? parsedDetails : (parsedDetails?.productType ? [parsedDetails] : []);

        // Only classify items whose availabilityStatus is not 'not_available'
        const availableItems = items.filter(item =>
          item.availabilityStatus !== 'not_available'
        );

        if (availableItems.length > 0) {
          const { inventoryItems, productionItems } = await classifyOrderItems(order, availableItems);
          await deductInventoryItems(order, req.user.id, inventoryItems);
          await createAuditLog(orderId, 'INVENTORY_CONFIRMED',
            `Classified ${inventoryItems.length} available inventory item(s) and ${productionItems.length} production item(s). Stock deducted for available items.`,
            req.user.id);
        } else {
          await createAuditLog(orderId, 'INVENTORY_CONFIRMED',
            'No items marked as available. Skipping inventory deduction.',
            req.user.id);
        }
      } catch (invErr) {
        console.error('Classification / deduction error:', invErr);
      }
    }

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

    // Determine next stage — use manual nextStage if provided, else auto-advance via pipeline
    let actualNextStage = nextStage;
    if (!actualNextStage) {
      const stages = NEXT_STAGES[order.type] || NEXT_STAGES['STANDARD'];
      const currentIndex = stages.indexOf(currentStageRecord.stageName);
      actualNextStage = stages[currentIndex + 1];
    }

    // Enforce forward-only routing to prevent loops (except for SUPER_ADMIN, STORE, STORE_EMPLOYEE)
    if (actualNextStage && currentStageRecord.stageName !== 'ORDER_ENTRY' && !['SUPER_ADMIN', 'STORE', 'STORE_EMPLOYEE'].includes(req.user.role)) {
      const validation = validateStageTransition(currentStageRecord.stageName, actualNextStage, order.type);
      if (!validation.valid) {
        await createAuditLog(orderId, 'ROUTE_BLOCKED',
          `Blocked invalid transition from ${currentStageRecord.stageName} to ${actualNextStage} by ${req.user.name}. ${validation.message}`,
          req.user.id);
        return res.status(400).json({ message: validation.message, expectedNext: validation.expected });
      }
    }

    // Log routing history when stage is completed and next stage is known
    if (actualNextStage) {
      const recipientUsers = await prisma.user.findMany({
        where: { role: { in: getRolesForStage(actualNextStage) } },
        select: { id: true }
      });
      await prisma.routingHistory.create({
        data: {
          orderId,
          sentByUserId: req.user.id,
          sentToStage: actualNextStage,
          sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
          previousStage: currentStageRecord.stageName,
          newStage: actualNextStage,
          remarks: `Manually routed by ${req.user.name || 'Admin'}`,
          createdAt: new Date()
        }
      }).catch(e => console.error('Routing history log error:', e));

      // Mark as unseen for all recipient users — single batch query
      await prisma.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: actualNextStage }
      }).catch(() => {});
    }

    if (actualNextStage) {
      // Prevent duplicate stage creation if requestStageCompletion already created it
      const existingStage = await prisma.orderStage.findFirst({
        where: { orderId, stageName: actualNextStage, status: 'PENDING' }
      });
      if (!existingStage) {
        const durations = await getStageDurations(order.priority);
        const duration = durations[actualNextStage] || 24;
        const deadline = calculateDeadline(new Date(), duration);
        await prisma.orderStage.create({
          data: { orderId, stageName: actualNextStage, status: 'PENDING', deadlineAt: deadline }
        });
        await checkAndSetProductionDeadline(orderId, actualNextStage, deadline, req.user.id);
      }

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
      // Record revenue on completion
      const completedOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (completedOrder) await calculateAndRecordRevenue(completedOrder);
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
  const { paymentStatus, paidAmount, paymentMethod: method } = req.body;

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Track payment transactions in courierDetails JSON field
    let courierDetails = order.courierDetails || {};
    if (typeof courierDetails === 'string') courierDetails = JSON.parse(courierDetails);
    if (!courierDetails.payments) courierDetails.payments = [];

    if (paidAmount && parseFloat(paidAmount) > 0) {
      courierDetails.payments.push({
        method: method || 'CASH',
        amount: parseFloat(paidAmount),
        date: new Date().toISOString(),
        recordedBy: req.user.id
      });
    }

    // Calculate total paid vs total price to determine actual status
    const totalPaid = courierDetails.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPrice = order.totalPrice || 0;
    let finalPaymentStatus = paymentStatus;
    if (totalPaid >= totalPrice) {
      finalPaymentStatus = 'FULL_PAID';
    } else if (totalPaid > 0) {
      finalPaymentStatus = 'ADVANCE_PAID';
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { 
        paymentStatus: finalPaymentStatus,
        advancePaid: finalPaymentStatus === 'ADVANCE_PAID' || finalPaymentStatus === 'FULL_PAID',
        courierDetails,
        paymentMethod: method || order.paymentMethod
      }
    });

    // If it was waiting for payment and now advance is paid, move to first module (STORE)
    if (updatedOrder.status === 'WAITING_PAYMENT' && updatedOrder.advancePaid) {
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
      
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'IN_PROGRESS',
          currentStage: 'STORE'
        }
      });
    }

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, paymentStatus: updatedOrder.paymentStatus, createdById: updatedOrder.createdById });
    io.emit('payment-updated', { orderId, order: updatedOrder });

    await createAuditLog(orderId, 'PAYMENT_UPDATED',
      `Payment: ${finalPaymentStatus} | Total paid: ${totalPaid}/${totalPrice} | Method: ${method || 'CASH'} | Amount: ${paidAmount || 'status-only'}`,
      req.user.id);

    res.json({ message: 'Payment status updated', order: updatedOrder, totalPaid, remainingBalance: Math.max(0, totalPrice - totalPaid) });
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
          updatedAt: { gte: today },
          status: { in: ['COMPLETED', 'DELIVERED'] }
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
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Restore all deducted inventory before cancelling
    await restoreInventoryForDeletion(order, req.user.id);

    await prisma.order.update({
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

const restoreInventoryForDeletion = async (order, userId) => {
  if (!order) return;
  let parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;

  const productsToRestore = [];
  if (Array.isArray(parsedDetails)) {
    parsedDetails.forEach(item => {
      const pd = item.productDetails || item;
      if (pd?.productType) {
        productsToRestore.push({ productType: pd.productType, quantity: item.quantity || 1, color: pd.color, size: pd.size });
      }
    });
  } else if (parsedDetails?.productType) {
    productsToRestore.push({ productType: parsedDetails.productType, quantity: order.quantity || 1, color: parsedDetails.color, size: parsedDetails.size });
  }

  if (productsToRestore.length === 0) return;

  // Batch-fetch all matching inventory items in one query
  const productTypes = [...new Set(productsToRestore.map(p => p.productType))];
  const allInvItems = await prisma.inventoryItem.findMany({
    where: {
      category: { not: 'FABRIC' },
      OR: productTypes.map(name => ({ name: { contains: name, mode: 'insensitive' } }))
    }
  });

  const operations = [];
  const auditEntries = [];

  for (const prod of productsToRestore) {
    const inventoryItem = allInvItems.find(inv => inv.name.toLowerCase().includes(prod.productType.toLowerCase()));
    if (!inventoryItem) continue;

    const restoreQty = prod.quantity || 1;
    let variantLabel = '';

    if (inventoryItem.variants && Array.isArray(inventoryItem.variants) && inventoryItem.variants.length > 0) {
      let updatedVariants = [...inventoryItem.variants];
      if (prod.color || prod.size) {
        const matchIdx = updatedVariants.findIndex(v =>
          (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
          (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase()))
        );
        if (matchIdx >= 0) {
          const current = updatedVariants[matchIdx].stock || 0;
          updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: current + restoreQty };
          variantLabel = `${updatedVariants[matchIdx].color || ''} ${updatedVariants[matchIdx].size || ''}`.trim();
        }
      }
      const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
      operations.push(
        prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { variants: updatedVariants, stock: newTotalStock }
        })
      );
    } else {
      operations.push(
        prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { stock: { increment: restoreQty } }
        })
      );
    }
    auditEntries.push({ name: inventoryItem.name, qty: restoreQty, label: variantLabel, id: inventoryItem.id });
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  for (const entry of auditEntries) {
    await createAuditLog(order.id, 'INVENTORY_RESTORED', `Restored ${entry.qty} unit(s) of ${entry.name}${entry.label ? ' (' + entry.label + ')' : ''} to stock (order deletion reversal). Product ID: ${entry.id}`, userId);
  }
};

const deleteOrder = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user?.id;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // 1. Restore inventory at variant level
    await restoreInventoryForDeletion(order, userId);

    // 2. Create audit record before deletion
    const deletedRecord = await prisma.deletedOrder.create({
      data: {
        orderNumber: order.orderNumber,
        source: order.source === 'ONLINE' ? 'ONLINE ORDER' : (order.outletName || order.source),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        productDetails: order.productDetails,
        totalPrice: order.totalPrice || 0,
        deletedAt: new Date(),
        deletedById: userId
      }
    });

    // 3. Delete child records
    await prisma.orderEditRequest.deleteMany({ where: { orderId } });
    await prisma.orderStage.deleteMany({ where: { orderId } });
    await prisma.auditLog.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, deleted: true, orderNumber: order.orderNumber });

    res.json({ message: 'Order deleted permanently. Inventory restored.', deletedRecord });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Error deleting order', error: error.message });
  }
};

const getDeletedOrders = async (req, res) => {
  try {
    const { source, limit } = req.query;
    const where = {};
    if (source) where.source = { contains: source, mode: 'insensitive' };

    const records = await prisma.deletedOrder.findMany({
      where,
      include: {
        deletedBy: { select: { id: true, name: true } }
      },
      orderBy: { deletedAt: 'desc' },
      take: limit === 'all' ? undefined : (parseInt(limit) || 200)
    });

    res.json(records);
  } catch (error) {
    console.error('Get deleted orders error:', error);
    res.status(500).json({ message: 'Error fetching deleted orders', error: error.message });
  }
};

const checkDeletedOrder = async (req, res) => {
  try {
    const { number, source } = req.query;
    if (!number) return res.status(400).json({ message: 'Order number is required' });

    const whereClause = {
      OR: [
        { orderNumber: { equals: number, mode: 'insensitive' } },
        { id: number }
      ]
    };

    // Data isolation: if source is provided, only return orders matching that source
    if (source) {
      whereClause.source = { equals: source, mode: 'insensitive' };
    }

    const deleted = await prisma.deletedOrder.findFirst({
      where: whereClause,
      select: {
        orderNumber: true,
        source: true,
        customerName: true,
        deletedAt: true,
        deletedBy: { select: { name: true } }
      }
    });

    if (!deleted) return res.status(404).json({ message: 'Order not found in deleted records' });

    res.json(deleted);
  } catch (error) {
    console.error('Check deleted order error:', error);
    res.status(500).json({ message: 'Error checking deleted order', error: error.message });
  }
};

const updateDeliveryStatus = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryStatus, remarks, paymentMethod, cashAmount, onlineAmount, deliveryMethod } = req.body; // deliveryStatus: 'DELIVERED' | 'NOT_RESPONDED' | 'FAILED' | 'RESCHEDULED'
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

      await prisma.deliveryAttempt.create({
        data: {
          orderId,
          attemptNumber: currentAttempt,
          status: 'NO_RESPONSE',
          riderId: userId,
          riderName,
          rescheduledTo: currentAttempt < 3 ? tomorrow : null,
          notes: remarks || 'Customer did not respond'
        }
      });

      if (currentAttempt < 3) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            dispatchStatus: 'RESCHEDULED',
            noResponseCount: currentAttempt,
            nextDeliveryDate: tomorrow,
            lastDeliveryAttempt: new Date(),
            updatedAt: new Date()
          }
        });
        const outStage = await prisma.orderStage.findFirst({
          where: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING' }
        });
        if (outStage) {
          await prisma.orderStage.update({
            where: { id: outStage.id },
            data: { deadlineAt: tomorrow }
          });
        }
        await createAuditLog(orderId, 'DELIVERY_FAILED',
          `No Response (Attempt ${currentAttempt}/3). Auto-rescheduled to ${tomorrow.toLocaleDateString()}.`, userId);
      } else {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            dispatchStatus: 'FAILED',
            noResponseCount: currentAttempt,
            lastDeliveryAttempt: new Date(),
            status: 'MAX_ATTEMPTS_REACHED',
            updatedAt: new Date()
          }
        });
        await createAuditLog(orderId, 'DELIVERY_FAILED',
          `No Response (Attempt ${currentAttempt}/3). Maximum delivery attempts reached. Awaiting manual action.`, userId);
      }
    } else if (deliveryStatus === 'RESCHEDULED') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const outStage = await prisma.orderStage.findFirst({
        where: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING' }
      });
      if (outStage) {
        await prisma.orderStage.update({
          where: { id: outStage.id },
          data: { deadlineAt: tomorrow }
        });
      }
      await prisma.order.update({
        where: { id: orderId },
        data: { dispatchStatus: 'RESCHEDULED', nextDeliveryDate: tomorrow, updatedAt: new Date() }
      });
      await createAuditLog(orderId, 'DELIVERY_RESCHEDULED', remarks || `Delivery rescheduled to ${tomorrow.toLocaleDateString()}.`, userId);
    } else if (deliveryStatus === 'DELIVERED') {
      // Handle half-cash-half-online payment
      let courierDetails = order.courierDetails || {};
      if (typeof courierDetails === 'string') courierDetails = JSON.parse(courierDetails);
      if (!courierDetails.payments) courierDetails.payments = [];

      if (paymentMethod === 'HALF_CASH_HALF_ONLINE') {
        courierDetails.payments.push({
          method: 'CASH',
          amount: parseFloat(cashAmount || 0),
          date: new Date().toISOString(),
          recordedBy: userId
        }, {
          method: 'ONLINE_TRANSFER',
          amount: parseFloat(onlineAmount || 0),
          date: new Date().toISOString(),
          recordedBy: userId
        });
      } else {
        courierDetails.payments.push({
          method: paymentMethod || 'CASH',
          amount: order.totalPrice || 0,
          date: new Date().toISOString(),
          recordedBy: userId
        });
      }

      const totalPaid = courierDetails.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const paymentStatus = totalPaid >= (order.totalPrice || 0) ? 'FULL_PAID' : 'PARTIAL_PAID';

      const updateData = {
        status: 'COMPLETED',
        currentStage: 'DELIVERED',
        paymentStatus,
        advancePaid: true,
        dispatchStatus: 'DELIVERED',
        paymentMethod: paymentMethod || 'CASH',
        courierDetails,
        deliveredAt: new Date(),
        updatedAt: new Date()
      };
      if (deliveryMethod) updateData.deliveryMethod = deliveryMethod;
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: updateData,
        include: { stages: true }
      });
      await prisma.deliveryAttempt.create({
        data: {
          orderId,
          attemptNumber: (order.noResponseCount || 0) + 1,
          status: 'DELIVERED',
          riderId: userId,
          riderName,
          notes: remarks || 'Order delivered successfully'
        }
      });
      await calculateAndRecordRevenue(updatedOrder);
      await createAuditLog(orderId, 'DELIVERED', remarks || 'Order delivered to customer', userId);

      const io = req.app.get('io');
      io.emit('order-updated', { order: updatedOrder, createdById: order.createdById });
      return res.json(updatedOrder);
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() }
    });

    await createAuditLog(orderId, 'DELIVERY_STATUS_UPDATED', `Delivery status: ${deliveryStatus}. ${remarks || ''}`, userId);

    const io = req.app.get('io');
    const freshOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'desc' } } }
    });
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
    if (await isSystemPaused()) {
      return res.status(503).json({ message: 'System is paused for holidays.' });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.dispatchStatus === 'DELIVERED') return res.status(400).json({ message: 'Order already delivered' });
    if (order.riderAcceptedAt) return res.status(400).json({ message: 'Order already accepted by a rider' });

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        riderAcceptedAt: new Date(),
        dispatchStatus: 'ACCEPTED',
        updatedAt: new Date()
      },
      include: { stages: { orderBy: { createdAt: 'desc' } } }
    });

    await createAuditLog(orderId, 'DELIVERY_ACCEPTED', `Rider accepted delivery order`, userId);

    const io = req.app.get('io');
    io.emit('order-updated', { order: updatedOrder, createdById: order.createdById });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Accept delivery error:', error);
    res.status(500).json({ message: 'Error accepting delivery', error: error.message });
  }
};

const getDeliveryHistory = async (req, res) => {
  const { orderId } = req.params;

  try {
    const attempts = await prisma.deliveryAttempt.findMany({
      where: { orderId },
      orderBy: { attemptNumber: 'asc' }
    });
    res.json(attempts);
  } catch (error) {
    console.error('Delivery history error:', error);
    res.status(500).json({ message: 'Error fetching delivery history', error: error.message });
  }
};

const refundOrder = async (req, res) => {
  const { orderId } = req.params;
  const { reason, note } = req.body;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'REQUESTED',
        refundReason: reason || 'Not specified',
        refundNote: note || '',
        refundedAt: new Date(),
        refundedById: req.user.id,
        dispatchStatus: 'RETURNED',
        currentStage: 'RETURNED',
        status: 'RETURNED',
        updatedAt: new Date()
      }
    });

    await createAuditLog(orderId, 'REFUND_REQUESTED', `Refund requested by ${req.user.name || 'Delivery'}. Reason: ${reason || 'N/A'}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: 'Refund requested successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error processing refund request', error: error.message });
  }
};

const getRefundQueue = async (req, res) => {
  try {
    const role = String(req.user.role || '').toUpperCase().trim();
    let where = {
      refundStatus: { not: 'NONE' },
      OR: [
        { dispatchStatus: { in: ['FAILED', 'RETURNED'] } },
        { refundStatus: 'REQUESTED' },
        { currentStage: { in: ['OUT_FOR_DELIVERY', 'DISPATCH', 'RETURNED'] } }
      ]
    };

    // FAISAL: only see their own online orders
    if (role === 'FAISAL') {
      where.createdById = req.user.id;
      where.source = { in: ['ONLINE', 'INTERNAL'] };
    }

    const limit = parseInt(req.query.limit) || 200;
    const orders = await prisma.order.findMany({
      where,
      include: {
        stages: { orderBy: { createdAt: 'desc' }, take: 5, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { refundedAt: 'desc' },
      take: limit
    });

    res.json(orders || []);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching refund queue', error: error.message });
  }
};

const reverseInventoryForRefund = async (order, userId) => {
  let parsedDetails;
  try {
    parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
  } catch { return; }
  if (!parsedDetails) return;

  const { inventoryItems, productionItems } = await classifyOrderItems(order);

  // Reverse production items — remove from inventory (they were added via addOrderToInventory)
  for (const prod of productionItems) {
    const qty = prod.quantity || 1;
    const inventoryItem = prod.inventoryItem || await prisma.inventoryItem.findFirst({
      where: { name: { contains: prod.productType, mode: 'insensitive' } }
    });
    if (!inventoryItem) continue;

    if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
      let updatedVariants = [...inventoryItem.variants];
      const matchIdx = updatedVariants.findIndex(v =>
        (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
        (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase()))
      );
      if (matchIdx >= 0) {
        updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: Math.max(0, (updatedVariants[matchIdx].stock || 0) - qty) };
      }
      const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { variants: updatedVariants, stock: newTotalStock }
      });
    } else {
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { stock: { decrement: Math.min(qty, inventoryItem.stock) } }
      });
    }
  }

  // Reverse inventory items — add back to stock (they were deducted via deductInventoryItems)
  for (const prod of inventoryItems) {
    const qty = prod.quantity || 1;
    const inventoryItem = prod.inventoryItem;
    if (!inventoryItem) continue;

    if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
      let updatedVariants = [...inventoryItem.variants];
      const matchIdx = updatedVariants.findIndex(v =>
        (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
        (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase()))
      );
      if (matchIdx >= 0) {
        updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: (updatedVariants[matchIdx].stock || 0) + qty };
      } else {
        updatedVariants.push({ color: prod.color || '', size: prod.size || '', stock: qty, price: 0 });
      }
      const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { variants: updatedVariants, stock: newTotalStock }
      });
    } else {
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { stock: { increment: qty } }
      });
    }
  }

  // Clean up production records
  await prisma.productionRecord.deleteMany({ where: { orderId: order.id } }).catch(() => {});

  const reversed = [
    ...productionItems.map(p => `${p.productType} x${p.quantity} (removed)`),
    ...inventoryItems.map(p => `${p.productType} x${p.quantity} (restored)`)
  ];
  if (reversed.length > 0) {
    await createAuditLog(order.id, 'INVENTORY_REVERSED', `Inventory reversed for refund: ${reversed.join(', ')}`, userId);
  }
};

const processRefund = async (req, res) => {
  const { orderId } = req.params;
  const { action, note } = req.body; // action: 'PROCESSING' | 'REFUNDED'
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let refundStatus = action === 'REFUNDED' ? 'REFUNDED' : 'PROCESSING';
    let auditAction = action === 'REFUNDED' ? 'REFUND_COMPLETED' : 'REFUND_PROCESSING';
    let auditMessage = action === 'REFUNDED'
      ? `Refund completed by ${req.user.name}. Note: ${note || 'N/A'}`
      : `Refund processing started by ${req.user.name}. Note: ${note || 'N/A'}`;
    let updateData = {
      refundStatus,
      refundNote: note || order.refundNote || '',
      updatedAt: new Date()
    };

    if (action === 'REFUNDED') {
      updateData.dispatchStatus = 'REFUNDED';
      updateData.currentStage = 'REFUNDED';
      updateData.status = 'REFUNDED';

      // Reverse inventory if it was previously added
      const inventoryAdded = await prisma.auditLog.findFirst({
        where: { orderId, action: 'INVENTORY_ADDED' }
      });
      if (inventoryAdded) {
        try {
          await reverseInventoryForRefund(order, req.user.id);
          auditMessage += '; Inventory reversed.';
        } catch (invErr) {
          console.error('Failed to reverse inventory:', invErr);
        }
      }

      // Delete revenue record to reverse the amount
      try {
        await prisma.revenueRecord.deleteMany({ where: { orderId } });
        await prisma.order.update({
          where: { id: orderId },
          data: { grossProfit: 0, netProfit: 0 }
        });
        auditMessage += '; Revenue reversed.';
      } catch (revErr) {
        console.error('Failed to delete revenue record:', revErr);
      }
    }

    await prisma.order.update({ where: { id: orderId }, data: updateData });
    await createAuditLog(orderId, auditAction, auditMessage, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: `Refund ${action === 'REFUNDED' ? 'completed' : 'processing started'}` });
  } catch (error) {
    res.status(500).json({ message: 'Error processing refund', error: error.message });
  }
};

// ====== BULK ROUTING ======
const bulkRouteOrders = async (req, res) => {
  const { orderIds, destinationStage, remarks } = req.body;
  try {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'orderIds must be a non-empty array' });
    }
    if (!destinationStage) {
      return res.status(400).json({ message: 'destinationStage is required' });
    }

    const results = [];
    const errors = [];

    for (const orderId of orderIds) {
      try {
        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
        if (!order) { errors.push({ orderId, error: 'Order not found' }); continue; }

        const currentStage = order.stages.find(s =>
          ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
        );

        if (currentStage && !['SUPER_ADMIN', 'STORE', 'STORE_EMPLOYEE'].includes(req.user.role)) {
          const validation = validateStageTransition(currentStage.stageName, destinationStage, order.type);
          if (!validation.valid) {
            errors.push({ orderId, error: validation.message });
            continue;
          }
        }

        // Complete current stage
        if (currentStage) {
          await prisma.orderStage.update({
            where: { id: currentStage.id },
            data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Bulk routed to ${destinationStage}` }
          });
        }

        // Create destination stage
        const durations = await getStageDurations(order.priority);
        const deadline = calculateDeadline(new Date(), durations[destinationStage] || 24);
        await prisma.orderStage.create({
          data: { orderId, stageName: destinationStage, status: 'PENDING', deadlineAt: deadline }
        });

        await prisma.order.update({
          where: { id: orderId },
          data: { currentStage: destinationStage, status: 'IN_PROGRESS' }
        });

        // Routing history
        const recipientUsers = await prisma.user.findMany({
          where: { role: { in: getRolesForStage(destinationStage) } },
          select: { id: true }
        });
        await prisma.routingHistory.create({
          data: {
            orderId,
            sentByUserId: req.user.id,
            sentToStage: destinationStage,
            sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
            previousStage: currentStage?.stageName || 'UNKNOWN',
            newStage: destinationStage,
            remarks: remarks || `Bulk route to ${destinationStage} by ${req.user.name}`,
            createdAt: new Date()
          }
        }).catch(() => {});

        // Reset seen status for recipients
        await prisma.seenTask.deleteMany({
          where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: destinationStage }
        }).catch(() => {});

        await createAuditLog(orderId, 'BULK_ROUTE', `Bulk routed from ${currentStage?.stageName || 'UNKNOWN'} to ${destinationStage} by ${req.user.name}`, req.user.id);

        const io = req.app.get('io');
        io.emit('order-updated', { orderId, createdById: order.createdById });

        results.push({ orderId, status: 'routed', nextStage: destinationStage });
      } catch (err) {
        errors.push({ orderId, error: err.message });
      }
    }

    res.json({ message: `Routed ${results.length} order(s) with ${errors.length} error(s)`, results, errors });
  } catch (error) {
    res.status(500).json({ message: 'Error in bulk routing', error: error.message });
  }
};

const classifyOrderItems = async (order, itemList = null) => {
  let parsedDetails;
  try {
    parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
  } catch {
    return { inventoryItems: [], productionItems: [] };
  }
  const items = itemList || (Array.isArray(parsedDetails) ? parsedDetails : (parsedDetails?.productType ? [parsedDetails] : []));

  const inventoryItems = [];
  const productionItems = [];

  // Batch-fetch all inventory items in a single query
  const productTypes = items.map(item => (item.productDetails || item)?.productType).filter(Boolean);
  const uniqueTypes = [...new Set(productTypes)];
  const allInvItems = uniqueTypes.length > 0
    ? await prisma.inventoryItem.findMany({
        where: {
          category: { not: 'FABRIC' },
          OR: uniqueTypes.map(name => ({ name: { contains: name, mode: 'insensitive' } }))
        },
        select: { id: true, name: true, stock: true, variants: true, category: true }
      })
    : [];

  for (const item of items) {
    const pd = item.productDetails || item;
    const productType = pd?.productType;
    if (!productType) continue;

    const quantity = item.quantity || 1;
    const invItem = allInvItems.find(inv => inv.name.toLowerCase().includes(productType.toLowerCase()));

    if (invItem) {
      inventoryItems.push({ productType, quantity, color: pd.color, size: pd.size, inventoryItem: invItem });
    } else {
      productionItems.push({ productType, quantity, color: pd.color, size: pd.size });
    }
  }

  return { inventoryItems, productionItems };
};

const deductInventoryItems = async (order, userId, itemList) => {
  if (!order || !itemList?.length) return;

  const operations = [];

  for (const prod of itemList) {
    const inventoryItem = prod.inventoryItem;
    if (!inventoryItem) continue;

    const deductQty = prod.quantity || 1;
    let variantLabel = '';

    if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
      let updatedVariants = [...inventoryItem.variants];
      let deducted = 0;

      if (prod.color || prod.size) {
        const matchIdx = updatedVariants.findIndex(v =>
          (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
          (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase()))
        );
        if (matchIdx >= 0) {
          const available = updatedVariants[matchIdx].stock || 0;
          if (available >= deductQty) {
            updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: available - deductQty };
            variantLabel = `${updatedVariants[matchIdx].color || ''} ${updatedVariants[matchIdx].size || ''}`.trim();
            deducted = deductQty;
          }
        }
      }

      if (deducted <= 0) continue;

      const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
      operations.push(
        prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { variants: updatedVariants, stock: newTotalStock }
        })
      );
    } else {
      const actualDeduct = Math.min(deductQty, inventoryItem.stock);
      operations.push(
        prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { stock: { decrement: actualDeduct } }
        })
      );
    }
  }

  if (operations.length === 0) return;

  await prisma.$transaction(operations);

  const auditLogs = itemList.map(prod => {
    const inventoryItem = prod.inventoryItem;
    if (!inventoryItem) return null;
    const deductQty = prod.quantity || 1;
    return createAuditLog(order.id, 'INVENTORY_DEDUCTED', `Deducted ${deductQty} unit(s) of ${inventoryItem.name} from stock (non-manufactured item fulfillment). Product ID: ${inventoryItem.id}`, userId);
  }).filter(Boolean);

  await Promise.all(auditLogs);
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

    const deductQty = prod.quantity || 1;
    let variantLabel = '';

    // If item has variants, deduct ONLY from the exact matching variant
    if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
      let updatedVariants = [...inventoryItem.variants];
      let deducted = 0;

      if (prod.color || prod.size) {
        const matchIdx = updatedVariants.findIndex(v =>
          (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
          (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase()))
        );
        if (matchIdx >= 0) {
          const available = updatedVariants[matchIdx].stock || 0;
          if (available >= deductQty) {
            updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: available - deductQty };
            variantLabel = `${updatedVariants[matchIdx].color || ''} ${updatedVariants[matchIdx].size || ''}`.trim();
            deducted = deductQty;
          }
        }
      }

      if (deducted <= 0) {
        // Skip — no exact variant match or insufficient stock for that variant
        continue;
      }

      const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { variants: updatedVariants, stock: newTotalStock }
      });
    } else {
      // Legacy item without variants — simple decrement
      const actualDeduct = Math.min(deductQty, inventoryItem.stock);
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { stock: { decrement: actualDeduct } }
      });
    }
    await createAuditLog(order.id, 'INVENTORY_DEDUCTED', `Deducted ${deductQty} unit(s) of ${inventoryItem.name}${variantLabel ? ' (' + variantLabel + ')' : ''} from stock (order fulfillment). Product ID: ${inventoryItem.id}`, userId);
  }
};

const addOrderToInventory = async (req, res) => {
  const { orderId } = req.params;
  try {
    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (e) {
      if (e?.code === 'P2021') return res.status(503).json({ message: 'DB schema outdated — run npx prisma db push' });
      throw e;
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Check via audit log if inventory was already added
    const alreadyAdded = await prisma.auditLog.findFirst({
      where: { orderId, action: 'INVENTORY_ADDED' }
    });
    if (alreadyAdded) return res.status(400).json({ message: 'Inventory already added for this order' });

    // Determine which items to add — only production-manufactured items
    const { productionItems } = await classifyOrderItems(order);
    const productionProductTypes = productionItems.map(p => p.productType.toLowerCase());

    let parsedDetails;
    try {
      parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
    } catch {
      return res.status(400).json({ message: 'Invalid product details' });
    }
    if (!parsedDetails) return res.status(400).json({ message: 'No product details found' });

    const productsToAdd = [];
    const addItemIfProduction = (pd, quantity) => {
      if (!pd?.productType) return;
      const ptLower = (pd.productType || '').toLowerCase();
      if (productionProductTypes.length === 0 || productionProductTypes.some(ppt => ptLower.includes(ppt) || ppt.includes(ptLower))) {
        productsToAdd.push({ productType: pd.productType, quantity, color: pd.color, size: pd.size });
      }
    };

    if (Array.isArray(parsedDetails)) {
      parsedDetails.forEach(item => {
        addItemIfProduction(item.productDetails || item, item.quantity || 1);
      });
    } else if (parsedDetails?.productType) {
      addItemIfProduction(parsedDetails, order.quantity || 1);
    }

    if (productsToAdd.length === 0) {
      return res.status(400).json({ message: 'No production items to add to inventory' });
    }

    const addedItems = [];
    for (const prod of productsToAdd) {
      const qty = prod.quantity || 1;
      let inventoryItem = await prisma.inventoryItem.findFirst({
        where: { name: { contains: prod.productType, mode: 'insensitive' } }
      });

      if (inventoryItem) {
        if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
          let updatedVariants = [...inventoryItem.variants];
          const matchIdx = updatedVariants.findIndex(v =>
            (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
            (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase()))
          );
          if (matchIdx >= 0) {
            updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: (updatedVariants[matchIdx].stock || 0) + qty };
          } else {
            updatedVariants.push({ color: prod.color || '', size: prod.size || '', stock: qty, price: 0 });
          }
          const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { variants: updatedVariants, stock: newTotalStock }
          });
        } else {
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { stock: { increment: qty } }
          });
        }
        addedItems.push({ name: inventoryItem.name, quantity: qty, action: 'updated' });
      } else {
        inventoryItem = await prisma.inventoryItem.create({
          data: {
            name: prod.productType,
            category: 'PRODUCTION',
            stock: qty,
            color: prod.color || null,
            size: prod.size || null,
            price: 0,
            variants: prod.color || prod.size ? [{ color: prod.color || '', size: prod.size || '', stock: qty, price: 0 }] : null
          }
        });
        addedItems.push({ name: inventoryItem.name, quantity: qty, action: 'created' });
      }
    }

    await createAuditLog(orderId, 'INVENTORY_ADDED', `Products added to store inventory from production: ${addedItems.map(i => `${i.name} x${i.quantity} (${i.action})`).join(', ')}`, req.user.id);

    // Also add to production inventory records
    const orderSource = order.source === 'ONLINE' || order.source === 'INTERNAL' ? 'ONLINE' : 'OUTLET';
    for (const prod of productsToAdd) {
      const productName = prod.productType;
      const qty = prod.quantity || 1;
      const rawCost = parseFloat(order.productCost || 0) / productsToAdd.length;
      const prodCost = parseFloat(order.productionCost || 0) / productsToAdd.length;
      const totalCost = rawCost + prodCost;
      const sellVal = parseFloat(order.totalPrice || 0) / productsToAdd.length;
      const profit = sellVal - totalCost;
      try {
        await prisma.productionRecord.create({
          data: {
            productName, quantity: qty, rawMaterialCost: rawCost, productionCost: prodCost,
            totalCost, sellingValue: sellVal, profit, source: orderSource,
            orderId: order.id, notes: 'Added to inventory by Store',
            productionDate: new Date()
          }
        });
      } catch (e) { if (e?.code !== 'P2021') throw e; }
      try {
        const existing = await prisma.productionInventory.findFirst({
          where: { orderId: order.id }
        });
        if (existing) {
          await prisma.productionInventory.update({
            where: { id: existing.id },
            data: { quantity: { increment: qty }, profitMargin: sellVal > 0 ? ((sellVal - totalCost) / sellVal) * 100 : 0 }
          });
        } else {
          await prisma.productionInventory.create({
            data: {
              productName, category: getProductCategory(prod.productType), quantity: qty,
              productionCost: prodCost, sellingValue: sellVal,
              profitMargin: sellVal > 0 ? ((sellVal - totalCost) / sellVal) * 100 : 0,
              source: orderSource, orderId: order.id, productionDate: new Date()
            }
          });
        }
      } catch (e) { if (e?.code !== 'P2021') throw e; }
    }

    // Mark produced items in productDetails as 'produced'
    try {
      let pd = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
      if (pd) {
        const updated = Array.isArray(pd)
          ? pd.map(item => {
              if (item.availabilityStatus === 'not_available') {
                return { ...item, availabilityStatus: 'produced' };
              }
              return item;
            })
          : pd.productType && pd.availabilityStatus === 'not_available'
            ? { ...pd, availabilityStatus: 'produced' }
            : pd;
        await prisma.order.update({
          where: { id: orderId },
          data: { productDetails: JSON.stringify(updated) }
        });
      }
    } catch (pdErr) {
      console.error('Failed to update productDetails availabilityStatus:', pdErr);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('inventory-updated', { source: 'production', orderId });
      io.emit('order-updated', { orderId, createdById: order.createdById });
    }

    res.json({ message: 'Products added to inventory successfully', items: addedItems });
  } catch (error) {
    res.status(500).json({ message: 'Error adding to inventory', error: error.message });
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

    let parsedDetails;
    try {
      parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
    } catch {
      return res.json({ orderId: order.id, orderNumber: order.orderNumber, report: [], summary: { totalItems: 0, available: 0, insufficient: 0, outOfStock: 0, inventoryItems: 0, productionItems: 0 } });
    }
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

    // Batch-fetch all inventory items in a single query
    const productTypes = productsToCheck.map(p => p.productType).filter(Boolean);
    const uniqueTypes = [...new Set(productTypes)];
    let allInvItems = [];
    if (uniqueTypes.length > 0) {
      try {
        allInvItems = await prisma.inventoryItem.findMany({
          where: {
            category: { not: 'FABRIC' },
            OR: uniqueTypes.map(name => ({ name: { contains: name, mode: 'insensitive' } }))
          },
          select: { id: true, name: true, stock: true, variants: true, category: true }
        });
      } catch (dbErr) {
        console.error('InventoryItem query failed:', dbErr);
      }
    }

    for (const prod of productsToCheck) {
      try {
        const inventoryItem = allInvItems.find(inv => inv.name.toLowerCase().includes(prod.productType.toLowerCase()));

        if (!inventoryItem) {
          report.push({
            itemName: prod.productType,
            requiredQty: prod.quantity,
            availableQty: 0,
            status: 'not_found',
            classification: 'production',
            variants: []
          });
          continue;
        }

        const positiveVariants = inventoryItem.variants && Array.isArray(inventoryItem.variants)
          ? inventoryItem.variants.filter(v => (v.stock || 0) > 0)
          : [];

        let availableQty = 0;
        let variantDetails = [];
        if (positiveVariants.length > 0) {
          const hasColorSpec = !!prod.color;
          const hasSizeSpec = !!prod.size;
          const matchedVariants = positiveVariants.filter(v => {
            if (hasColorSpec && v.color && v.color.toLowerCase() !== prod.color.toLowerCase()) return false;
            if (hasSizeSpec && v.size && v.size.toLowerCase() !== prod.size.toLowerCase()) return false;
            return true;
          });
          variantDetails = matchedVariants.map(v => ({
            color: v.color,
            size: v.size,
            stock: v.stock || 0
          }));
          availableQty = matchedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        } else if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
          variantDetails = inventoryItem.variants.map(v => ({
            color: v.color,
            size: v.size,
            stock: v.stock || 0
          }));
          availableQty = 0;
        } else {
          availableQty = (inventoryItem.stock || 0) > 0 ? (inventoryItem.stock || 0) : 0;
        }

        let status = 'available';
        if (availableQty === 0) status = 'out_of_stock';
        else if (availableQty < prod.quantity) status = 'insufficient';

        const classification = 'production';
        report.push({
          itemId: inventoryItem.id,
          itemName: inventoryItem.name,
          category: inventoryItem.category,
          requiredQty: prod.quantity,
          availableQty,
          status,
          classification,
          variants: variantDetails,
          requestedColor: prod.color,
          requestedSize: prod.size,
          customization: prod.customization
        });
      } catch {
        report.push({
          itemName: prod.productType,
          requiredQty: prod.quantity,
          availableQty: 0,
          status: 'not_found',
          classification: 'production',
          variants: []
        });
      }
    }

    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      report,
      summary: {
        totalItems: report.length,
        available: report.filter(r => r.status === 'available').length,
        insufficient: report.filter(r => r.status === 'insufficient').length,
        outOfStock: report.filter(r => r.status === 'out_of_stock' || r.status === 'not_found').length,
        inventoryItems: report.filter(r => r.classification === 'inventory').length,
        productionItems: report.filter(r => r.classification === 'production').length
      }
    });
  } catch (error) {
    console.error('checkOrderInventory error:', error);
    res.status(500).json({ message: 'Error checking inventory', error: error.message, stack: error.stack });
  }
};

const getOutletAnalytics = async (req, res) => {
  try {
    const { outletName, dateFrom, dateTo } = req.query;
    
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.lte = new Date(dateTo);
    }

    const orderWhere = { ...dateFilter };
    if (outletName) orderWhere.outletName = outletName;

    const [totalOrders, completedOrders, pendingOrders, inProgressOrders, cancelledOrders, revenueAgg, outletNames] = await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.count({ where: { ...orderWhere, status: 'COMPLETED' } }),
      prisma.order.count({ where: { ...orderWhere, status: 'PENDING' } }),
      prisma.order.count({ where: { ...orderWhere, status: 'IN_PROGRESS' } }),
      prisma.order.count({ where: { ...orderWhere, status: { in: ['CANCELLED', 'REJECTED'] } } }),
      prisma.order.aggregate({ where: { ...orderWhere, status: { in: ['COMPLETED', 'DELIVERED'] } }, _sum: { totalPrice: true }, _avg: { totalPrice: true } }),
      outletName ? Promise.resolve([]) : prisma.order.groupBy({
        by: ['outletName'],
        _count: { id: true },
        where: { outletName: { not: null } },
        orderBy: { _count: { id: 'desc' } }
      })
    ]);

    // Recent orders for the outlet
    const recentOrders = await prisma.order.findMany({
      where: orderWhere,
      select: { id: true, orderNumber: true, customerName: true, totalPrice: true, status: true, priority: true, createdAt: true, outletName: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      summary: {
        totalOrders,
        completedOrders,
        pendingOrders,
        inProgressOrders,
        cancelledOrders,
        totalRevenue: revenueAgg._sum.totalPrice || 0,
        avgOrderValue: revenueAgg._avg.totalPrice || 0
      },
      outlets: outletNames ? outletNames.map(o => ({ name: o.outletName, orderCount: o._count.id })) : [{ name: outletName, orderCount: totalOrders }],
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching outlet analytics', error: error.message });
  }
};

const calculateAndRecordRevenue = async (order) => {
  try {
    const productCost = order.productCost || 0;
    const logoCharges = order.logoCharges || 0;
    const namePrintingCharges = order.namePrintingCharges || 0;
    const customizationCharges = order.customizationPrice || 0;
    const productionCost = order.productionCost || 0;
    const totalCost = productCost + logoCharges + namePrintingCharges + customizationCharges + productionCost;
    const totalRevenue = order.totalPrice || 0;
    const totalProfit = totalRevenue - totalCost;

    await prisma.order.update({
      where: { id: order.id },
      data: { grossProfit: totalProfit, netProfit: totalProfit - (logoCharges + namePrintingCharges + customizationCharges) }
    });

    // Only create revenue record if one doesn't already exist for this order (prevents duplicates for prepaid orders)
    const existingRecord = await prisma.revenueRecord.findFirst({ where: { orderId: order.id } });
    if (!existingRecord) {
      await prisma.revenueRecord.create({
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.type,
        source: order.source === 'INTERNAL' || order.source === 'ONLINE' ? 'ONLINE' : 'OUTLET',
        outletName: order.outletName,
        orderAmount: totalRevenue,
        productCost,
        logoCharges,
        namePrintingCharges,
        customizationCharges,
        productionCost,
        totalRevenue,
        totalProfit
      }
    });
    }
  } catch (err) {
    console.error('Revenue calculation error:', err);
  }
};

// ====== MANUAL ROUTING ======
const manualRouteOrder = async (req, res) => {
  const { orderId } = req.params;
  let { destinationStage, remarks } = req.body;
  // Auto-correct common shorthand
  if (destinationStage === 'LOGO') destinationStage = 'LOGO_DESIGN';

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Complete current active stage
    const currentStage = order.stages.find(s =>
      ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
    );

    // Enforce forward-only routing to prevent loops (except for SUPER_ADMIN, STORE, STORE_EMPLOYEE)
    if (currentStage && !['SUPER_ADMIN', 'STORE', 'STORE_EMPLOYEE'].includes(req.user.role)) {
      const validation = validateStageTransition(currentStage.stageName, destinationStage, order.type);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message, expectedNext: validation.expected });
      }
    }
    if (currentStage) {
      await prisma.orderStage.update({
        where: { id: currentStage.id },
        data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Routed to ${destinationStage} by ${req.user.name}` }
      });
    }

    // Create destination stage
    const durations = await getStageDurations(order.priority);
    const deadline = calculateDeadline(new Date(), durations[destinationStage] || 24);
    await prisma.orderStage.create({
      data: { orderId, stageName: destinationStage, status: 'PENDING', deadlineAt: deadline }
    });

    const isStoreRoutingBack = ['STORE', 'STORE_EMPLOYEE'].includes(req.user.role) && destinationStage !== 'DISPATCH';
    await prisma.order.update({
      where: { id: orderId },
      data: {
        currentStage: destinationStage,
        status: 'IN_PROGRESS',
        ...(isStoreRoutingBack ? { storeRequested: true, storeRequestedAt: new Date() } : {})
      }
    });

    // Record routing history
    const recipientUsers = await prisma.user.findMany({
      where: { role: { in: getRolesForStage(destinationStage) } },
      select: { id: true }
    });
    await prisma.routingHistory.create({
      data: {
        orderId,
        sentByUserId: req.user.id,
        sentToStage: destinationStage,
        sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
        previousStage: currentStage?.stageName || 'UNKNOWN',
        newStage: destinationStage,
        remarks: remarks || `Manual route by ${req.user.name}`,
        createdAt: new Date()
      }
    });

    // Reset seen status for all recipient users — single batch query
    await prisma.seenTask.deleteMany({
      where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: destinationStage }
    }).catch(() => {});

    await createAuditLog(orderId, 'MANUAL_ROUTE', `Manually routed from ${currentStage?.stageName || 'UNKNOWN'} to ${destinationStage} by ${req.user.name}. Remarks: ${remarks || 'N/A'}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: `Order routed to ${destinationStage}`, nextStage: destinationStage });
  } catch (error) {
    res.status(500).json({ message: 'Error routing order', error: error.message });
  }
};

const getRolesForStageBasedOnRole = (role) => {
  const map = {
    'STORE': ['STORE'],
    'STORE_EMPLOYEE': ['STORE'],
    'PRODUCTION': ['PRODUCTION_ACCEPTANCE', 'PRODUCTION'],
    'LOGO_DESIGN': ['LOGO_DESIGN'],
    'LOGO_DESIGN_EMPLOYEE': ['LOGO_DESIGN'],
    'LOGO_DESIGNER': ['LOGO_DESIGN'],
    'DISPATCH': ['DISPATCH'],
    'MAIN_EMPLOYEE': ['DISPATCH'],
    'OUT_FOR_DELIVERY': ['OUT_FOR_DELIVERY'],
  };
  return map[role] || [];
};

// ====== SEEN / UNSEEN ======
const markOrderAsSeen = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.id;

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await prisma.seenTask.upsert({
      where: { userId_orderId_stageName: { userId, orderId, stageName: order.currentStage } },
      update: { seenAt: new Date() },
      create: { userId, orderId, stageName: order.currentStage, seenAt: new Date() }
    });

    res.json({ message: 'Order marked as seen' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking as seen', error: error.message });
  }
};

const getStoreProductionOrders = async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 200;

  try {
    const orders = await prisma.order.findMany({
      where: {
        currentStage: 'STORE_RECEIVE',
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
      },
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    const seenRecords = await prisma.seenTask.findMany({
      where: { userId, orderId: { in: orders.map(o => o.id) }, stageName: 'STORE_RECEIVE' }
    });
    const seenOrderIds = new Set(seenRecords.map(r => r.orderId));
    
    res.json({
      unseen: orders.filter(o => !seenOrderIds.has(o.id)),
      seen: orders.filter(o => seenOrderIds.has(o.id))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching production-returned orders', error: error.message });
  }
};

const getUnseenOrders = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const limit = parseInt(req.query.limit) || 250;

  try {
    // Find orders that are in stages relevant to this user's role
    const relevantStages = getRolesForStageBasedOnRole(userRole);
    const orders = await prisma.order.findMany({
      where: {
        currentStage: { in: relevantStages },
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
      },
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
        createdBy: { select: { name: true } }
      },
      take: limit
    });

    // Check which ones have been seen
    const seenRecords = await prisma.seenTask.findMany({
      where: {
        userId,
        orderId: { in: orders.map(o => o.id) },
        stageName: { in: orders.map(o => o.currentStage) }
      }
    });
    const seenOrderIds = new Set(seenRecords.map(r => `${r.orderId}-${r.stageName}`));

    const unseen = orders.filter(o => !seenOrderIds.has(`${o.id}-${o.currentStage}`));
    const seen = orders.filter(o => seenOrderIds.has(`${o.id}-${o.currentStage}`));

    // Sort by priority then creation date (FIFO: oldest first)
    const sortOrders = (list) => list.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    res.json({ unseen: sortOrders(unseen), seen: sortOrders(seen) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unseen orders', error: error.message });
  }
};

// ====== STORE REQUESTS ======
const getStoreRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const limit = parseInt(req.query.limit) || 250;

    // Determine which source orders to return based on user role
    const isOutlet = userRole === 'OUTLET';
    const outletName = isOutlet ? req.user.name : undefined;

    const orders = await prisma.order.findMany({
      where: {
        storeRequested: true,
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] },
        ...(isOutlet ? { source: 'OUTLET', outletName } : { source: { in: ['INTERNAL', 'ONLINE'] } })
      },
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { storeRequestedAt: 'desc' },
      take: limit
    });
    
    // Seen/unseen split
    const seenRecords = await prisma.seenTask.findMany({
      where: {
        userId,
        orderId: { in: orders.map(o => o.id) },
        stageName: { in: orders.map(o => o.currentStage) }
      }
    });
    const seenOrderIds = new Set(seenRecords.map(r => `${r.orderId}-${r.stageName}`));

    const unseen = orders.filter(o => !seenOrderIds.has(`${o.id}-${o.currentStage}`));
    const seen = orders.filter(o => seenOrderIds.has(`${o.id}-${o.currentStage}`));

    res.json({ unseen, seen });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching store requests', error: error.message });
  }
};

// ====== ROUTING HISTORY ======
const getRoutingHistory = async (req, res) => {
  const { orderId } = req.params;

  try {
    const history = await prisma.routingHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        sentByUser: { select: { id: true, name: true } }
      }
    });

    // Use sentByUser relation already loaded via include
    const enriched = history.map(entry => ({
      id: entry.id,
      orderId: entry.orderId,
      sentBy: entry.sentByUser?.name || 'System',
      sentToStage: entry.sentToStage,
      previousStage: entry.previousStage,
      newStage: entry.newStage,
      remarks: entry.remarks,
      createdAt: entry.createdAt
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching routing history', error: error.message });
  }
};

// ====== STORE PROFILE ======
// Universal accept task endpoint for ANY stage
const acceptTask = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const pendingStage = order.stages.find(s =>
      ['PENDING'].includes(s.status) && getRolesForStage(s.stageName).includes(req.user.role)
    );
    if (!pendingStage) return res.status(400).json({ message: 'No pending task found for your role' });
    if (pendingStage.startedAt) return res.status(400).json({ message: 'Task already accepted' });

    const acceptedAt = new Date();
    await prisma.orderStage.update({
      where: { id: pendingStage.id },
      data: { startedAt: acceptedAt, status: 'IN_PROGRESS' }
    });

    await createAuditLog(orderId, 'STAGE_ACCEPTED',
      `Task accepted at ${pendingStage.stageName} by ${req.user.name} (Delay: ${Math.round((acceptedAt - new Date(pendingStage.createdAt)) / 60000)} min)`,
      req.user.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('order-updated', { orderId });
      io.emit('stage-accepted', { orderId, stageName: pendingStage.stageName, acceptedAt, userId: req.user.id });
    }

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json({ message: 'Task accepted', order: updated, delay: Math.round((acceptedAt - new Date(pendingStage.createdAt)) / 60000) });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting task', error: error.message });
  }
};

// Get unified order timeline (combines stages + routing history + audit logs)
const getOrderTimeline = async (req, res) => {
  const { orderId } = req.params;
  try {
    const [stages, routingHistory, auditLogs] = await Promise.all([
      prisma.orderStage.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.routingHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
        include: { sentByUser: { select: { id: true, name: true } } }
      }),
      prisma.auditLog.findMany({
        where: { orderId, action: { in: ['STAGE_ACCEPTED', 'STORE_ACCEPT', 'STORE_ROUTE', 'DELIVERY_ACCEPTED', 'INVENTORY_ADDED', 'INVENTORY_CONFIRMED', 'STORE_RETURN_TO_SOURCE'] } },
        orderBy: { timestamp: 'asc' },
        include: { user: { select: { id: true, name: true } } }
      })
    ]);

    // Build timeline entries
    const entries = [];

    // Add routing history entries
    routingHistory.forEach(rh => {
      entries.push({
        id: rh.id,
        type: 'route',
        stage: rh.sentToStage,
        timestamp: rh.createdAt,
        label: 'Routed',
        from: rh.previousStage,
        to: rh.newStage,
        actor: rh.sentByUser?.name || 'System',
        remarks: rh.remarks || null
      });
    });

    // Add stage entries with calculated delays
    stages.forEach(s => {
      const delay = s.startedAt ? Math.round((new Date(s.startedAt) - new Date(s.createdAt)) / 60000) : null;
      entries.push({
        id: s.id,
        type: 'stage',
        stage: s.stageName,
        timestamp: s.createdAt,
        label: s.status === 'COMPLETED' ? 'Completed' : s.startedAt ? 'Accepted' : 'Received',
        status: s.status,
        receivedAt: s.createdAt,
        acceptedAt: s.startedAt || null,
        completedAt: s.completedAt || null,
        delay,
        returnedFrom: s.returnedFrom || null,
        returnReason: s.returnReason || null
      });
    });

    // Add audit log entries for acceptances
    auditLogs.forEach(al => {
      entries.push({
        id: al.id,
        type: 'audit',
        stage: null,
        timestamp: al.timestamp,
        label: al.action,
        details: al.details,
        actor: al.user?.name || al.performedBy
      });
    });

    // Sort by timestamp
    entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching timeline', error: error.message });
  }
};

const acceptStoreOrder = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.currentStage !== 'STORE') return res.status(400).json({ message: 'Order is not in STORE stage' });

    const storeStage = order.stages.find(s => s.stageName === 'STORE' && s.status === 'PENDING');
    if (!storeStage) return res.status(400).json({ message: 'No pending STORE stage to accept' });
    if (storeStage.startedAt) return res.status(400).json({ message: 'Order already accepted' });

    const acceptedAt = new Date();
    await prisma.orderStage.update({
      where: { id: storeStage.id },
      data: { startedAt: acceptedAt, status: 'IN_PROGRESS' }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { storeAcceptedAt: acceptedAt }
    });

    await createAuditLog(orderId, 'STORE_ACCEPT', `Order accepted at Store by ${req.user.name}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId });

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json({ message: 'Order accepted at Store', order: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting order', error: error.message });
  }
};

const validAllStages = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'];

const storeRouteOrder = async (req, res) => {
  const { orderId } = req.params;
  let { destinationStage, remarks } = req.body;
  if (destinationStage === 'LOGO') destinationStage = 'LOGO_DESIGN';

  if (!validAllStages.includes(destinationStage) && destinationStage !== 'RETURN_TO_SOURCE') {
    return res.status(400).json({ message: `Invalid destination stage: ${destinationStage}. Must be one of: ${[...validAllStages, 'RETURN_TO_SOURCE'].join(', ')}` });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['STORE', 'STORE_RECEIVE'].includes(order.currentStage)) return res.status(400).json({ message: 'Order must be in STORE or STORE_RECEIVE stage' });

    const storeStage = order.stages.find(s =>
      ['STORE', 'STORE_RECEIVE'].includes(s.stageName) &&
      ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
    );
    if (!storeStage) {
      return res.status(400).json({ message: 'Store stage not found' });
    }

    await prisma.orderStage.update({
      where: { id: storeStage.id },
      data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Routed to ${destinationStage} by ${req.user.name}` }
    });

    if (destinationStage === 'RETURN_TO_SOURCE') {
      const sourceStage = order.source === 'OUTLET' ? 'ORDER_ENTRY' : 'ORDER_ENTRY';
      await prisma.order.update({
        where: { id: orderId },
        data: { currentStage: sourceStage, status: 'PENDING', storeAcceptedAt: null }
      });

      await createAuditLog(orderId, 'STORE_RETURN_TO_SOURCE', `Order returned to ${sourceStage} by ${req.user.name}`, req.user.id);

      const io = req.app.get('io');
      io.emit('order-updated', { orderId });

      return res.json({ message: 'Order returned to source' });
    }

    const durations = await getStageDurations(order.priority);
    const deadline = calculateDeadline(new Date(), durations[destinationStage] || 24);
    await prisma.orderStage.create({
      data: { orderId, stageName: destinationStage, status: 'PENDING', deadlineAt: deadline }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: destinationStage, status: 'IN_PROGRESS' }
    });

    const recipientUsers = await prisma.user.findMany({
      where: { role: { in: getRolesForStage(destinationStage) } },
      select: { id: true }
    });
    await prisma.routingHistory.create({
      data: {
        orderId, sentByUserId: req.user.id, sentToStage: destinationStage,
        sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
        previousStage: storeStage.stageName, newStage: destinationStage,
        remarks: remarks || `Routed from ${storeStage.stageName} by ${req.user.name}`,
        createdAt: new Date()
      }
    });

    await prisma.seenTask.deleteMany({
      where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: destinationStage }
    }).catch(() => {});

    await createAuditLog(orderId, 'STORE_ROUTE', `Routed from Store to ${destinationStage} by ${req.user.name}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId });

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json({ message: `Order routed to ${destinationStage}`, order: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error routing order from Store', error: error.message });
  }
};

const returnToStore = async (req, res) => {
  const { orderId } = req.params;
  const { returnedFrom, reason } = req.body;

  const validSources = ['PRODUCTION', 'DISPATCH'];
  if (!validSources.includes(returnedFrom)) {
    return res.status(400).json({ message: `Invalid return source. Must be one of: ${validSources.join(', ')}` });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const activeStage = order.stages.find(s =>
      ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
    );
    if (activeStage) {
      await prisma.orderStage.update({
        where: { id: activeStage.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          returnedFrom,
          returnReason: reason || `Returned from ${returnedFrom}`
        }
      });
    }

    const durations = await getStageDurations(order.priority);
    const deadline = calculateDeadline(new Date(), durations['STORE'] || 24);
    await prisma.orderStage.create({
      data: { orderId, stageName: 'STORE', status: 'PENDING', deadlineAt: deadline, returnedFrom, returnReason: reason || null }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: 'STORE', status: 'IN_PROGRESS' }
    });

    await prisma.routingHistory.create({
      data: {
        orderId, sentByUserId: req.user.id, sentToStage: 'STORE', sentToUserIds: '[]',
        previousStage: activeStage?.stageName || returnedFrom, newStage: 'STORE',
        remarks: `Returned to Store from ${returnedFrom}${reason ? ': ' + reason : ''}`,
        createdAt: new Date()
      }
    });

    await createAuditLog(orderId, 'RETURN_TO_STORE', `Returned to Store from ${returnedFrom}${reason ? ' - ' + reason : ''}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId });

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json({ message: `Order returned to Store from ${returnedFrom}`, order: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error returning order to Store', error: error.message });
  }
};

const getStoreDashboardOrders = async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 250;
  const sourceFilter = req.query.source || 'ALL';

  try {
    const whereStore = {
      currentStage: 'STORE',
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
    };
    if (sourceFilter !== 'ALL') whereStore.source = sourceFilter;

    const storeOrders = await prisma.order.findMany({
      where: whereStore,
      include: {
        stages: { orderBy: { createdAt: 'asc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    const returnedOrders = storeOrders.filter(o => o.stages.some(s => s.stageName === 'STORE' && s.returnedFrom));

    const incomingOrders = storeOrders.filter(o => o.stages.some(s => s.stageName === 'STORE' && s.status === 'PENDING' && !s.startedAt));

    const activeOrders = storeOrders.filter(o => {
      if (returnedOrders.includes(o)) return false;
      return o.stages.some(s => s.stageName === 'STORE' && s.startedAt && s.status === 'IN_PROGRESS');
    });

    const seenRecords = await prisma.seenTask.findMany({
      where: { userId, orderId: { in: storeOrders.map(o => o.id) }, stageName: 'STORE' }
    });
    const seenOrderIds = new Set(seenRecords.map(r => r.orderId));

    const markSeen = (orders) => orders.map(o => ({ ...o, isUnseen: !seenOrderIds.has(o.id) }));

    const getReturnedFrom = (from) => returnedOrders.filter(o =>
      o.stages.some(s => s.stageName === 'STORE' && s.returnedFrom === from)
    );

    res.json({
      incoming: markSeen(incomingOrders),
      active: markSeen(activeOrders),
      returnedFromLogo: markSeen(getReturnedFrom('LOGO_DESIGN')),
      returnedFromProduction: markSeen(getReturnedFrom('PRODUCTION')),
      returnedFromDispatch: markSeen(getReturnedFrom('DISPATCH')),
      total: storeOrders.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching store dashboard', error: error.message });
  }
};
// ====== DISPATCH MANAGEMENT ======
const dispatchOrder = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryMethod, trackingUrl } = req.body;
  const validMethods = ['ENAMELS', 'TCS', 'POST_EX', 'IMMENT', 'WALK_IN'];
  if (!validMethods.includes(deliveryMethod)) {
    return res.status(400).json({ message: 'Invalid delivery method. Must be ENAMELS, TCS, POST_EX, IMMENT, or WALK_IN.' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.currentStage !== 'DISPATCH') {
      return res.status(400).json({ message: 'Order is not in DISPATCH stage' });
    }

    const updateData = {
      deliveryType: deliveryMethod,
      ...(trackingUrl ? { trackingNumber: trackingUrl } : {})
    };

    if (deliveryMethod === 'ENAMELS') {
      // Complete DISPATCH stage and route to OUT_FOR_DELIVERY
      const currentStage = order.stages.find(s =>
        ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
      );
      if (currentStage) {
        await prisma.orderStage.update({
          where: { id: currentStage.id },
          data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Dispatched via Enamels Delivery` }
        });
      }

      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations['OUT_FOR_DELIVERY'] || 24);
      await prisma.orderStage.create({
        data: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING', deadlineAt: deadline }
      });

      updateData.currentStage = 'OUT_FOR_DELIVERY';
      updateData.status = 'IN_PROGRESS';

      // Routing history for ENAMELS
      const recipientUsers = await prisma.user.findMany({
        where: { role: { in: getRolesForStage('OUT_FOR_DELIVERY') } },
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
          remarks: `Dispatched via Enamels Delivery. Tracking: ${trackingUrl || 'N/A'}`,
          createdAt: new Date()
        }
      }).catch(() => {});
      await prisma.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: 'OUT_FOR_DELIVERY' }
      }).catch(() => {});

      await createAuditLog(orderId, 'DISPATCHED_ENAMELS', `Dispatched via Enamels Delivery. Tracking: ${trackingUrl || 'N/A'}`, req.user.id);
    } else if (deliveryMethod === 'IMMENT') {
      // IMMENT — stay in DISPATCH, internal processing continues
      updateData.dispatchStatus = 'IMMENT_PROCESSING';
      await createAuditLog(orderId, 'DISPATCHED_IMMENT', `Dispatched via Imment (Internal Delivery). Tracking: ${trackingUrl || 'N/A'}`, req.user.id);
    } else {
      // TCS / POST_EX / WALK_IN — advance to OUT_FOR_DELIVERY
      const currentStage = order.stages.find(s =>
        ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
      );
      if (currentStage) {
        await prisma.orderStage.update({
          where: { id: currentStage.id },
          data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Dispatched via ${deliveryMethod}` }
        });
      }

      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations['OUT_FOR_DELIVERY'] || 24);
      await prisma.orderStage.create({
        data: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING', deadlineAt: deadline }
      });

      updateData.currentStage = 'OUT_FOR_DELIVERY';
      updateData.status = 'IN_PROGRESS';
      updateData.dispatchStatus = deliveryMethod === 'WALK_IN' ? 'DELIVERED' : 'PENDING';
      if (deliveryMethod === 'WALK_IN') {
        updateData.deliveredAt = new Date();
      }

      const recipientUsers = await prisma.user.findMany({
        where: { role: { in: getRolesForStage('OUT_FOR_DELIVERY') } },
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
          remarks: `Dispatched via ${deliveryMethod}. Tracking: ${trackingUrl || 'N/A'}`,
          createdAt: new Date()
        }
      }).catch(() => {});
      await prisma.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: 'OUT_FOR_DELIVERY' }
      }).catch(() => {});

      await createAuditLog(orderId, 'DISPATCHED_COURIER', `Dispatched via ${deliveryMethod}. Tracking: ${trackingUrl || 'N/A'}`, req.user.id);
    }

    await prisma.order.update({ where: { id: orderId }, data: updateData });

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: `Order dispatched via ${deliveryMethod}`, deliveryMethod, trackingUrl });
  } catch (error) {
    res.status(500).json({ message: 'Error dispatching order', error: error.message });
  }
};

const updateDispatchStatus = async (req, res) => {
  const { orderId } = req.params;
  const { dispatchStatus } = req.body;
  const validStatuses = ['DELIVERED', 'RETURNED'];
  if (!validStatuses.includes(dispatchStatus)) {
    return res.status(400).json({ message: 'Invalid dispatch status. Must be DELIVERED or RETURNED.' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.currentStage !== 'DISPATCH') {
      return res.status(400).json({ message: 'Order is not in DISPATCH stage' });
    }
    if (!order.deliveryType || !['TCS', 'POST_EX', 'WALK_IN', 'IMMENT'].includes(order.deliveryType)) {
      return res.status(400).json({ message: 'Only TCS/Post Ex/Walk-in/Imment orders can have dispatch status updated' });
    }

    const updateData = { dispatchStatus, updatedAt: new Date() };

    if (dispatchStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      await createAuditLog(orderId, 'DISPATCH_DELIVERED', `Order delivered via ${order.deliveryType}. Tracking: ${order.trackingNumber || 'N/A'}`, req.user.id);
    } else if (dispatchStatus === 'RETURNED') {
      updateData.currentStage = 'RETURNED';
      await createAuditLog(orderId, 'DISPATCH_RETURNED', `Order returned via ${order.deliveryType}. Tracking: ${order.trackingNumber || 'N/A'}`, req.user.id);
    }

    // For IMMENT completion, also advance to OUT_FOR_DELIVERY when marked delivered
    if (order.deliveryType === 'IMMENT' && dispatchStatus === 'DELIVERED') {
      const currentStage = order.stages?.find(s =>
        ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
      );
      if (currentStage) {
        await prisma.orderStage.update({
          where: { id: currentStage.id },
          data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: 'Delivered via Imment' }
        });
      }
      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations['OUT_FOR_DELIVERY'] || 24);
      await prisma.orderStage.create({
        data: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'COMPLETED', completedAt: new Date(), deadlineAt: deadline }
      });
      updateData.currentStage = 'OUT_FOR_DELIVERY';
      updateData.status = 'COMPLETED';
    }

    await prisma.order.update({ where: { id: orderId }, data: updateData });

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: `Dispatch status updated to ${dispatchStatus}` });
  } catch (error) {
    res.status(500).json({ message: 'Error updating dispatch status', error: error.message });
  }
};

const updateProductAvailability = async (req, res) => {
  const { orderId } = req.params;
  const { productAvailability } = req.body;

  if (!productAvailability || typeof productAvailability !== 'object') {
    return res.status(400).json({ message: 'productAvailability object is required' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let parsedDetails;
    try {
      parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
    } catch {
      parsedDetails = [];
    }
    const items = Array.isArray(parsedDetails) ? parsedDetails : (parsedDetails?.productType ? [parsedDetails] : []);

    const updatedItems = items.map((item, idx) => {
      const av = productAvailability[String(idx)];
      if (av !== undefined) {
        return { ...item, availabilityStatus: av ? 'available' : 'not_available' };
      }
      return item;
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { productDetails: JSON.stringify(updatedItems) }
    });

    await createAuditLog(orderId, 'AVAILABILITY_UPDATED',
      `Product availability updated: ${Object.entries(productAvailability).map(([k, v]) => `#${parseInt(k)+1}: ${v ? 'Available' : 'Not Available'}`).join(', ')}`,
      req.user.id);

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: 'Product availability updated', items: updatedItems });
  } catch (error) {
    console.error('updateProductAvailability error:', error);
    res.status(500).json({ message: 'Error updating availability', error: error.message });
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
  getOutletAnalytics,
  cancelOrder,
  deleteOrder,
  getDeletedOrders,
  checkDeletedOrder,
  updateDeliveryStatus,
  holdOrder,
  sendForDelivery,
  updateOrderPriority,
  forceAction,
  setDeliveryType,
  checkOrderInventory,
  addOrderToInventory,
  manualRouteOrder,
  markOrderAsSeen,
  getUnseenOrders,
  getStoreProductionOrders,
  getRoutingHistory,
  getStoreRequests,
  acceptStoreOrder,
  storeRouteOrder,
  returnToStore,
  getStoreDashboardOrders,
  refundOrder,
  getRefundQueue,
  processRefund,
  bulkRouteOrders,
  dispatchOrder,
  updateDispatchStatus,
  acceptDelivery,
  getDeliveryHistory,
  acceptTask,
  getOrderTimeline,
  updateProductAvailability
};
