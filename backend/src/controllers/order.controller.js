const prisma = require('../prisma');
const { calculateDeadline } = require('../utils/deadline');
const { cache, CACHE_TTL, isSystemPaused, createAuditLog, classifyOrderItems, reverseInventoryForRefund, calculateAndRecordRevenue, syncReplacementCaseOnOrderCompletion } = require('./order-helpers');
const notify = require('../utils/notify');

const PRIORITY_ORDER = { 'SUPER_URGENT': 0, 'URGENT': 1, 'NORMAL': 2 };

// Escalation auto-log scan is slow (sequential auditLog.findFirst with a `contains`
// full-text scan per overdue stage). Run it at most once per 5 minutes per instance,
// and skip it entirely for delivery queries — the delivery dashboard has its own
// dedicated /api/delivery/orders endpoint.
const ESCALATION_CHECK_INTERVAL = 5 * 60 * 1000;
let lastEscalationCheckAt = 0;

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

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', WORKERS: 'Workers',
  LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production', STORE_RECEIVE: 'Store Receive',
  DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered',
  ENAMELS_DELIVERY: 'Enamels Delivery', OUTLET_RECEIVE: 'Outlet Receive',
  IN_DISPATCH: 'In Dispatch'
};
 
const AUTO_TRANSITION_STAGES = ['STORE', 'WORKERS', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'OUTLET_RECEIVE', 'IN_DISPATCH', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ENAMELS_DELIVERY'];

// Validates forward-only stage transitions to prevent routing loops
const validateStageTransition = (fromStage, toStage, orderType) => {
  const validTransitions = {
    'STORE': { 'STANDARD': ['LOGO_DESIGN', 'WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'], 'READY_LOGO': ['LOGO_DESIGN', 'WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'], 'FULL_CUSTOM': ['LOGO_DESIGN', 'WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'] },
    'LOGO_DESIGN': { 'STANDARD': ['WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION'], 'READY_LOGO': ['WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION'], 'FULL_CUSTOM': ['WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION'] },
    'PRODUCTION_ACCEPTANCE': { 'STANDARD': ['WORKERS', 'PRODUCTION'], 'READY_LOGO': ['WORKERS', 'PRODUCTION'], 'FULL_CUSTOM': ['WORKERS', 'PRODUCTION'] },
    'PRODUCTION': { 'STANDARD': ['STORE_RECEIVE', 'STORE', 'WORKERS', 'OUTLET_RECEIVE'], 'READY_LOGO': ['STORE_RECEIVE', 'STORE', 'WORKERS', 'OUTLET_RECEIVE'], 'FULL_CUSTOM': ['STORE_RECEIVE', 'STORE', 'WORKERS', 'OUTLET_RECEIVE'] },
    'STORE_RECEIVE': { 'STANDARD': ['LOGO_DESIGN', 'WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'], 'READY_LOGO': ['LOGO_DESIGN', 'WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'], 'FULL_CUSTOM': ['LOGO_DESIGN', 'WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'] },
    'DISPATCH': { 'STANDARD': ['OUT_FOR_DELIVERY'], 'READY_LOGO': ['OUT_FOR_DELIVERY'], 'FULL_CUSTOM': ['OUT_FOR_DELIVERY'] },
    'OUT_FOR_DELIVERY': { 'STANDARD': [], 'READY_LOGO': [], 'FULL_CUSTOM': [] },
    'ORDER_ENTRY': { 'STANDARD': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'ENAMELS_DELIVERY', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'], 'READY_LOGO': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'ENAMELS_DELIVERY', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'], 'FULL_CUSTOM': ['LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'ENAMELS_DELIVERY', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'] },
    'OUTLET_RECEIVE': { 'STANDARD': ['ENAMELS_DELIVERY', 'IN_DISPATCH', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'], 'READY_LOGO': ['ENAMELS_DELIVERY', 'IN_DISPATCH', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'], 'FULL_CUSTOM': ['ENAMELS_DELIVERY', 'IN_DISPATCH', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'] },
    'IN_DISPATCH': { 'STANDARD': ['ENAMELS_DELIVERY', 'DISPATCH', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'], 'READY_LOGO': ['ENAMELS_DELIVERY', 'DISPATCH', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'], 'FULL_CUSTOM': ['ENAMELS_DELIVERY', 'DISPATCH', 'OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'] },
    'ENAMELS_DELIVERY': { 'STANDARD': ['OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'], 'READY_LOGO': ['OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'], 'FULL_CUSTOM': ['OUTLET_RECEIVE', 'ORDER_ENTRY', 'DELIVERED'] }
  };

  const allowed = validTransitions[fromStage]?.[orderType];
  if (!allowed || !allowed.includes(toStage)) {
    return { valid: false, expected: allowed?.[0], message: `Invalid transition from ${fromStage} to ${toStage}. ${allowed?.length ? `Allowed: ${allowed.join(', ')}.` : 'No forward transition available from this stage.'}` };
  }
  return { valid: true, expected: toStage };
};

const validAllStages = ['ORDER_ENTRY', 'STORE', 'WORKERS', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'OUTLET_RECEIVE', 'IN_DISPATCH', 'ENAMELS_DELIVERY'];

const getRolesForStage = (stageName) => {
  const map = {
    'STORE': ['STORE', 'STORE_EMPLOYEE'],
    'WORKERS': ['PRODUCTION'],
    'LOGO_DESIGN': ['LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER'],
    'PRODUCTION_ACCEPTANCE': ['PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT'],
    'PRODUCTION': ['PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT'],
    'STORE_RECEIVE': ['STORE', 'STORE_EMPLOYEE'],
    'OUTLET_RECEIVE': ['OUTLET'],
    'IN_DISPATCH': ['OUTLET'],
    'DISPATCH': ['DISPATCH', 'MAIN_EMPLOYEE'],
    'OUT_FOR_DELIVERY': ['OUT_FOR_DELIVERY', 'DELIVERY_BOY'],
    'ENAMELS_DELIVERY': ['DELIVERY_BOY'],
    'ORDER_ENTRY': ['OUTLET', 'ADMIN', 'FAISAL']
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
    stageDurations: { STORE: 24, WORKERS: 24, LOGO_DESIGN: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48, STORE_RECEIVE: 12, OUTLET_RECEIVE: 48, ENAMELS_DELIVERY: 24, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
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
      parsedDetails = order.productDetails;
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
            color: pd.color || null,
            size: pd.size || null,
            variantLabel: [pd.color, pd.size].filter(Boolean).join(' / ') || null,
            productionStatus: 'COMPLETED',
            productionEmployee: order.productionEmployee || null,
            completedAt: new Date(),
            orderNumber: order.orderNumber || null,
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
  const { orderNumber: requestedOrderNumber, customerName, customerPhone, address, city, type, urgent, priority, quantity, logoDesign, logoName, customization, productDetails, sizeData, advancePaid, advanceAmount, shopifyOrderId, paymentDeadline, productImage, items, paymentStatus, deliveryCharges, instructionNotes, engravingInstructions, shopifyOrderDate, placedBy, goForVerification } = req.body;

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
      const existing = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true, status: true } });
      if (existing) {
        if (existing.status === 'CANCELLED') {
          return res.status(400).json({ message: `This order number has already been cancelled and cannot be reused.` });
        }
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
    const initialStatus = 'PENDING';

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
    const hasCustomization = !!(type === 'FULL_CUSTOM');

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
        productDetails: finalProductDetails || null,
        sizeData: finalSizeData ? JSON.stringify(finalSizeData) : null,
        advancePaid: advancePaid || (advanceAmount > 0) || false,
        advanceAmount: advanceAmount || 0,
        paymentStatus: paymentStatus || 'PENDING',
        instructionNotes: instructionNotes || null,
        engravingInstructions: engravingInstructions || null,
        shopifyOrderDate: shopifyOrderDate ? new Date(shopifyOrderDate) : null,
        productImage,
        totalPrice: finalTotalPrice,
        shopifyOrderId,
        paymentDeadline: paymentDeadline ? new Date(paymentDeadline) : (type === 'READY_LOGO' ? new Date(Date.now() + 48 * 60 * 60 * 1000) : null),
        placedBy: placedBy || null,
        goForVerification: !!goForVerification,
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
 
    // Automatically start the first stage for all order types
    // Skip auto-advance to STORE when goForVerification is true — order stays at ORDER_ENTRY for verification
    if (!goForVerification) {
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

    // Create routing history for ORDER_ENTRY → first stage (skip when verification is pending)
    const stages = NEXT_STAGES[type || 'STANDARD'] || NEXT_STAGES['STANDARD'];
    const firstStage = stages[0];
    if (firstStage && !goForVerification) {
      await prisma.routingHistory.create({
        data: {
          orderId: order.id,
          sentByUserId: req.user?.id || null,
          previousStage: 'ORDER_ENTRY',
          newStage: firstStage,
          sentToStage: firstStage,
          remarks: 'Order created and routed'
        }
      });
    }

    // If order is prepaid, record revenue immediately
    if (paymentStatus === 'PAID') {
      await calculateAndRecordRevenue(order);
    }

    // If go for verification, log it and notify INVENTORY_VIEW
    if (goForVerification) {
      await createAuditLog(order.id, 'SENT_FOR_VERIFICATION', 'Order sent for verification before Store allocation', req.user?.id);
      await notify.create(req, { type: 'verification_needed', moduleName: 'Verification', path: '/verification', role: 'INVENTORY_VIEW', title: 'New Verification Request', message: `Order #${order.orderNumber} from ${customerName || 'customer'} needs verification`, orderId: order.id, orderNumber: order.orderNumber, customerName, action: 'Needs Verification', employeeName: req.user?.name }).catch(() => {});
    }

    // Re-fetch order with stages so frontend has currentStage info immediately
    const orderWithStages = await prisma.order.findUnique({
      where: { id: order.id },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    const io = req.app.get('io');
    io.emit('new-order', orderWithStages);

    res.status(201).json(orderWithStages);
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
    const { status: filterStatus, limit, skip, page } = req.query;

    // Escalation check: auto-log overdue priority stages.
    // Throttled to once per 5 min per instance and skipped for delivery queries —
    // each auditLog.findFirst({ details: { contains } }) is a slow full-text scan
    // (~500ms x up to 10 stages) that pushed /api/orders?status=delivery to 16-25s,
    // blowing the frontend 15s timeout and leaving the delivery dashboard empty.
    if (filterStatus !== 'delivery' && Date.now() - lastEscalationCheckAt > ESCALATION_CHECK_INTERVAL) {
      lastEscalationCheckAt = Date.now();
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
    }
    // Global order search — mirrors trackOrder so the Orders module finds every
    // order that Order Tracking can find (order number / invoice number / customer
    // name / phone). No role boundary: trackOrder itself is a global lookup, so the
    // search must behave the same way or tracked orders would be "not found" in Orders.
    const searchQuery = String(req.query.search || '').trim();
    if (searchQuery) {
      const searchResults = await prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: searchQuery, mode: 'insensitive' } },
            { invoiceNumber: { contains: searchQuery, mode: 'insensitive' } },
            { customerName: { contains: searchQuery, mode: 'insensitive' } },
            { customerPhone: { contains: searchQuery } }
          ]
        },
        include: {
          stages: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true }
          },
          auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
          createdBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });
      return res.json(sortByPriority(searchResults));
    }

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
      // Also match deliveryMethod as fallback for orders dispatched before deliveryType was added
      if (req.query.deliveryType) {
        const dt = req.query.deliveryType;
        // Build the delivery method string that would have been stored for this type
        const methodMap = { 'ENAMELS': 'Enamels Delivery', 'TCS': 'TCS', 'POST_EX': 'PostEx' };
        const methodStr = methodMap[dt];
        if (methodStr) {
          where.AND = [
            { OR: [{ deliveryType: dt }, { deliveryMethod: methodStr }] }
          ];
        } else {
          where.deliveryType = dt;
        }
      }
    } else {
      // Default: If no status specified, load active orders + the 100 most recent completed orders to keep payload tiny!
      // This is backward-compatible with older frontend code that filters in memory!
      if (!limit || limit !== 'all') {
        const isDeliveryQuery = filterStatus === 'delivery';
        const deliveryPaymentsInclude = isDeliveryQuery ? { deliveryPayments: { orderBy: { createdAt: 'desc' }, select: { paymentMethod: true, cashAmount: true, onlineAmount: true, collectedBy: true, createdAt: true } } } : {};
        const [activeOrders, completedOrders] = await prisma.$transaction([
          prisma.order.findMany({
            where: {
              ...where,
              status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
            },
            include: {
              stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
              auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
              createdBy: { select: { name: true } },
              ...deliveryPaymentsInclude
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
              stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
              auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
              createdBy: { select: { name: true } },
              ...deliveryPaymentsInclude
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
          select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true }
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
        },
        deliveryPayments: {
          orderBy: { createdAt: 'desc' },
          select: { paymentMethod: true, cashAmount: true, onlineAmount: true, collectedBy: true, createdAt: true }
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

const getOrderById = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch order', error: error.message });
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

    // STORE stage: verify availability. Available items auto-deduct inventory;
    // Verify / Not Available items are NOT deducted and flow to Production.
    if (currentStage.stageName === 'STORE' && (inventoryStatus === 'have_it' || inventoryStatus === 'Available')) {
      try {
        let parsedDetails;
        try {
          parsedDetails = order.productDetails;
        } catch {
          parsedDetails = [];
        }
        const items = Array.isArray(parsedDetails) ? parsedDetails : (parsedDetails?.productType ? [parsedDetails] : []);
        const productAvailability = req.body.productAvailability || {};

        // Persist per-item availability from an explicit map (if the frontend sent one)
        if (Object.keys(productAvailability).length > 0) {
          const updatedItems = items.map((item, idx) => {
            const av = productAvailability[idx];
            if (av !== undefined) {
              return { ...item, availabilityStatus: av ? 'available' : 'not_available' };
            }
            return item;
          });
          await prisma.order.update({
            where: { id: orderId },
            data: { productDetails: updatedItems }
          });
          await createAuditLog(orderId, 'AVAILABILITY_UPDATED',
            `Store verified availability for ${Object.keys(productAvailability).length} item(s).`,
            req.user.id);
        }

        // Decide which items are AVAILABLE: explicit map wins, else respect an already
        // persisted 'not_available'/'produced' status, else treat the item as available.
        const availableIndices = new Set();
        if (Object.keys(productAvailability).length > 0) {
          for (const [k, v] of Object.entries(productAvailability)) {
            if (v === true) availableIndices.add(Number(k));
          }
        } else {
          const pv = order.productVerification || {};
          items.forEach((item, idx) => {
            const pd = item.productDetails || item;
            const explicit = pd?.availabilityStatus;
            if (explicit === 'not_available' || explicit === 'produced') return;
            if (Object.keys(pv).length > 0) {
              if (pv[String(idx)] === true) availableIndices.add(idx);
            } else {
              availableIndices.add(idx);
            }
          });
        }

        if (availableIndices.size > 0) {
          const availableItems = items
            .filter((_, idx) => availableIndices.has(idx))
            .map(item => ({ productDetails: item.productDetails || item, quantity: item.quantity || 1 }));
          const { inventoryItems } = await classifyOrderItems(order, availableItems);
          if (inventoryItems.length > 0) {
            await deductInventoryItems(order, req.user.id, inventoryItems);
          }
        }
      } catch (invErr) {
        console.error('Availability update error:', invErr);
      }
    }

    // Determine next stage — use manual route if provided, else auto-advance via pipeline
    let actualNextStage = manualNextStage || null;
    if (!actualNextStage) {
      const stageName = currentStage.stageName;
      // Outlet orders returning from Production auto-route to OUTLET_RECEIVE (not STORE_RECEIVE)
      if (stageName === 'PRODUCTION' && order.source === 'OUTLET') {
        actualNextStage = 'OUTLET_RECEIVE';
      } else {
        const stages = NEXT_STAGES[order.type] || NEXT_STAGES['STANDARD'];
        const currentIndex = stages.indexOf(stageName);
        if (currentIndex >= 0 && currentIndex < stages.length - 1) {
          actualNextStage = stages[currentIndex + 1];
        }
      }
    }

    // Validate that the destination stage exists in the system
    if (actualNextStage && !validAllStages.includes(actualNextStage)) {
      return res.status(400).json({
        message: `Cannot route order. Destination route "${actualNextStage}" does not exist. Please configure the workflow route first. Valid stages: ${validAllStages.join(', ')}.`
      });
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

    // Mark current stage as completed (AFTER validation to prevent inconsistent state)
    await prisma.orderStage.update({
      where: { id: stageId },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    if (actualNextStage) {
      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations[actualNextStage] || 24);

      await prisma.orderStage.create({
        data: {
          orderId,
          stageName: actualNextStage,
          status: 'PENDING',
          deadlineAt: deadline,
          ...(currentStage.stageName === 'PRODUCTION' && order.source === 'OUTLET' && actualNextStage === 'OUTLET_RECEIVE'
            ? { returnReason: 'Returned to Johar Town from Production' }
            : {})
        }
      });
      await checkAndSetProductionDeadline(orderId, actualNextStage, deadline, req.user.id);

      const isStoreRoutingBack = ['STORE', 'STORE_EMPLOYEE'].includes(req.user.role) && actualNextStage !== 'DISPATCH';
      await prisma.order.update({
        where: { id: orderId },
        data: {
          currentStage: actualNextStage,
          status: 'PENDING',
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
      if (completedOrder) {
        await calculateAndRecordRevenue(completedOrder);
        await syncReplacementCaseOnOrderCompletion(completedOrder);
      }
    }
    
    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });
    const nextStageRoleMap = { 'PRODUCTION_ACCEPTANCE': 'STORE', 'PRODUCTION': 'PRODUCTION', 'LOGO_DESIGN': 'LOGO_DESIGN', 'DISPATCH': 'DISPATCH', 'OUT_FOR_DELIVERY': 'DELIVERY_BOY', 'DELIVERED': 'DELIVERY_BOY', 'OUTLET_RECEIVE': 'OUTLET', 'ENAMELS_DELIVERY': 'DELIVERY_BOY' };
    const nextRole = nextStageRoleMap[actualNextStage] || 'STORE';
    if (order.customerName && order.orderNumber) {
      await notify.create(req, { type: 'stage_task', moduleName: 'My Tasks', path: '/tasks', role: nextRole, title: 'New Task', message: `Order #${order.orderNumber} moved to ${actualNextStage}`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: `\u2192 ${actualNextStage}`, employeeName: req.user?.name }).catch(() => {});
    }
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

    // STORE stage approval — availability already recorded, no inventory deduction

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
      if (completedOrder) {
        await calculateAndRecordRevenue(completedOrder);
        await syncReplacementCaseOnOrderCompletion(completedOrder);
      }
    }

    await createAuditLog(orderId, 'STAGE_APPROVED', `${currentStageRecord.stageName} processed. ${actualNextStage ? `Sent to: ${actualNextStage}` : 'Order completed.'}${customizationPrice ? ` | Added Cost: $${customizationPrice}` : ''}${deliveryMethod ? ` | Delivery: ${deliveryMethod}` : ''}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order?.createdById });
    const apprNextRoleMap = { 'PRODUCTION_ACCEPTANCE': 'STORE', 'PRODUCTION': 'PRODUCTION', 'LOGO_DESIGN': 'LOGO_DESIGN', 'DISPATCH': 'DISPATCH', 'OUT_FOR_DELIVERY': 'DELIVERY_BOY' };
    const apprNextRole = apprNextRoleMap[actualNextStage] || 'STORE';
    if (order?.customerName && order?.orderNumber) {
      await notify.create(req, { type: 'stage_task', moduleName: 'My Tasks', path: '/tasks', role: apprNextRole, title: 'Phase Advanced', message: `Order #${order.orderNumber} moved to ${actualNextStage}`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: `Approved \u2192 ${actualNextStage}`, employeeName: req.user?.name }).catch(() => {});
    }

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
    if (stage.order?.customerName && stage.order?.orderNumber) {
      const stageRoles = getRolesForStage(stage.stageName);
      await notify.create(req, { type: 'stage_rejected', moduleName: 'My Tasks', path: '/tasks', role: stageRoles, title: 'Stage Rejected', message: `Order #${stage.order.orderNumber} rejected at ${stage.stageName}`, orderId: stage.order.id, orderNumber: stage.order.orderNumber, customerName: stage.order.customerName, action: `Rejected at ${stage.stageName}`, employeeName: req.user?.name }).catch(() => {});
    }

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

      await notify.create(req, { type: 'store_task', moduleName: 'My Tasks', path: '/tasks', role: 'STORE', title: 'Payment Complete', message: `Order #${order.orderNumber} payment received, moving to Store`, orderId, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Payment → Store', employeeName: req.user?.name }).catch(() => {});
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
    if (order.status === 'CANCELLED' || order.currentStage === 'CANCELLED') {
      return res.status(400).json({ message: 'This order is already cancelled.' });
    }

    // Cancellation now requires Admin approval — submitting a request keeps the
    // order fully active (workflow, inventory, scanning) until an Admin decides.
    const pending = await prisma.orderCancellationRequest.findFirst({
      where: { orderId, status: 'PENDING' }
    });
    if (pending) {
      return res.status(400).json({ message: 'A cancellation request for this order is already pending Admin approval.' });
    }

    const request = await prisma.orderCancellationRequest.create({
      data: {
        orderId,
        orderNumber: order.orderNumber,
        reason: reason || 'No reason provided',
        requestedById: req.user?.id,
        requestedByName: req.user?.name
      }
    });

    const io = req.app.get('io');
    io.emit('order-updated', { orderId });

    await createAuditLog(orderId, 'CANCELLATION_REQUESTED', `Cancellation requested by ${req.user?.name || 'Unknown'}. Reason: ${reason || 'No reason provided'}`, req.user?.id);

    await notify.create(req, {
      type: 'cancellation_requested',
      moduleName: 'Order Cancellation',
      path: '/order-cancellations',
      role: 'ADMIN',
      title: 'Cancellation Request',
      message: `Order #${order.orderNumber} cancellation requested by ${req.user?.name || 'Unknown'}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      action: 'Approval Required',
      employeeName: req.user?.name
    }).catch(() => {});

    res.json({ message: 'Cancellation request submitted. Waiting for Admin approval.', request });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting cancellation request', error: error.message });
  }
};

// Submit a cancellation request by order number (lookup convenience)
const createCancellationRequest = async (req, res) => {
  const { orderNumber, reason } = req.body;
  try {
    if (!orderNumber) return res.status(400).json({ message: 'Order number is required' });
    const order = await prisma.order.findUnique({ where: { orderNumber: String(orderNumber).trim() } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    req.params = { ...req.params, orderId: order.id };
    return cancelOrder(req, res);
  } catch (error) {
    res.status(500).json({ message: 'Error submitting cancellation request', error: error.message });
  }
};

// Admin: list cancellation requests (pending + history) with order info
const getCancellationRequests = async (req, res) => {
  const { status, search, limit } = req.query;
  try {
    const where = {};
    if (status) where.status = String(status).toUpperCase();
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { order: { customerName: { contains: search, mode: 'insensitive' } } },
        { order: { customerPhone: { contains: search } } }
      ];
    }
    const requests = await prisma.orderCancellationRequest.findMany({
      where,
      include: {
        order: {
          select: {
            id: true, orderNumber: true, customerName: true, customerPhone: true,
            totalPrice: true, currentStage: true, status: true, createdAt: true,
            cancellationReason: true, cancelledAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit === 'all' ? undefined : (parseInt(limit) || 200)
    });
    const pendingCount = await prisma.orderCancellationRequest.count({ where: { status: 'PENDING' } });
    res.json({ requests, pendingCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cancellation requests', error: error.message });
  }
};

// Admin: approve a cancellation request — permanently cancels the order,
// restores inventory, rejects open stages, records decision.
const approveCancellationRequest = async (req, res) => {
  const { requestId } = req.params;
  try {
    const request = await prisma.orderCancellationRequest.findUnique({
      where: { id: requestId },
      include: { order: true }
    });
    if (!request) return res.status(404).json({ message: 'Cancellation request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ message: 'This cancellation request was already decided.' });

    const order = request.order;
    if (order.status === 'CANCELLED' || order.currentStage === 'CANCELLED') {
      return res.status(400).json({ message: 'This order is already cancelled.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderCancellationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          decidedById: req.user?.id,
          decidedByName: req.user?.name,
          decidedAt: new Date()
        }
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          currentStage: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: req.user?.id,
          cancelledByName: req.user?.name,
          cancellationReason: request.reason
        }
      });
      await tx.orderStage.updateMany({
        where: { orderId: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL', 'ON_HOLD'] } },
        data: { status: 'REJECTED', rejectionReason: `ORDER CANCELLED (approved by Admin): ${request.reason}` }
      });
    });

    // Restore inventory outside the transaction (same helper deleteOrder uses)
    await restoreInventoryForDeletion(order, req.user?.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId: order.id, cancelled: true, orderNumber: order.orderNumber });

    await createAuditLog(order.id, 'CANCELLATION_APPROVED', `Cancellation approved by ${req.user?.name || 'Admin'}. Reason: ${request.reason}. Order permanently cancelled, inventory restored.`, req.user?.id);
    await createAuditLog(order.id, 'ORDER_CANCELLED', `Order permanently cancelled after Admin approval. Reason: ${request.reason}`, req.user?.id);

    if (request.requestedById) {
      const requester = await prisma.user.findUnique({ where: { id: request.requestedById }, select: { role: true } });
      if (requester?.role) {
        await notify.create(req, {
          type: 'cancellation_approved',
          moduleName: 'Order Cancellation',
          path: '/order-track',
          role: requester.role,
          title: 'Cancellation Approved',
          message: `Your cancellation request for order #${order.orderNumber} has been approved by ${req.user?.name || 'Admin'}.`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          action: 'Cancelled',
          employeeName: req.user?.name
        }).catch(() => {});
      }
    }

    res.json({ message: 'Cancellation approved. Order permanently cancelled, inventory restored.', order: { id: order.id, orderNumber: order.orderNumber, status: 'CANCELLED' } });
  } catch (error) {
    res.status(500).json({ message: 'Error approving cancellation', error: error.message });
  }
};

// Admin: reject a cancellation request — order stays active, history recorded
const rejectCancellationRequest = async (req, res) => {
  const { requestId } = req.params;
  const { decisionNote } = req.body;
  try {
    const request = await prisma.orderCancellationRequest.findUnique({
      where: { id: requestId },
      include: { order: true }
    });
    if (!request) return res.status(404).json({ message: 'Cancellation request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ message: 'This cancellation request was already decided.' });

    await prisma.orderCancellationRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        decidedById: req.user?.id,
        decidedByName: req.user?.name,
        decisionNote: decisionNote || null,
        decidedAt: new Date()
      }
    });

    const io = req.app.get('io');
    io.emit('order-updated', { orderId: request.orderId });

    await createAuditLog(request.orderId, 'CANCELLATION_REJECTED', `Cancellation request rejected by ${req.user?.name || 'Admin'}. Note: ${decisionNote || 'No note provided'}`, req.user?.id);

    if (request.requestedById) {
      const requester = await prisma.user.findUnique({ where: { id: request.requestedById }, select: { role: true } });
      if (requester?.role) {
        await notify.create(req, {
          type: 'cancellation_rejected',
          moduleName: 'Order Cancellation',
          path: '/order-track',
          role: requester.role,
          title: 'Cancellation Rejected',
          message: `Your cancellation request for order #${request.orderNumber} was not approved. Note: ${decisionNote || 'No note provided'}`,
          orderId: request.orderId,
          orderNumber: request.orderNumber,
          customerName: request.order?.customerName,
          action: 'Rejected',
          employeeName: req.user?.name
        }).catch(() => {});
      }
    }

    res.json({ message: 'Cancellation request rejected. Order remains active.', request });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting cancellation', error: error.message });
  }
};

const restoreInventoryForDeletion = async (order, userId) => {
  if (!order) return;
  let parsedDetails = order.productDetails;

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
        const bulkDestRoleMap = { 'PRODUCTION_ACCEPTANCE': 'STORE', 'PRODUCTION': 'PRODUCTION', 'LOGO_DESIGN': 'LOGO_DESIGN', 'DISPATCH': 'DISPATCH', 'OUTLET_RECEIVE': 'OUTLET' };
        const bulkDestRole = bulkDestRoleMap[destinationStage] || 'STORE';
        if (order?.customerName && order?.orderNumber) {
          await notify.create(req, { type: 'bulk_route', moduleName: 'My Tasks', path: '/tasks', role: bulkDestRole, title: 'Bulk Routed', message: `Order #${order.orderNumber} bulk routed`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: `Bulk \u2192 ${destinationStage}`, employeeName: req.user?.name }).catch(() => {});
        }

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

const deductInventoryItems = async (order, userId, itemList) => {
  if (!order || !itemList?.length) return;

  // Group all deductions per inventory item so multiple order items that map to
  // the SAME inventory item (same product, different colors/sizes, e.g. 2x BunFit
  // Cap in Navy Palm + Floral) are applied against one evolving variants array.
  // Previously each item re-derived variants from the same stale snapshot, so the
  // later $transaction UPDATE overwrote the earlier one and only one product ever
  // got deducted.
  const byItem = new Map();
  for (const prod of itemList) {
    const inventoryItem = prod.inventoryItem;
    if (!inventoryItem) continue;
    if (!byItem.has(inventoryItem.id)) {
      byItem.set(inventoryItem.id, { inventoryItem, deductions: [] });
    }
    byItem.get(inventoryItem.id).deductions.push({
      color: prod.color,
      size: prod.size,
      qty: prod.quantity || 1
    });
  }

  const operations = [];
  const auditedItems = [];

  for (const { inventoryItem, deductions } of byItem.values()) {
    if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
      let updatedVariants = [...inventoryItem.variants];
      let anyDeducted = false;

      for (const d of deductions) {
        let matchIdx = -1;
        if (d.color || d.size) {
          matchIdx = updatedVariants.findIndex(v =>
            (!d.color || (v.color && v.color.toLowerCase() === d.color.toLowerCase())) &&
            (!d.size || (v.size && v.size.toLowerCase() === d.size.toLowerCase()))
          );
        }
        if (matchIdx < 0) continue;
        const available = updatedVariants[matchIdx].stock || 0;
        if (available < d.qty) continue;
        updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: available - d.qty };
        anyDeducted = true;
      }

      if (anyDeducted) {
        const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
        operations.push(
          prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { variants: updatedVariants, stock: newTotalStock }
          })
        );
        auditedItems.push({ inventoryItem, qty: deductions.reduce((s, d) => s + d.qty, 0) });
      }
    } else {
      const totalQty = deductions.reduce((s, d) => s + d.qty, 0);
      const actualDeduct = Math.min(totalQty, inventoryItem.stock);
      operations.push(
        prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { stock: { decrement: actualDeduct } }
        })
      );
      auditedItems.push({ inventoryItem, qty: actualDeduct });
    }
  }

  if (operations.length === 0) return;

  await prisma.$transaction(operations);

  const auditLogs = auditedItems.map(({ inventoryItem, qty }) =>
    createAuditLog(order.id, 'INVENTORY_DEDUCTED', `Deducted ${qty} unit(s) of ${inventoryItem.name} from stock (non-manufactured item fulfillment). Product ID: ${inventoryItem.id}`, userId)
  );
  await Promise.all(auditLogs);
};

