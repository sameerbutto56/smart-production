const prisma = require('../prisma');

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

const createAuditLog = async (orderId, action, details, userId, tx) => {
  try {
    if (!userId) {
      console.warn('Audit Log: No userId provided for action:', action);
      return;
    }
    const db = tx || prisma;
    await db.auditLog.create({
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

const classifyOrderItems = async (order, itemList = null) => {
  let parsedDetails;
  try {
    parsedDetails = order.productDetails;
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

const reverseInventoryForRefund = async (order, userId) => {
  let parsedDetails;
  try {
    parsedDetails = order.productDetails;
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

// When a replacement order (source: REPLACEMENT, linked via replacementCaseId) completes its
// pipeline, auto-sync the ReturnExchange case so its status follows the actual order outcome.
// Idempotent — no-op if the case was already marked completed.
const SYNC_REPLACEMENT_SYSTEM_USER_ID = '3cc08d49-90d0-439d-9cec-6e3e8b50418a';
const syncReplacementCaseOnOrderCompletion = async (order, userId) => {
  try {
    if (!order || !order.replacementCaseId) return { synced: false, reason: 'not-replacement' };
    const fresh = await prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true, currentStage: true, deliveredAt: true, orderNumber: true }
    });
    const isComplete = fresh && (
      fresh.status === 'COMPLETED' ||
      fresh.currentStage === 'DELIVERED' ||
      fresh.deliveredAt
    );
    if (!isComplete) return { synced: false, reason: 'not-complete' };

    const record = await prisma.returnExchange.findUnique({ where: { id: order.replacementCaseId } });
    if (!record) return { synced: false, reason: 'case-not-found' };
    if (record.replacementCompleted) return { synced: true, caseId: record.id, skipped: 'already-completed' };

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.returnExchange.update({
        where: { id: record.id },
        data: {
          status: 'REPLACEMENT_COMPLETED',
          replacementCompleted: true,
          replacementCompletedAt: now,
          replacementCompletedBy: 'System (replacement order completed)'
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'REPLACEMENT_STATUS_UPDATED',
          details: `Replacement order ${fresh?.orderNumber || order.orderNumber || ''} completed its pipeline — case auto-marked REPLACEMENT_COMPLETED.`,
          performedBy: userId || SYNC_REPLACEMENT_SYSTEM_USER_ID
        }
      });
      return tx.returnExchange.findUnique({ where: { id: record.id } });
    });

    return { synced: true, caseId: record.id, updated };
  } catch (err) {
    console.error('Replacement case auto-sync error:', err);
    return { synced: false, reason: 'error', error: err.message };
  }
};

const DISPATCH_RESET_FIELDS = {
  currentStage: 'DISPATCH',
  status: 'PENDING',
  dispatchOfficer: null,
  dispatchStatus: 'PENDING',
  deliveredAt: null,
  returnedAt: null,
  trackingNumber: null,
  courierDetails: null
};

const getStageDurations = async (priority = 'NORMAL') => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
  let config = {
    stageDurations: { STORE: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48, LOGO_DESIGN: 24, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
    slaMultipliers: { NORMAL: 1, URGENT: 0.75, SUPER_URGENT: 0.5 }
  };
  if (setting) {
    try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) {}
  }
  const slaMultiplier = config.slaMultipliers?.[priority] ?? 1;
  const durations = config.stageDurations || {};
  const adjusted = {};
  for (const [stage, hours] of Object.entries(durations)) {
    adjusted[stage] = Math.round((hours * slaMultiplier) * 100) / 100;
  }
  return adjusted;
};

const ensureSingleActiveDispatchStage = async (orderId, priority = 'NORMAL', tx = prisma) => {
  // 1. Atomically close any active non-DISPATCH stages
  await tx.orderStage.updateMany({
    where: {
      orderId,
      status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'] },
      stageName: { not: 'DISPATCH' }
    },
    data: { status: 'COMPLETED', completedAt: new Date() }
  });

  // 2. Check if an active DISPATCH stage already exists (idempotent duplicate prevention)
  const existing = await tx.orderStage.findFirst({
    where: {
      orderId,
      stageName: 'DISPATCH',
      status: { in: ['PENDING', 'IN_PROGRESS'] }
    }
  });

  if (!existing) {
    const { calculateDeadline } = require('../utils/deadline');
    const durations = await getStageDurations(priority);
    const deadline = calculateDeadline(new Date(), durations['DISPATCH'] || 12);
    return await tx.orderStage.create({
      data: {
        orderId,
        stageName: 'DISPATCH',
        status: 'PENDING',
        deadlineAt: deadline
      }
    });
  }
  return existing;
};

module.exports = {
  cache,
  CACHE_TTL,
  isSystemPaused,
  createAuditLog,
  classifyOrderItems,
  reverseInventoryForRefund,
  calculateAndRecordRevenue,
  syncReplacementCaseOnOrderCompletion,
  DISPATCH_RESET_FIELDS,
  getStageDurations,
  ensureSingleActiveDispatchStage
};