const deductInventory = async (order, userId) => {
  if (!order) return;
  let parsedDetails = order.productDetails;
  
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
  const { verifiedItems } = req.body || {};
  try {
    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (e) {
      if (e?.code === 'P2021') return res.status(503).json({ message: 'DB schema outdated — run npx prisma db push' });
      throw e;
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Determine which items to add — only production-manufactured items
    const { productionItems } = await classifyOrderItems(order);
    const productionProductTypes = productionItems.map(p => p.productType.toLowerCase());

    let parsedDetails;
    try {
      parsedDetails = order.productDetails;
    } catch {
      return res.status(400).json({ message: 'Invalid product details' });
    }
    if (!parsedDetails) return res.status(400).json({ message: 'No product details found' });

    const productsToAdd = [];
    const productIndices = []; // track original indices for marking produced

    const addItemIfProduction = (pd, quantity, originalIdx) => {
      if (!pd?.productType) return;
      const ptLower = (pd.productType || '').toLowerCase();
      if (productionProductTypes.length === 0 || productionProductTypes.some(ppt => ptLower.includes(ppt) || ppt.includes(ptLower))) {
        productsToAdd.push({ productType: pd.productType, quantity, color: pd.color, size: pd.size });
        productIndices.push(originalIdx);
      }
    };

    if (Array.isArray(parsedDetails)) {
      parsedDetails.forEach((item, idx) => {
        // If verifiedItems is provided, only process items at those indices
        if (Array.isArray(verifiedItems) && verifiedItems.length > 0) {
          if (!verifiedItems.includes(idx)) return;
        }
        // Skip items already marked as produced
        const pd = item.productDetails || item;
        if (pd.availabilityStatus === 'produced') return;
        addItemIfProduction(pd, item.quantity || 1, idx);
      });
    } else if (parsedDetails?.productType) {
      // Single-item order: if already produced, skip
      if (parsedDetails.availabilityStatus !== 'produced') {
        addItemIfProduction(parsedDetails, order.quantity || 1, 0);
      }
    }

    if (productsToAdd.length === 0) {
      return res.status(400).json({ message: 'No new items to add — all selected products are already in inventory' });
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
            orderId: order.id, orderNumber: order.orderNumber || null,
            color: prod.color || null, size: prod.size || null,
            variantLabel: [prod.color, prod.size].filter(Boolean).join(' / ') || null,
            productionStatus: 'COMPLETED',
            productionEmployee: order.productionEmployee || null,
            completedAt: new Date(),
            notes: 'Added to inventory by Store',
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

    // Mark only the newly-added items in productDetails as 'produced'
    try {
      let pd = order.productDetails;
      if (pd && Array.isArray(productIndices) && productIndices.length > 0) {
        const updated = Array.isArray(pd)
          ? pd.map((item, idx) => {
              if (productIndices.includes(idx) && item.availabilityStatus === 'not_available') {
                return { ...item, availabilityStatus: 'produced' };
              }
              return item;
            })
          : pd.productType && pd.availabilityStatus === 'not_available' && productIndices.includes(0)
            ? { ...pd, availabilityStatus: 'produced' }
            : pd;
        await prisma.order.update({
          where: { id: orderId },
          data: { productDetails: updated }
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

    // Create routing history for DISPATCH → OUT_FOR_DELIVERY
    await prisma.routingHistory.create({
      data: {
        orderId,
        sentByUserId: req.user.id,
        previousStage: 'DISPATCH',
        newStage: 'OUT_FOR_DELIVERY',
        sentToStage: 'OUT_FOR_DELIVERY',
        remarks: 'Sent for delivery'
      }
    });

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });
    if (order?.customerName && order?.orderNumber) {
      await notify.create(req, { type: 'delivery_task', moduleName: 'Deliveries', path: '/delivery', role: 'DELIVERY_BOY', title: 'New Delivery', message: `Order #${order.orderNumber} is out for delivery`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Out for Delivery', employeeName: req.user?.name }).catch(() => {});
    }

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
      parsedDetails = order.productDetails;
    } catch {
      return res.json({ orderId: order.id, orderNumber: order.orderNumber, report: [], summary: { totalItems: 0, available: 0, insufficient: 0, outOfStock: 0, inventoryItems: 0, productionItems: 0 } });
    }
    const productsToCheck = [];

    if (Array.isArray(parsedDetails)) {
      parsedDetails.forEach(item => {
        const pd = item.productDetails || item;
        if (pd?.productType || pd?.name) {
          productsToCheck.push({
            name: pd.name || pd.productType,
            productType: pd.productType,
            quantity: item.quantity || 1,
            color: pd.color,
            size: pd.size,
            customization: item.customization || pd.customization
          });
        }
      });
    } else if (parsedDetails?.productType || parsedDetails?.name) {
      productsToCheck.push({
        name: parsedDetails.name || parsedDetails.productType,
        productType: parsedDetails.productType,
        quantity: order.quantity || 1,
        color: parsedDetails.color,
        size: parsedDetails.size,
        customization: parsedDetails.customization
      });
    }

    const report = [];

    // Batch-fetch all inventory items in a single query
    const productTypes = productsToCheck.map(p => p.name || p.productType).filter(Boolean);
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

    const normStr = (s) => String(s == null ? '' : s).trim().toLowerCase();

    for (const prod of productsToCheck) {
      try {
        const key = String(prod.name || prod.productType || '').trim();
        if (!key) {
          report.push({
            itemName: prod.productType || 'Unknown',
            requiredQty: prod.quantity,
            availableQty: 0,
            status: 'not_found',
            classification: 'production',
            variants: []
          });
          continue;
        }

        // Candidates = every inventory item whose name contains the product key.
        const normKey = normStr(key);
        const candidates = allInvItems.filter(inv => normStr(inv.name).includes(normKey));

        // Prefer EXACT name matches. Duplicate-name items (e.g. "Sprinter Men"
        // vs "Sprinter Men Grey Nova") otherwise make `.find()` pick the wrong row
        // and report 0 for variants that only exist on the exact product.
        const exactMatches = candidates.filter(inv => normStr(inv.name) === normKey);
        const selectedItems = exactMatches.length > 0 ? exactMatches : candidates;

        if (selectedItems.length === 0) {
          report.push({
            itemName: prod.productType || key,
            requiredQty: prod.quantity,
            availableQty: 0,
            status: 'not_found',
            classification: 'production',
            variants: []
          });
          continue;
        }

        const requestedColor = normStr(prod.color);
        const requestedSize = normStr(prod.size);
        let availableQty = 0;
        const variantDetails = [];
        let matchedItem = selectedItems[0];

        for (const inv of selectedItems) {
          const hasVariants = Array.isArray(inv.variants) && inv.variants.length > 0;
          if (hasVariants) {
            for (const v of inv.variants) {
              const vColor = normStr(v.color);
              const vSize = normStr(v.size);
              if (requestedColor && vColor && vColor !== requestedColor) continue;
              if (requestedSize && vSize && vSize !== requestedSize) continue;
              availableQty += (v.stock || 0);
              variantDetails.push({ color: v.color || '', size: v.size || '', stock: v.stock || 0 });
            }
          } else {
            // Flat-stock item (no variants array): report its top-level stock.
            const invColor = normStr(inv.color);
            const invSize = normStr(inv.size);
            if (requestedColor && invColor && invColor !== requestedColor) continue;
            if (requestedSize && invSize && invSize !== requestedSize) continue;
            availableQty += (inv.stock || 0);
            variantDetails.push({ color: inv.color || '', size: inv.size || '', stock: inv.stock || 0 });
            if (!matchedItem) matchedItem = inv;
          }
        }

        let status = 'available';
        if (availableQty === 0) status = 'out_of_stock';
        else if (availableQty < prod.quantity) status = 'insufficient';

        const classification = availableQty >= prod.quantity ? 'inventory' : 'production';
        report.push({
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          category: matchedItem.category,
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
          itemName: prod.productType || 'Unknown',
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
    res.status(500).json({ message: 'Error checking inventory' });
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
    // Use contains for flexible outlet matching (frontend sends 'ONLINE', DB has 'ONLINE ORDER')
    if (outletName) orderWhere.outletName = { contains: outletName, mode: 'insensitive' };

    const NOT_COMPLETED = ['CANCELLED', 'REJECTED'];
    const ACTIVE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'IN_PROGRESS'];

    const [totalOrders, completedOrders, cancelledOrders, inProgressOrders, pendingOrders, revenueAgg, outletNames] = await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.count({ where: { ...orderWhere, status: 'COMPLETED' } }),
      prisma.order.count({ where: { ...orderWhere, status: { in: NOT_COMPLETED } } }),
      prisma.order.count({ where: { ...orderWhere, status: 'IN_PROGRESS' } }),
      prisma.order.count({ where: { ...orderWhere, status: { in: ['PENDING', 'WAITING_PAYMENT'] } } }),
      prisma.order.aggregate({ where: { ...orderWhere, status: 'COMPLETED' }, _sum: { totalPrice: true }, _avg: { totalPrice: true } }),
      outletName ? Promise.resolve([]) : prisma.order.groupBy({
        by: ['outletName'],
        _count: { id: true },
        where: { outletName: { not: null } },
        orderBy: { _count: { id: 'desc' } }
      })
    ]);

    const recentOrders = await prisma.order.findMany({
      where: orderWhere,
      select: { id: true, orderNumber: true, customerName: true, totalPrice: true, status: true, paymentStatus: true, priority: true, createdAt: true, outletName: true },
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
    console.error('[getOutletAnalytics] Error:', error);
    res.status(500).json({ message: 'Error fetching outlet analytics', error: error.message });
  }
};

// ====== MANUAL ROUTING ======
const manualRouteOrder = async (req, res) => {
  const { orderId } = req.params;
  let { destinationStage, remarks } = req.body;
  // Auto-correct common shorthand
  if (destinationStage === 'LOGO') destinationStage = 'LOGO_DESIGN';

  // Validate that the destination stage exists in the system
  if (!validAllStages.includes(destinationStage)) {
    return res.status(400).json({
      message: `Cannot route order. Destination route "${destinationStage}" does not exist. Please configure the workflow route first. Valid stages: ${validAllStages.join(', ')}.`
    });
  }

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
        status: 'PENDING',
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

    // Mark the order as seen for the routing user at the destination stage, so it
    // immediately appears in their Assigned/Accepted list (e.g. Production Out
    // accepting PRODUCTION_ACCEPTANCE → PRODUCTION). Other recipient users still
    // see it as unseen until they explicitly mark-seen.
    if (req.user?.id) {
      await prisma.seenTask.upsert({
        where: { userId_orderId_stageName: { userId: req.user.id, orderId, stageName: destinationStage } },
        update: {},
        create: { userId: req.user.id, orderId, stageName: destinationStage, seenAt: new Date() }
      }).catch(() => {});
    }

    await createAuditLog(orderId, 'MANUAL_ROUTE', `Manually routed from ${currentStage?.stageName || 'UNKNOWN'} to ${destinationStage} by ${req.user.name}. Remarks: ${remarks || 'N/A'}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });
    const manDestRoleMap = { 'STORE': 'STORE', 'PRODUCTION': 'PRODUCTION', 'LOGO_DESIGN': 'LOGO_DESIGN', 'DISPATCH': 'DISPATCH', 'OUT_FOR_DELIVERY': 'DELIVERY_BOY', 'OUTLET_RECEIVE': 'OUTLET', 'ENAMELS_DELIVERY': 'DELIVERY_BOY' };
    const manRole = manDestRoleMap[destinationStage] || 'STORE';
    if (order?.customerName && order?.orderNumber) {
      await notify.create(req, { type: 'manual_route', moduleName: 'My Tasks', path: '/tasks', role: manRole, title: 'Order Routed', message: `Order #${order.orderNumber} manually routed to ${destinationStage}`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: `Routed \u2192 ${destinationStage}`, employeeName: req.user?.name }).catch(() => {});
    }

    res.json({ message: `Order routed to ${destinationStage}`, nextStage: destinationStage });
  } catch (error) {
    res.status(500).json({ message: 'Error routing order', error: error.message });
  }
};

const getRolesForStageBasedOnRole = (role) => {
  const map = {
    'STORE': ['STORE'],
    'STORE_EMPLOYEE': ['STORE'],
    'PRODUCTION': ['PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'WORKERS'],
    'PRODUCTION_IN': ['PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'WORKERS'],
    'PRODUCTION_OUT': ['PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'WORKERS'],
    'WORKER': ['WORKERS'],
    'LOGO_DESIGN': ['LOGO_DESIGN'],
    'LOGO_DESIGN_EMPLOYEE': ['LOGO_DESIGN'],
    'LOGO_DESIGNER': ['LOGO_DESIGN'],
    'DISPATCH': ['DISPATCH'],
    'MAIN_EMPLOYEE': ['DISPATCH'],
    'OUT_FOR_DELIVERY': ['OUT_FOR_DELIVERY'],
    'DELIVERY_BOY': ['ENAMELS_DELIVERY', 'OUT_FOR_DELIVERY'],
    'OUTLET': ['ORDER_ENTRY', 'OUTLET_RECEIVE', 'IN_DISPATCH'],
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
        stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
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
    const whereClause = {
      currentStage: { in: relevantStages },
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] },
      stages: { some: { stageName: { in: relevantStages }, status: { in: ['PENDING', 'IN_PROGRESS'] } } }
    };
    // Filter by outlet name for OUTLET role so each outlet only sees its own orders
    // Johar Town also sees Jail Road orders (auto-routing from Jail Road)
    if (userRole === 'OUTLET') {
      // Outlet My Tasks (Orders / Seen tabs) shows ONLY new outlet orders at ORDER_ENTRY.
      // Production-returned orders live in the "Come From Production" tab (OUTLET_RECEIVE),
      // and In Dispatch orders live in the dedicated In Dispatch module — neither appears here.
      whereClause.currentStage = 'ORDER_ENTRY';
      whereClause.stages = { some: { stageName: 'ORDER_ENTRY', status: { in: ['PENDING', 'IN_PROGRESS'] } } };
    }
    if (userRole === 'OUTLET' && req.user?.name) {
      const rawName = req.user.name.toLowerCase();
      let normalizedName = 'Unknown';
      if (rawName.includes('johar')) normalizedName = 'Johar Town';
      else if (rawName.includes('jail')) normalizedName = 'Jail Road';
      else if (rawName.includes('abbottabad')) normalizedName = 'Abbottabad';
      else normalizedName = req.user.name;
      if (normalizedName === 'Johar Town') {
        // Johar Town is the hub — sees Johar Town, Jail Road, AND Abbottabad orders in tasks
        whereClause.outletName = { in: ['Johar Town', 'Jail Road', 'Abbottabad'] };
      } else {
        whereClause.outletName = { contains: normalizedName, mode: 'insensitive' };
      }
    }
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
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
        stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
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

    const acceptedAt = new Date();
    // If stage already has startedAt (auto-created), preserve it; otherwise set it now
    const stageUpdateData = pendingStage.startedAt
      ? { status: 'IN_PROGRESS' }
      : { startedAt: acceptedAt, status: 'IN_PROGRESS' };
    await prisma.orderStage.update({
      where: { id: pendingStage.id },
      data: stageUpdateData
    });

    await createAuditLog(orderId, 'STAGE_ACCEPTED',
      `Task accepted at ${pendingStage.stageName} by ${req.user.name} (Delay: ${Math.round((acceptedAt - new Date(pendingStage.createdAt)) / 60000)} min)`,
      req.user.id);

    // Auto-assign to PRODUCTION_OUT users when PRODUCTION_IN accepts
    if (req.user.role === 'PRODUCTION_IN') {
      const outUsers = await prisma.user.findMany({ where: { role: 'PRODUCTION_OUT' }, select: { id: true } });
      if (outUsers.length > 0) {
        const seenData = outUsers.map(u => ({
          userId: u.id,
          orderId,
          stageName: order.currentStage,
          seenAt: acceptedAt
        }));
        await prisma.seenTask.createMany({ data: seenData, skipDuplicates: true });
      }
    }

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
// Derive the display location in the workflow for tracking.
// Orders sent for verification keep currentStage = ORDER_ENTRY until verified,
// but tracking must show them at their real workflow location.
const getTrackingStatus = (order) => {
  if (!order) return 'ORDER_ENTRY';
  if (order.currentStage === 'CANCELLED' || order.status === 'CANCELLED') return 'CANCELLED';
  if (!order.goForVerification) return order.currentStage || 'ORDER_ENTRY';
  if (order.verifiedAt) return order.currentStage;
  if (order.verificationReturnedAt) return 'RETURNED_FROM_VERIFICATION';
  return 'VERIFICATION';
};

const getOrderTimeline = async (req, res) => {
  const { orderId } = req.params;
  try {
    const [stages, routingHistory, auditLogs, order] = await Promise.all([
      prisma.orderStage.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
        include: { assignedEmployee: { select: { id: true, name: true } } }
      }),
      prisma.routingHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
        include: { sentByUser: { select: { id: true, name: true } } }
      }),
      prisma.auditLog.findMany({
        where: { orderId },
        orderBy: { timestamp: 'asc' },
        include: { user: { select: { id: true, name: true } } }
      }),
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, orderNumber: true, customerName: true, status: true,
          currentStage: true, goForVerification: true, verifiedAt: true,
          verificationReturnedAt: true, verificationReturnNote: true,
          verifiedByName: true, source: true, createdAt: true, createdById: true,
          replacementCaseId: true
        }
      })
    ]);

    // Build actor lookup: stageName -> { actor, timestamp } from audit logs
    const stageActorMap = {};
    auditLogs.forEach(al => {
      if (al.action === 'STAGE_ACCEPTED' && al.details) {
        const match = al.details.match(/stage[:\s]+(\w+)/i);
        if (match) stageActorMap[match[1].toUpperCase()] = { actor: al.user?.name || al.performedBy, time: al.timestamp };
      }
      if (al.action === 'STORE_ACCEPT') stageActorMap['STORE'] = { actor: al.user?.name || al.performedBy, time: al.timestamp };
      if (al.action === 'DELIVERY_ACCEPTED') stageActorMap['OUT_FOR_DELIVERY'] = { actor: al.user?.name || al.performedBy, time: al.timestamp };
      if (al.action === 'DISPATCH_ACCEPTED') stageActorMap['DISPATCH'] = { actor: al.user?.name || al.performedBy, time: al.timestamp };
      if (al.action === 'ORDER_VERIFIED') stageActorMap['ORDER_ENTRY'] = { actor: al.user?.name || al.performedBy, time: al.timestamp };
    });

    const STAGE_LABELS_MAP = {
      ORDER_ENTRY: 'Order Entry', STORE: 'Store', WORKERS: 'Workers',
      LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance',
      PRODUCTION: 'Production', STORE_RECEIVE: 'Store Receive',
      DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery',
      OUTLET_RECEIVE: 'Outlet Receive', IN_DISPATCH: 'In Dispatch',
      ENAMELS_DELIVERY: 'Enamels Delivery', DELIVERED: 'Delivered',
      VERIFICATION: 'Verification'
    };

    const ACTION_LABELS = {
      ORDER_CREATED: 'Order Created', OUTLET_ORDER_CREATED: 'Order Created',
      STAGE_ACCEPTED: 'Task Accepted', STAGE_APPROVED: 'Stage Approved',
      STAGE_REJECTED: 'Stage Rejected', STORE_ACCEPT: 'Store Accepted',
      STORE_ROUTE: 'Store Routed', STORE_RETURN_TO_SOURCE: 'Returned to Source',
      MANUAL_ROUTE: 'Manual Route', BULK_ROUTE: 'Bulk Route',
      FORCE_MOVE: 'Force Moved', FORCE_COMPLETE: 'Force Completed',
      RETURN_TO_STORE: 'Returned to Store', RETURN_TO_OUTLET: 'Returned to Outlet',
      SENT_FOR_DELIVERY: 'Sent for Delivery', DISPATCHED_ENAMELS: 'Dispatched (ENAMELS)',
      DISPATCHED_IMMENT: 'Dispatched (Imment)', DISPATCHED_COURIER: 'Dispatched (Courier)',
      DISPATCH_DELIVERED: 'Delivered via Dispatch', DISPATCH_RETURNED: 'Returned via Dispatch',
      DISPATCH_ACCEPTED: 'Dispatch Accepted', OUTLET_RECEIVED: 'Outlet Received',
      CUSTOMER_TAKEN: 'Customer Pickup', IN_HOUSE_DELIVERED: 'In-House Delivered',
      DELIVERED: 'Delivered', DELIVERY_ACCEPTED: 'Delivery Accepted',
      DELIVERY_FAILED: 'Delivery Failed', DELIVERY_RESCHEDULED: 'Delivery Rescheduled',
      DELIVERY_STATUS_UPDATED: 'Delivery Status Updated',
      PAYMENT_UPDATED: 'Payment Updated', PRIORITY_UPDATED: 'Priority Updated',
      DELIVERY_TYPE_SET: 'Delivery Type Set', ORDER_COMPLETED: 'Order Completed',
      ORDER_CANCELLED: 'Order Cancelled', ORDER_ON_HOLD: 'Order On Hold',
      ORDER_RESUMED: 'Order Resumed', INVENTORY_DEDUCTED: 'Inventory Deducted',
      INVENTORY_RESTORED: 'Inventory Restored', INVENTORY_ADDED: 'Inventory Added',
      PRODUCT_VERIFIED: 'Product Verified', AVAILABILITY_UPDATED: 'Availability Updated',
      DEADLINE_EXTENDED: 'Deadline Extended', ROUTE_BLOCKED: 'Route Blocked',
      COURIER_DISPATCH_REQUESTED: 'Courier Requested', PICKED_UP: 'Picked Up',
      REFUND_REQUESTED: 'Refund Requested', REFUND_COMPLETED: 'Refund Completed',
      REFUND_PROCESSING: 'Refund Processing',       EDIT_REQUESTED: 'Edit Request Submitted',
      EDIT_APPROVED: 'Edit Approved', EDIT_REJECTED: 'Edit Rejected',
      EDIT_REQUEST_APPROVED: 'Edit Approved — Order Returned to Store', WORKFLOW_RESTARTED: 'Workflow Restarted at Store',
      SENT_FOR_VERIFICATION: 'Sent for Verification', ORDER_VERIFIED: 'Order Verified',
      VERIFICATION_PENDING: 'Verification Pending',
      RETURNED_FOR_CORRECTION: 'Returned from Verification',
      RESUBMITTED_AFTER_VERIFICATION: 'Resubmitted after Verification',
      RESUBMITTED_TO_STORE: 'Resubmitted to Store',
      RETURN_INITIATED: 'Return Initiated', REPLACEMENT_INITIATED: 'Replacement Initiated',
      RETURN_STORE_PROCESSED: 'Return Processed by Store',
      REPLACEMENT_STORE_PROCESSED: 'Replacement Processed by Store',
      RETURN_ROUTED_TO_PRODUCTION: 'Return Routed to Production',
      REPLACEMENT_ROUTED_TO_PRODUCTION: 'Replacement Routed to Production',
      REPLACEMENT_FAISAL_APPROVED: 'Replacement Approved by Faisal',
      REPLACEMENT_FAISAL_REJECTED: 'Replacement Rejected by Faisal',
      CANCELLATION_REQUESTED: 'Cancellation Requested',
      CANCELLATION_APPROVED: 'Cancellation Approved',
      CANCELLATION_REJECTED: 'Cancellation Rejected'
    };

    // --- Build CONSOLIDATED stage entries (one per OrderStage) ---
    const stageEntries = stages.map(s => {
      const derivedActor = s.assignedEmployee?.name || stageActorMap[s.stageName]?.actor || null;
      let delay = null;
      if (s.startedAt && s.completedAt) {
        delay = Math.round((new Date(s.completedAt) - new Date(s.startedAt)) / 60000);
      }
      return {
        id: s.id,
        type: 'stage',
        stage: s.stageName,
        stageLabel: STAGE_LABELS_MAP[s.stageName] || s.stageName,
        status: s.status,
        receivedAt: s.createdAt,
        acceptedAt: s.startedAt || null,
        completedAt: s.completedAt || null,
        actor: derivedActor,
        delay,
        returnedFrom: s.returnedFrom || null,
        returnReason: s.returnReason || null
      };
    });

    // --- Build route entries with from/to ---
    const routeEntries = routingHistory.map(rh => ({
      id: rh.id,
      type: 'route',
      from: rh.previousStage,
      to: rh.newStage,
      fromLabel: STAGE_LABELS_MAP[rh.previousStage] || rh.previousStage,
      toLabel: STAGE_LABELS_MAP[rh.newStage] || rh.newStage,
      actor: rh.sentByUser?.name || 'System',
      timestamp: rh.createdAt,
      remarks: rh.remarks || null
    }));

    // ================================================================
    // FLAT CANONICAL WORKFLOW EVENTS (chronological full-lifecycle trail)
    // One event per meaningful step (Order Entered, Sent to X, X Accepted,
    // X Completed, verification steps, deliveries). Repeated department
    // visits stay as separate events — history is appended, never replaced.
    // ================================================================
    const labelOf = (s) => STAGE_LABELS_MAP[s] || String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const titleCase = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    const isOutlet = order?.source === 'OUTLET';
    const isReplacement = order?.source === 'REPLACEMENT';
    const orderCreated = order?.createdAt ? new Date(order.createdAt).getTime() : 0;
    const isFirstStage = (s) => s.stageName === 'ORDER_ENTRY' && Math.abs(new Date(s.createdAt).getTime() - orderCreated) < 120000;

    const transitionLabel = (s) => {
      const n = s.stageName;
      if (isFirstStage(s)) return isReplacement ? 'Replacement Order Entered' : isOutlet ? 'Outlet Order Created' : 'Order Entered';
      switch (n) {
        case 'STORE': return 'Sent to Store';
        case 'LOGO_DESIGN': return 'Sent to Logo Design';
        case 'PRODUCTION': return 'Sent to Production';
        case 'PRODUCTION_ACCEPTANCE': return 'Sent to Production Acceptance';
        case 'STORE_RECEIVE': return (s.returnReason && s.returnReason.toLowerCase().includes('production')) ? 'Returned to Store (After Production)' : 'Sent to Store (After Production)';
        case 'DISPATCH': return 'Sent to Dispatch';
        case 'OUT_FOR_DELIVERY': return 'Moved to Assigned Tasks';
        case 'OUTLET_RECEIVE': return (s.returnReason && s.returnReason.toLowerCase().includes('production')) ? 'Returned to Johar Town — Come From Production' : 'Received at Outlet';
        case 'IN_DISPATCH': return 'Sent to In Dispatch';
        case 'ENAMELS_DELIVERY': return 'Sent to Enamels Delivery Boy';
        case 'VERIFICATION': return 'Sent to Verification';
        case 'DELIVERED': return 'Order Delivered';
        default: return `Received at ${labelOf(n)}`;
      }
    };

    const acceptedLabel = (s) => {
      const n = s.stageName;
      switch (n) {
        case 'ORDER_ENTRY': return isOutlet ? 'Order Accepted in My Tasks' : null;
        case 'STORE': return 'Store Accepted';
        case 'STORE_RECEIVE': return 'Store Accepted (After Production)';
        case 'LOGO_DESIGN': return 'Logo Accepted';
        case 'PRODUCTION': return 'Production Accepted';
        case 'PRODUCTION_ACCEPTANCE': return 'Production Acceptance Accepted';
        case 'DISPATCH': return 'Dispatch Accepted';
        case 'OUT_FOR_DELIVERY': return 'Out for Delivery';
        case 'OUTLET_RECEIVE': return 'Order Accepted (Come From Production)';
        case 'IN_DISPATCH': return 'In Dispatch Accepted';
        case 'ENAMELS_DELIVERY': return 'Delivery Boy Accepted';
        case 'VERIFICATION': return 'Verification Started';
        default: return `${labelOf(n)} Accepted`;
      }
    };

    const completedLabel = (s) => {
      const n = s.stageName;
      switch (n) {
        case 'STORE': return 'Store Processing Completed';
        case 'STORE_RECEIVE': return 'Store Processing Completed (After Production)';
        case 'LOGO_DESIGN': return 'Logo Completed';
        case 'PRODUCTION': return 'Production Completed';
        case 'DISPATCH': return 'Dispatch Completed';
        case 'OUT_FOR_DELIVERY': return 'Delivered';
        case 'OUTLET_RECEIVE': return 'Outlet Processing Completed';
        case 'IN_DISPATCH': return 'In Dispatch Completed';
        case 'ENAMELS_DELIVERY': return 'Enamels Delivery Completed';
        default: return `${labelOf(n)} Completed`;
      }
    };

    // Match each routing entry to the OrderStage it created (same stage name,
    // near-identical timestamp) so we emit ONE transition event instead of both
    // a "Sent to X" route AND a duplicate "X — Received" stage event.
    const usedRouteIds = new Set();
    stages.forEach(s => {
      const candidates = routingHistory.filter(rh =>
        !usedRouteIds.has(rh.id) &&
        rh.newStage === s.stageName &&
        Math.abs(new Date(rh.createdAt).getTime() - new Date(s.createdAt).getTime()) < 120000
      );
      if (!candidates.length) return;
      candidates.sort((a, b) =>
        Math.abs(new Date(a.createdAt).getTime() - new Date(s.createdAt).getTime()) -
        Math.abs(new Date(b.createdAt).getTime() - new Date(s.createdAt).getTime())
      );
      s._route = candidates[0];
      usedRouteIds.add(candidates[0].id);
    });

    // Verification flow steps are recorded only as audit logs (there is no
    // OrderStage for VERIFICATION), so map them to canonical labels here and
    // exclude them from the generic audit pass to avoid duplicates.
    const VERIFICATION_ACTION_LABELS = {
      SENT_FOR_VERIFICATION: 'Sent to Verification',
      ORDER_VERIFIED: 'Verification Approved',
      RETURNED_FOR_CORRECTION: 'Returned from Verification',
      RESUBMITTED_AFTER_VERIFICATION: 'Order Updated & Resubmitted for Verification',
      VERIFICATION_PENDING: 'Verification Pending'
    };
    const VERIFICATION_ACTION_STATUS = {
      SENT_FOR_VERIFICATION: 'ROUTED',
      ORDER_VERIFIED: 'VERIFIED',
      RETURNED_FOR_CORRECTION: 'RETURNED',
      RESUBMITTED_AFTER_VERIFICATION: 'RESUBMITTED',
      VERIFICATION_PENDING: 'PENDING'
    };

    // Stage-lifecycle events already captured below; these audits would just repeat them.
    const AUDIT_NOISE = new Set(['STAGE_ACCEPTED', 'STORE_ACCEPT', 'STORE_ROUTE', 'DISPATCH_ACCEPTED', 'DELIVERY_ACCEPTED', 'ORDER_CREATED', 'OUTLET_ORDER_CREATED', 'CUSTOMER_TAKEN', 'ESCALATION_OVERDUE']);

    const flatEntries = [];

    // 1) Stage lifecycle: received (transition) / accepted / completed
    stages.forEach(s => {
      const sLabel = labelOf(s.stageName);
      const recvActor = s._route?.sentByUser?.name || s.assignedEmployee?.name || stageActorMap[s.stageName]?.actor || null;
      flatEntries.push({
        id: `${s.id}-received`, type: 'stage', stage: s.stageName, stageLabel: sLabel,
        timestamp: s.createdAt, action: 'RECEIVED', label: transitionLabel(s),
        actor: recvActor, status: s.status,
        details: s.returnReason || (s.returnedFrom ? `Returned from ${labelOf(s.returnedFrom)}` : null),
        remarks: s._route?.remarks || null, returnReason: s.returnReason || null,
        from: s._route?.previousStage || s.returnedFrom || null, to: s.stageName
      });
      if (s.startedAt && acceptedLabel(s)) {
        flatEntries.push({
          id: `${s.id}-accepted`, type: 'stage', stage: s.stageName, stageLabel: sLabel,
          timestamp: s.startedAt, action: 'ACCEPTED', label: acceptedLabel(s),
          actor: s.assignedEmployee?.name || stageActorMap[s.stageName]?.actor || null,
          status: 'IN_PROGRESS', details: null, remarks: null, returnReason: null,
          from: null, to: s.stageName
        });
      }
      const skipComplete = s.stageName === 'ORDER_ENTRY' && isFirstStage(s);
      if (s.completedAt && completedLabel(s) && !skipComplete) {
        flatEntries.push({
          id: `${s.id}-completed`, type: 'stage', stage: s.stageName, stageLabel: sLabel,
          timestamp: s.completedAt, action: 'COMPLETED', label: completedLabel(s),
          actor: s.assignedEmployee?.name || stageActorMap[s.stageName]?.actor || null,
          status: 'COMPLETED', details: null, remarks: null, returnReason: null,
          from: null, to: s.stageName
        });
      }
    });

    // 2) Routing transitions not tied to an OrderStage (e.g. VERIFICATION → STORE,
    //    X → DELIVERED customer collection) — preserved as their own events.
    routingHistory.forEach(rh => {
      if (usedRouteIds.has(rh.id)) return;
      const toLabel = labelOf(rh.newStage);
      const isDeliveredRoute = rh.newStage === 'DELIVERED';
      flatEntries.push({
        id: rh.id, type: 'route', stage: rh.newStage, stageLabel: toLabel,
        timestamp: rh.createdAt, action: 'ROUTED',
        label: isDeliveredRoute ? 'Delivered (Customer Collection)' : `Sent to ${toLabel}`,
        actor: rh.sentByUser?.name || 'System', status: 'ROUTED',
        details: rh.remarks || null, remarks: rh.remarks || null, returnReason: null,
        from: rh.previousStage, to: rh.newStage
      });
    });

    // 3) Verification steps (deduped canonical labels + statuses)
    auditLogs.forEach(al => {
      const vLabel = VERIFICATION_ACTION_LABELS[al.action];
      if (!vLabel) return;
      flatEntries.push({
        id: al.id, type: 'audit', stage: 'VERIFICATION', stageLabel: 'Verification',
        timestamp: al.timestamp, action: al.action, label: vLabel,
        actor: al.user?.name || al.performedBy || 'System',
        status: VERIFICATION_ACTION_STATUS[al.action] || 'VERIFIED',
        details: al.details || null, remarks: null, returnReason: null,
        from: null, to: 'VERIFICATION'
      });
    });

    // 4) Every other meaningful audit event — append-only full history (edits,
    //    cancellations, re-approvals, returns, delivery updates, payments...).
    const hasOutForDeliveryCompletion = stages.some(s => s.stageName === 'OUT_FOR_DELIVERY' && s.completedAt);
    auditLogs.forEach(al => {
      if (AUDIT_NOISE.has(al.action)) return;
      if (VERIFICATION_ACTION_LABELS[al.action]) return;
      if (al.action === 'DELIVERED' && hasOutForDeliveryCompletion) return;
      flatEntries.push({
        id: al.id, type: 'audit', stage: null, stageLabel: null,
        timestamp: al.timestamp, action: al.action,
        label: ACTION_LABELS[al.action] || titleCase(al.action),
        actor: al.user?.name || al.performedBy || 'System', status: 'AUDIT',
        details: al.details || null, remarks: null, returnReason: null,
        from: null, to: null
      });
    });

    flatEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    flatEntries.forEach((e, i) => { e.isLatest = i === flatEntries.length - 1; });

    // Return both formats — consolidated for AdminDashboard, flat for OrderTrack
    res.json({ stageEntries, routeEntries, flatEntries, trackingStatus: getTrackingStatus(order), source: order?.source || null, replacementCaseId: order?.replacementCaseId || null });
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

    if (destinationStage === 'RETURN_TO_SOURCE') {
      const sourceStage = 'ORDER_ENTRY';
      await prisma.orderStage.update({
        where: { id: storeStage.id },
        data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Routed to ${destinationStage} by ${req.user.name}` }
      });
      await prisma.order.update({
        where: { id: orderId },
        data: { currentStage: sourceStage, status: 'PENDING', storeAcceptedAt: null }
      });
      await createAuditLog(orderId, 'STORE_RETURN_TO_SOURCE', `Order returned to ${sourceStage} by ${req.user.name}`, req.user.id);
      const io = req.app.get('io');
      io.emit('order-updated', { orderId });
      await notify.create(req, { type: 'store_routed', moduleName: 'Order Entry', path: '/order-entry', role: 'ORDER_ENTRY', title: 'Order Returned to Source', message: `Order #${order.orderNumber} returned from Store`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Store → Source', employeeName: req.user?.name }).catch(() => {});
      return res.json({ message: 'Order returned to source' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderStage.update({
        where: { id: storeStage.id },
        data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Routed to ${destinationStage} by ${req.user.name}` }
      });
      const durations = await getStageDurations(order.priority);
      const deadline = calculateDeadline(new Date(), durations[destinationStage] || 24);
      await tx.orderStage.create({
        data: { orderId, stageName: destinationStage, status: 'PENDING', deadlineAt: deadline }
      });
      await tx.order.update({
        where: { id: orderId },
        data: { currentStage: destinationStage, status: 'IN_PROGRESS' }
      });

      const recipientUsers = await prisma.user.findMany({
        where: { role: { in: getRolesForStage(destinationStage) } },
        select: { id: true }
      });
      await tx.routingHistory.create({
        data: {
          orderId, sentByUserId: req.user.id, sentToStage: destinationStage,
          sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
          previousStage: storeStage.stageName, newStage: destinationStage,
          remarks: remarks || `Routed from ${storeStage.stageName} by ${req.user.name}`,
          createdAt: new Date()
        }
      });
      await tx.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: destinationStage }
      });
    });

    await createAuditLog(orderId, 'STORE_ROUTE', `Routed from Store to ${destinationStage} by ${req.user.name}`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId });

    const destRoleMap = { 'PRODUCTION_ACCEPTANCE': 'STORE', 'PRODUCTION': 'PRODUCTION', 'LOGO_DESIGN': 'LOGO_DESIGN', 'DISPATCH': 'DISPATCH', 'OUTLET_RECEIVE': 'OUTLET' };
    const storeDestRole = destRoleMap[destinationStage] || 'STORE';
    await notify.create(req, { type: 'store_routed', moduleName: 'My Tasks', path: '/tasks', role: storeDestRole, title: 'New Task from Store', message: `Order #${order.orderNumber} sent to ${destinationStage}`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: `Store → ${destinationStage}`, employeeName: req.user?.name }).catch(() => {});

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
      data: { currentStage: 'STORE', status: 'PENDING' }
    });

    // Clear previous seenTask for STORE so it appears as a new task
    const storeRecipients = await prisma.user.findMany({
      where: { role: { in: getRolesForStage('STORE') } },
      select: { id: true }
    });
    await prisma.seenTask.deleteMany({
      where: { userId: { in: storeRecipients.map(u => u.id) }, orderId, stageName: 'STORE' }
    }).catch(() => {});

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

    await notify.create(req, { type: 'store_task', moduleName: 'My Tasks', path: '/tasks', role: 'STORE', title: 'Order Returned to Store', message: `Order #${order.orderNumber} returned from ${returnedFrom}`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Returned → Store', employeeName: req.user?.name }).catch(() => {});

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json({ message: `Order returned to Store from ${returnedFrom}`, order: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error returning order to Store', error: error.message });
  }
};

const returnToOutlet = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.source !== 'OUTLET') return res.status(400).json({ message: 'Only outlet orders can be returned to outlet' });
    if (!['PRODUCTION', 'PRODUCTION_ACCEPTANCE'].includes(order.currentStage)) {
      return res.status(400).json({ message: 'Order must be in Production to return to outlet' });
    }

    const activeStage = order.stages.find(s =>
      ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
    );
    // All production-completed outlet orders return to the Johar Town outlet — the central
    // dispatch hub. Johar Town, Jail Road, AND Abbottabad orders all land in Johar Town's
    // "Come From Production" tab; the final destination is decided from the In Dispatch module.
    const returnReason = 'Returned to Johar Town from Production';

    if (activeStage) {
      await prisma.orderStage.update({
        where: { id: activeStage.id },
        data: { status: 'COMPLETED', completedAt: new Date(), returnReason }
      });
    }

    const durations = await getStageDurations(order.priority);
    const deadline = calculateDeadline(new Date(), durations['OUTLET_RECEIVE'] || 48);
    await prisma.orderStage.create({
      data: { orderId, stageName: 'OUTLET_RECEIVE', status: 'PENDING', deadlineAt: deadline, returnReason }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: 'OUTLET_RECEIVE', status: 'PENDING' }
    });

    // Production-returned orders route to the Johar Town outlet (the operational hub).
    // Johar Town, Jail Road, AND Abbottabad orders all land in Johar Town
    // (JT manages JR + AB orders end-to-end).
    const targetOutlet = 'Johar Town';
    const outletUsers = await prisma.user.findMany({
      where: { role: 'OUTLET', name: { contains: targetOutlet, mode: 'insensitive' } },
      select: { id: true }
    });

    await prisma.routingHistory.create({
      data: {
        orderId, sentByUserId: req.user.id, sentToStage: 'OUTLET_RECEIVE',
        sentToUserIds: JSON.stringify(outletUsers.map(u => u.id)),
        previousStage: activeStage?.stageName || 'PRODUCTION', newStage: 'OUTLET_RECEIVE',
        remarks: `Returned to ${targetOutlet} outlet from Production (originated ${order.outletName || 'Unknown'})`,
        createdAt: new Date()
      }
    });

    await prisma.seenTask.deleteMany({
      where: { userId: { in: outletUsers.map(u => u.id) }, orderId, stageName: 'OUTLET_RECEIVE' }
    }).catch(() => {});

    await createAuditLog(orderId, 'RETURN_TO_OUTLET', `Returned to ${targetOutlet} from Production (originated ${order.outletName || 'Unknown'})`, req.user.id);

    const io = req.app.get('io');
    io.emit('order-updated', { orderId });

    await notify.create(req, { type: 'outlet_task', moduleName: 'My Tasks', path: '/tasks', role: 'OUTLET', title: 'Order Returned to Outlet', message: `Order #${order.orderNumber} returned from Production (originated ${order.outletName || 'Unknown'})`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Returned → Outlet', employeeName: req.user?.name }).catch(() => {});

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json({ message: `Order returned to ${targetOutlet}`, order: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error returning order to outlet', error: error.message });
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
    if (sourceFilter !== 'ALL') {
      if (sourceFilter === 'ONLINE') {
        whereStore.OR = [
          { source: { in: ['ONLINE', 'INTERNAL'] } },
          { outletName: { contains: 'ONLINE', mode: 'insensitive' } }
        ];
      } else {
        const outletFilter = sourceFilter.replace(/_/g, ' ') + ' BRANCH';
        whereStore.outletName = outletFilter;
      }
    }

    const storeOrders = await prisma.order.findMany({
      where: whereStore,
      include: {
        stages: { orderBy: { createdAt: 'asc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
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
      parsedDetails = order.productDetails;
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
      data: { productDetails: updatedItems }
    });

    await createAuditLog(orderId, 'AVAILABILITY_UPDATED',
      `Product availability updated: ${Object.entries(productAvailability).map(([k, v]) => `#${parseInt(k)+1}: ${v ? 'Completed' : 'Rejected'}`).join(', ')}`,
      req.user.id);

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: 'Product availability updated', items: updatedItems });
  } catch (error) {
    console.error('updateProductAvailability error:', error);
    res.status(500).json({ message: 'Error updating availability', error: error.message });
  }
};

const toggleProductVerification = async (req, res) => {
  const { orderId } = req.params;
  const { productIndex } = req.body;

  if (productIndex === undefined || productIndex === null || typeof productIndex !== 'number') {
    return res.status(400).json({ message: 'productIndex (number) is required' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const verification = order.productVerification || {};
    const key = String(productIndex);
    const current = verification[key] === true;
    verification[key] = !current;

    await prisma.order.update({
      where: { id: orderId },
      data: { productVerification: verification }
    });

    await createAuditLog(orderId, 'PRODUCT_VERIFIED',
      `Product #${productIndex + 1} ${verification[key] ? 'verified' : 'unverified'}`,
      req.user.id);

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: 'Product verification toggled', productVerification: verification });
  } catch (error) {
    console.error('toggleProductVerification error:', error);
    res.status(500).json({ message: 'Error toggling verification', error: error.message });
  }
};

const trackOrder = async (req, res) => {
  try {
    const query = (req.params.orderNumber || '').trim();
    if (!query) return res.status(400).json({ message: 'Order number or invoice number is required' });
    let order = await prisma.order.findUnique({
      where: { orderNumber: query },
      include: {
        stages: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: { id: true, name: true } }
      }
    });
    if (!order) {
      order = await prisma.order.findUnique({
        where: { invoiceNumber: query },
        include: { stages: { orderBy: { createdAt: 'asc' } }, createdBy: { select: { id: true, name: true } } }
      });
    }
    if (!order) {
      const matches = await prisma.order.findMany({
        where: { OR: [{ orderNumber: { contains: query } }, { invoiceNumber: { contains: query } }] },
        include: { stages: { orderBy: { createdAt: 'asc' } }, createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1
      });
      order = matches[0] || null;
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.trackingStatus = getTrackingStatus(order);

    // Link the replacement lifecycle to its ORIGINAL order (and vice versa) so
    // tracking shows the full original + replacement timelines as one connected story.
    try {
      if (order.source === 'REPLACEMENT' && order.replacementCaseId) {
        const repCase = await prisma.returnExchange.findUnique({
          where: { id: order.replacementCaseId },
          select: { orderId: true, orderNumber: true, status: true }
        });
        if (repCase) {
          const original = await prisma.order.findUnique({
            where: { id: repCase.orderId },
            select: { id: true, orderNumber: true, customerName: true, currentStage: true, status: true, source: true, totalPrice: true }
          });
          if (original) order._originalOrder = { ...original, trackingStatus: getTrackingStatus(original) };
        }
      } else {
        const repCase = await prisma.returnExchange.findFirst({
          where: { orderId: order.id, replacementOrderId: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, replacementOrderId: true }
        });
        if (repCase?.replacementOrderId) {
          const replacement = await prisma.order.findUnique({
            where: { id: repCase.replacementOrderId },
            select: { id: true, orderNumber: true, customerName: true, currentStage: true, status: true, source: true, totalPrice: true }
          });
          if (replacement) order._replacementOrder = { ...replacement, trackingStatus: getTrackingStatus(replacement) };
        }
      }
    } catch (linkErr) {
      console.error('[trackOrder] link resolution failed (non-critical):', linkErr.message);
    }

    res.json(order);
  } catch (error) {
    console.error('[trackOrder] error:', error.message);
    res.status(500).json({ message: 'Error tracking order' });
  }
};

// GET /api/orders/performance — date-filtered department order counts
const getOrderPerformance = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from ? new Date(from) : new Date('2000-01-01');
    const dateTo = to ? (to.includes('T') ? new Date((new Date(to)).getTime() - 1) : new Date(to + 'T23:59:59.999Z')) : new Date('2100-01-01');

    // Faisal: only new orders created by Faisal-role users within date range
    const faisalEntered = await prisma.order.count({
      where: { createdAt: { gte: dateFrom, lte: dateTo }, createdBy: { role: 'FAISAL' } }
    });

    // Helper: count DISTINCT orders that have a stage record matching criteria
    const distinctStageOrderCount = async (stageNameOrNames, dateField, statusFilter) => {
      const where = { stageName: Array.isArray(stageNameOrNames) ? { in: stageNameOrNames } : stageNameOrNames };
      if (dateField === 'startedAt') {
        where.startedAt = { gte: dateFrom, lte: dateTo };
        where.status = 'IN_PROGRESS';
      } else if (dateField === 'completedAt') {
        where.completedAt = { gte: dateFrom, lte: dateTo };
        where.status = 'COMPLETED';
      } else {
        where.createdAt = { gte: dateFrom, lte: dateTo };
        if (statusFilter) where.status = statusFilter;
      }
      const records = await prisma.orderStage.findMany({
        where,
        distinct: ['orderId'],
        select: { orderId: true }
      });
      return records.length;
    };

    // Store
    const [storeAccepted, storeSentForward, storePending] = await Promise.all([
      distinctStageOrderCount('STORE', 'startedAt'),
      distinctStageOrderCount('STORE', 'completedAt'),
      distinctStageOrderCount('STORE', 'createdAt', 'PENDING'),
    ]);

    // Logo
    const [logoAccepted, logoSentForward, logoPending] = await Promise.all([
      distinctStageOrderCount('LOGO_DESIGN', 'startedAt'),
      distinctStageOrderCount('LOGO_DESIGN', 'completedAt'),
      distinctStageOrderCount('LOGO_DESIGN', 'createdAt', 'PENDING'),
    ]);

    // Production (PRODUCTION_ACCEPTANCE + PRODUCTION)
    const prodStageNames = ['PRODUCTION_ACCEPTANCE', 'PRODUCTION'];
    const [prodAccepted, prodSentForward, prodPending] = await Promise.all([
      distinctStageOrderCount(prodStageNames, 'startedAt'),
      distinctStageOrderCount(prodStageNames, 'completedAt'),
      distinctStageOrderCount(prodStageNames, 'createdAt', 'PENDING'),
    ]);

    // Dispatch
    const dispatchReceivedRecords = await prisma.orderStage.findMany({
      where: { stageName: 'DISPATCH', createdAt: { gte: dateFrom, lte: dateTo } },
      distinct: ['orderId'],
      select: { orderId: true }
    });
    const dispatchReceived = dispatchReceivedRecords.length;
    const [dispatchDispatched, dispatchPending] = await Promise.all([
      distinctStageOrderCount('DISPATCH', 'completedAt'),
      distinctStageOrderCount('DISPATCH', 'createdAt', 'PENDING'),
    ]);

    // Inventory Verification
    const [verificationVerified, verificationPendingCount, verificationReturned] = await Promise.all([
      prisma.order.count({
        where: { verifiedAt: { gte: dateFrom, lte: dateTo } }
      }),
      prisma.order.count({
        where: {
          goForVerification: true,
          verifiedAt: null,
          createdAt: { gte: dateFrom, lte: dateTo }
        }
      }),
      prisma.order.count({
        where: { verificationReturnedAt: { gte: dateFrom, lte: dateTo } }
      }),
    ]);

    // Delivery (OUT_FOR_DELIVERY)
    const deliveryAssignedRecords = await prisma.orderStage.findMany({
      where: { stageName: 'OUT_FOR_DELIVERY', createdAt: { gte: dateFrom, lte: dateTo } },
      distinct: ['orderId'],
      select: { orderId: true }
    });
    const deliveryAssigned = deliveryAssignedRecords.length;
    const [deliveryDelivered, deliveryReturnedCount, deliveryPending] = await Promise.all([
      prisma.order.count({
        where: { deliveredAt: { gte: dateFrom, lte: dateTo } }
      }),
      prisma.order.count({
        where: { returnedAt: { gte: dateFrom, lte: dateTo } }
      }),
      distinctStageOrderCount('OUT_FOR_DELIVERY', 'createdAt', 'PENDING'),
    ]);

    res.json({
      faisal: { entered: faisalEntered },
      verification: { verified: verificationVerified, pendingVerification: verificationPendingCount, returned: verificationReturned },
      store: { accepted: storeAccepted, sentForward: storeSentForward, pending: storePending },
      logo: { accepted: logoAccepted, sentForward: logoSentForward, pending: logoPending },
      production: { accepted: prodAccepted, sentForward: prodSentForward, pending: prodPending },
      dispatch: { received: dispatchReceived, dispatched: dispatchDispatched, pending: dispatchPending },
      delivery: { assigned: deliveryAssigned, delivered: deliveryDelivered, returned: deliveryReturnedCount, pending: deliveryPending }
    });
  } catch (error) {
    console.error('[getOrderPerformance] error:', error.message);
    res.status(500).json({ message: 'Failed to get order performance', error: error.message });
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
  returnToOutlet,
  getStoreDashboardOrders,
  bulkRouteOrders,
  dispatchOrder,
  updateDispatchStatus,
  acceptTask,
  getOrderTimeline,
  updateProductAvailability,
  toggleProductVerification,
  trackOrder,
  getOrderById,
  getRolesForStage,
  getOrderPerformance,
  deductInventoryItems,
  createCancellationRequest,
  getCancellationRequests,
  approveCancellationRequest,
  rejectCancellationRequest
};
