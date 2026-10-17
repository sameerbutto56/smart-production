const prisma = require('../prisma');
const cache = require('../utils/cache');
const notify = require('../utils/notify');
const { resolveMasterPrice } = require('../utils/priceSync');
const { recordInventoryMovement } = require('../utils/inventoryMovement');

const generateTransferNumber = async () => {
  const d = new Date();
  const dayPrefix = `TRF-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const last = await prisma.outletDemandRequest.findFirst({
    where: { transferNumber: { startsWith: dayPrefix } },
    orderBy: { transferNumber: 'desc' },
    select: { transferNumber: true }
  });
  let nextNum = 1;
  if (last) {
    const parts = last.transferNumber.split('-');
    nextNum = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${dayPrefix}-${String(nextNum).padStart(5, '0')}`;
};

const createDemandRequest = async (req, res) => {
  try {
    const { items, notes } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    const outletName = req.user?.outletName ||
      (req.user?.name?.toLowerCase().includes('johar') ? 'Johar Town' :
       req.user?.name?.toLowerCase().includes('jail') ? 'Jail Road' :
       req.user?.name?.toLowerCase().includes('abbottabad') ? 'Abbottabad' : req.user?.name || 'Outlet');

    const normStr = (s) => (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

    // Enrich demand items with canonical warehouse item info and variant barcode
    const enrichedItems = [];
    for (const i of items) {
      let inv = null;
      if (i.inventoryItemId) {
        inv = await prisma.inventoryItem.findUnique({ where: { id: i.inventoryItemId } });
      }
      if (!inv && i.productName) {
        inv = await prisma.inventoryItem.findFirst({
          where: { name: { equals: i.productName, mode: 'insensitive' } }
        });
      }
      let matchedVariant = null;
      if (inv && Array.isArray(inv.variants)) {
        matchedVariant = inv.variants.find(v =>
          normStr(v.color) === normStr(i.color) &&
          normStr(v.size) === normStr(i.size)
        );
      }
      enrichedItems.push({
        inventoryItemId: inv?.id || i.inventoryItemId || null,
        productName: inv?.name || i.productName,
        size: matchedVariant?.size?.trim() || i.size || '',
        color: matchedVariant?.color?.trim() || i.color || '',
        barcode: i.barcode || matchedVariant?.barcode || null,
        requestedQty: parseInt(i.requestedQty, 10) || 1,
        approvedQty: 0,
        dispatchedQty: 0,
        inTransitQty: 0,
        acceptedQty: 0
      });
    }

    const demand = await prisma.outletDemandRequest.create({
      data: {
        outletId: req.user.id,
        outletName,
        items: enrichedItems,
        notes: notes || '',
        status: 'PENDING',
        transferNumber: await generateTransferNumber()
      }
    });
    const io = req.app.get('io');
    if (io) {
      io.emit('demand:new', {
        id: demand.id,
        outletName: demand.outletName,
        transferNumber: demand.transferNumber,
        status: demand.status,
        itemCount: items.length,
        createdAt: demand.createdAt
      });
    }

    await notify.create(req, { type: 'demand', moduleName: 'Warehouse', path: '/warehouse', role: 'STORE', title: 'New Demand Request', message: `Demand from ${outletName}`, action: 'Demand Created', employeeName: req.user?.name }).catch(() => {});

    res.status(201).json(demand);
  } catch (error) {
    res.status(500).json({ message: 'Error creating demand request', error: error.message });
  }
};

const getMyDemandRequests = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const outletName = req.user?.outletName ||
      (req.user?.name?.toLowerCase().includes('johar') ? 'Johar Town' :
       req.user?.name?.toLowerCase().includes('jail') ? 'Jail Road' :
       req.user?.name?.toLowerCase().includes('abbottabad') ? 'Abbottabad' : req.user?.name || '');
    const demands = await prisma.outletDemandRequest.findMany({
      where: {
        OR: [
          { outletId: req.user.id },
          ...(outletName ? [{ outletName: { equals: outletName, mode: 'insensitive' } }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(demands);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching demand requests', error: error.message });
  }
};

const getAllDemandRequests = async (req, res) => {
  try {
    const { status, outletName } = req.query;
    const where = {};
    if (status) where.status = status;
    if (outletName) where.outletName = { contains: outletName, mode: 'insensitive' };
    const limit = parseInt(req.query.limit) || 200;
    const demands = await prisma.outletDemandRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(demands);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching demand requests', error: error.message });
  }
};

const approveDemandRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, items, storeNotes } = req.body;
    const validStatuses = ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await prisma.outletDemandRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Demand request not found' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ message: `Already ${existing.status.toLowerCase()}. Cannot modify.` });
    }

    const updateData = { status, storeNotes: storeNotes || '', approvedById: req.user.id };

    if (status === 'REJECTED') {
      updateData.items = existing.items.map(i => ({ ...i, approvedQty: 0 }));
    } else if (status === 'APPROVED' && items) {
      updateData.items = items.map(i => ({
        ...i,
        approvedQty: i.approvedQty !== undefined ? i.approvedQty : i.requestedQty
      }));
    } else if (status === 'PARTIALLY_APPROVED' && items) {
      updateData.items = items.map(i => ({
        ...i,
        approvedQty: i.approvedQty !== undefined ? i.approvedQty : 0
      }));
    } else if (status === 'APPROVED') {
      updateData.items = existing.items.map(i => ({ ...i, approvedQty: i.requestedQty }));
    }

    if (status !== 'REJECTED') {
      updateData.approvedAt = new Date();
    }

    // Atomic approval: status update + warehouse deduction + audit log in ONE
    // transaction. Previously the status was updated first and the deduction loop
    // ran outside a transaction — a mid-loop DB failure left the demand APPROVED
    // with a partial deduction and no audit log (retry was then blocked by the
    // PENDING-only guard). The in-transaction PENDING re-check also closes the
    // race where two concurrent approvals both passed the outer guard.
    let updated;

    await prisma.$transaction(async (tx) => {
      const existingNow = await tx.outletDemandRequest.findUnique({ where: { id } });
      if (!existingNow || existingNow.status !== 'PENDING') {
        const err = new Error('Demand request is no longer pending. Cannot approve.');
        err.code = 'DEMAND_NOT_PENDING';
        throw err;
      }

      updated = await tx.outletDemandRequest.update({
        where: { id },
        data: updateData
      });

      // Warehouse stock is NOT deducted here any more. Approval now only RESERVES
      // the request (status APPROVED/APPROVED_PARTIAL). The actual warehouse
      // deduction happens atomically at DISPATCH via dispatchDemand — approved but
      // not-yet-dispatched demands hold their stock reserved.

      await tx.auditLog.create({
        data: {
          orderId: null,
          action: 'DEMAND_REQUEST_' + status,
          details: `Demand request ${id} from ${existing.outletName} ${status.toLowerCase()} by ${req.user.name || req.user.id}${status !== 'REJECTED' ? ' | stock reserved until dispatch' : ''}`,
          performedBy: req.user.id
        }
      });
    }, { timeout: 30000 });

    // Force inventory-dependent caches to rebuild immediately (synchronous — no .catch()).
    if (status !== 'REJECTED') {
      try {
        cache.delPattern('pos:');
        cache.delPattern('warehouse:');
        cache.delPattern('products:');
      } catch (cacheErr) {
        console.error('Cache invalidation error after demand approval:', cacheErr);
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('demand:updated', {
        id: updated.id,
        outletName: updated.outletName,
        transferNumber: updated.transferNumber,
        status: updated.status,
        storeNotes: updated.storeNotes
      });
    }

    await notify.create(req, { type: 'demand', moduleName: 'Outlet Requests', path: '/outlet-requests', role: 'OUTLET', title: 'Demand Updated', message: `Demand #${existing.transferNumber} ${status}`, action: `Demand ${status}`, employeeName: req.user?.name }).catch(() => {});

    res.json(updated);
  } catch (error) {
    if (error.code === 'DEMAND_NOT_PENDING') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating demand request', error: error.message });
  }
};

const getInventoryForOutlet = async (req, res) => {
  try {
    const { search, outletName: queryOutlet } = req.query;
    const outletName = queryOutlet || req.user?.outletName || '';
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        category: true,
        color: true,
        size: true,
        fabric: true,
        variants: true
      }
    });
    let outletStockMap = {};
    if (outletName) {
      const outletItems = await prisma.outletInventory.findMany({
        where: { outletName }
      });
      for (const oi of outletItems) {
        const key = `${oi.name}|${oi.color || ''}|${oi.size || ''}`;
        outletStockMap[key] = oi;
      }
    }
    const merged = items.map(item => {
      const key = `${item.name}|${item.color || ''}|${item.size || ''}`;
      const outletData = outletStockMap[key];
      return {
        ...item,
        outletStock: outletData ? outletData.stock : 0,
        outletBarcode: outletData ? outletData.barcode : null,
        outletPrice: outletData ? outletData.price : null,
        outletInventoryId: outletData ? outletData.id : null,
        inOutlet: !!outletData
      };
    });
    let filtered = merged;
    if (search) {
      const q = search.toLowerCase();
      filtered = merged.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.color?.toLowerCase().includes(q)
      );
    }
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
};

const getDemandStats = async (req, res) => {
  try {
    const [pending, approved, partially, rejected, dispatched, completed, total] = await Promise.all([
      prisma.outletDemandRequest.count({ where: { status: 'PENDING' } }),
      prisma.outletDemandRequest.count({ where: { status: 'APPROVED' } }),
      prisma.outletDemandRequest.count({ where: { status: 'PARTIALLY_APPROVED' } }),
      prisma.outletDemandRequest.count({ where: { status: 'REJECTED' } }),
      prisma.outletDemandRequest.count({ where: { status: 'DISPATCHED' } }),
      prisma.outletDemandRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.outletDemandRequest.count()
    ]);
    res.json({ pending, approved, partiallyApproved: partially, rejected, dispatched, completed, total });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching demand stats', error: error.message });
  }
};

const djb2 = (s) => {
  if (!s) return 0;
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};
const generateBarcode = (itemId, size, color, attempt = 0) => {
  const prefix = 'POS';
  const raw = itemId.replace(/-/g, '').slice(0, 8);
  const variantStr = `${size || ''}|${color || ''}|${attempt}`;
  const fullHash = djb2(variantStr);
  const base = ((parseInt(raw, 16) || 0) + fullHash).toString(36).toUpperCase().slice(0, 8);
  return `${prefix}${base}`;
};

const checkWarehouseStockAvailability = async (item, tx) => {
  const client = tx || prisma;
  let inv = null;
  if (item.inventoryItemId) {
    inv = await client.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
  }
  if (!inv && item.productName) {
    inv = await client.inventoryItem.findFirst({
      where: { name: { equals: item.productName, mode: 'insensitive' } }
    });
  }
  if (!inv) {
    return { available: 0, exists: false, error: `Warehouse product "${item.productName}" not found.` };
  }
  const normStr = (s) => (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
  const itemColorNorm = normStr(item.color);
  const itemSizeNorm = normStr(item.size);

  if (Array.isArray(inv.variants) && inv.variants.length > 0) {
    const matched = inv.variants.find(v =>
      (!itemColorNorm || normStr(v.color) === itemColorNorm) &&
      (!itemSizeNorm || normStr(v.size) === itemSizeNorm)
    );
    const stock = matched ? (matched.stock || 0) : 0;
    return { available: stock, exists: true, inv, matchedVariant: matched };
  }
  return { available: inv.stock || 0, exists: true, inv, matchedVariant: null };
};

const deductWarehouseStock = async (inventoryItemId, productName, color, size, qty, tx) => {
  if (!qty || qty <= 0) return 0;
  const client = tx || prisma;
  let inv = null;
  if (inventoryItemId) {
    inv = await client.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  }
  if (!inv && productName) {
    inv = await client.inventoryItem.findFirst({
      where: { name: { equals: productName, mode: 'insensitive' } }
    });
  }
  if (!inv) return 0;

  const normStr = (s) => (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
  const targetColorNorm = normStr(color);
  const targetSizeNorm = normStr(size);

  let deductedQty = 0;

  if (Array.isArray(inv.variants) && inv.variants.length > 0) {
    let found = false;
    const variants = inv.variants.map(v => {
      if (found) return v;
      const matchColor = !targetColorNorm || normStr(v.color) === targetColorNorm;
      const matchSize = !targetSizeNorm || normStr(v.size) === targetSizeNorm;
      if (!matchColor || !matchSize) return v;
      const deduct = Math.min(qty, v.stock || 0);
      if (deduct <= 0) return v;
      found = true;
      deductedQty = deduct;
      return { ...v, stock: (v.stock || 0) - deduct };
    });
    if (found) {
      const newTotal = variants.reduce((s, v) => s + (v.stock || 0), 0);
      await client.inventoryItem.update({
        where: { id: inv.id },
        data: { variants, stock: newTotal }
      });
    }
  } else {
    deductedQty = Math.min(qty, inv.stock || 0);
    if (deductedQty > 0) {
      await client.inventoryItem.update({
        where: { id: inv.id },
        data: { stock: { decrement: deductedQty } }
      });
    }
  }
  return deductedQty;
};

const dispatchDemandRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryChannel } = req.body;
    const existing = await prisma.outletDemandRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Demand request not found' });
    if (existing.status !== 'APPROVED' && existing.status !== 'PARTIALLY_APPROVED') {
      return res.status(400).json({ message: `Cannot dispatch a ${existing.status.toLowerCase()} request. Only approved/partially approved requests can be dispatched.` });
    }

    const userRole = req.user?.role;
    const isStaff = userRole === 'STORE' || userRole === 'STORE_EMPLOYEE' || ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    if (!isStaff) return res.status(403).json({ message: 'Only the warehouse/store can dispatch a demand' });

    const channel = deliveryChannel || 'SELF_DELIVERY';
    if (channel !== 'ENAMELS' && channel !== 'SELF_DELIVERY') {
      return res.status(400).json({ message: 'Invalid delivery channel. Use ENAMELS or SELF_DELIVERY.' });
    }
    const { courierType } = req.body;
    const isAbbottabad = String(existing.outletName || '').toLowerCase().includes('abbottabad');
    const finalCourierType = isAbbottabad && courierType === 'BILTY' ? 'BILTY' : 'TCS';
    const finalBiltyAmount = isAbbottabad && finalCourierType === 'BILTY' ? 1500 : 0;

    let deductedCount = 0;
    let deductedSummary = [];
    let abbottabadFinancialData = null;

    // Atomic dispatch: guard + warehouse stock validation & deduction + Abbottabad financials + dispatch fields
    await prisma.$transaction(async (tx) => {
      const recheck = await tx.outletDemandRequest.findUnique({ where: { id } });
      if (!recheck || (recheck.status !== 'APPROVED' && recheck.status !== 'PARTIALLY_APPROVED') || recheck.dispatchedAt) {
        const err = new Error('This demand is no longer dispatchable.');
        err.code = 'DEMAND_NOT_DISPATCHABLE';
        throw err;
      }

      const items = typeof recheck.items === 'string' ? JSON.parse(recheck.items) : recheck.items;

      // 1. Validate available warehouse stock before any deduction
      for (const item of items || []) {
        const approvedQty = parseInt(item.approvedQty, 10) || 0;
        if (approvedQty <= 0) continue;
        const avail = await checkWarehouseStockAvailability(item, tx);
        if (!avail.exists) {
          const err = new Error(avail.error);
          err.code = 'PRODUCT_NOT_FOUND';
          throw err;
        }
        if (avail.available < approvedQty) {
          const err = new Error(`Insufficient warehouse stock for "${item.productName}${item.size ? ' (' + item.size + ')' : ''}". Available stock: ${avail.available}, approved to dispatch: ${approvedQty}.`);
          err.code = 'INSUFFICIENT_STOCK';
          throw err;
        }
      }

      let totalProductValue = 0;
      let totalCostValue = 0;
      let costPriceMissing = false;
      const missingProducts = [];
      const itemFinancials = [];
      const updatedDispatchedItems = [];

      for (const item of items || []) {
        const approvedQty = parseInt(item.approvedQty, 10) || 0;
        if (approvedQty <= 0) {
          updatedDispatchedItems.push({ ...item, dispatchedQty: 0, inTransitQty: 0 });
          continue;
        }
        const deducted = await deductWarehouseStock(item.inventoryItemId, item.productName, item.color, item.size, approvedQty, tx);
        if (deducted > 0) {
          deductedCount++;
          deductedSummary.push(`${item.productName}${item.size ? ' ' + item.size : ''}: ${deducted}`);
          await recordInventoryMovement({
            movementType: 'TRANSFER_OUT',
            location: 'Warehouse',
            productId: item.inventoryItemId || null,
            productName: item.productName,
            color: item.color,
            size: item.size,
            barcode: item.barcode || null,
            previousQty: 0,
            newQty: 0,
            difference: -deducted,
            referenceId: recheck.transferNumber,
            notes: `Demand dispatched to ${recheck.outletName}`,
            performedBy: req.user?.name || 'Staff',
            tx
          }).catch(() => {});
        }

        updatedDispatchedItems.push({
          ...item,
          dispatchedQty: deducted,
          inTransitQty: deducted
        });

        if (isAbbottabad) {
          // Resolve actual selling price
          let inv = null;
          if (item.inventoryItemId) {
            inv = await tx.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
          }
          if (!inv) {
            const matches = await tx.inventoryItem.findMany({
              where: { name: { equals: item.productName, mode: 'insensitive' } }
            });
            inv = matches[0] || null;
          }
          const masterPrice = inv ? (resolveMasterPrice(inv, item.color, item.size) || parseFloat(inv.price) || 0) : 0;
          const actualLineTotal = approvedQty * masterPrice;
          totalProductValue += actualLineTotal;

          // Resolve internal cost price
          let costPrice = null;
          const costMatch = await tx.abbottabadCostPriceItem.findFirst({
            where: {
              productName: { equals: item.productName, mode: 'insensitive' },
              ...(item.size ? { size: { equals: item.size, mode: 'insensitive' } } : {}),
              ...(item.color ? { color: { equals: item.color, mode: 'insensitive' } } : {})
            },
            orderBy: { createdAt: 'desc' }
          });
          if (costMatch && costMatch.costPrice > 0) {
            costPrice = costMatch.costPrice;
          } else {
            const fallbackMatch = await tx.abbottabadCostPriceItem.findFirst({
              where: { productName: { equals: item.productName, mode: 'insensitive' } },
              orderBy: { createdAt: 'desc' }
            });
            if (fallbackMatch && fallbackMatch.costPrice > 0) {
              costPrice = fallbackMatch.costPrice;
            } else if (inv?.costPrice != null && parseFloat(inv.costPrice) > 0) {
              costPrice = parseFloat(inv.costPrice);
            }
          }

          let costLineTotal = null;
          let isMissingCost = false;
          if (costPrice != null && costPrice > 0) {
            costLineTotal = approvedQty * costPrice;
            totalCostValue += costLineTotal;
          } else {
            costPriceMissing = true;
            isMissingCost = true;
            missingProducts.push(item.productName);
          }

          itemFinancials.push({
            productName: item.productName,
            size: item.size || '',
            color: item.color || '',
            requestedQty: item.requestedQty || 0,
            approvedQty,
            actualUnitPrice: masterPrice,
            actualLineTotal,
            costUnitPrice: costPrice,
            costLineTotal,
            costMissing: isMissingCost
          });
        }
      }

      // Abbottabad-specific financial record & amount deduction
      if (isAbbottabad) {
        const actualPlusBilty = totalProductValue + finalBiltyAmount;
        const costPlusBilty = totalCostValue > 0 ? (totalCostValue + finalBiltyAmount) : null;

        abbottabadFinancialData = await tx.abbottabadDemandFinancial.upsert({
          where: { demandId: recheck.id },
          create: {
            demandId: recheck.id,
            transferNumber: recheck.transferNumber,
            productValue: totalProductValue,
            biltyType: finalCourierType,
            biltyAmount: finalBiltyAmount,
            actualPlusBilty,
            costAmount: totalCostValue > 0 ? totalCostValue : null,
            costPlusBilty,
            costPriceMissing,
            missingProductNames: missingProducts,
            itemFinancials
          },
          update: {
            transferNumber: recheck.transferNumber,
            productValue: totalProductValue,
            biltyType: finalCourierType,
            biltyAmount: finalBiltyAmount,
            actualPlusBilty,
            costAmount: totalCostValue > 0 ? totalCostValue : null,
            costPlusBilty,
            costPriceMissing,
            missingProductNames: missingProducts,
            itemFinancials
          }
        });

        // Deduct from Abbottabad Amount Account atomically if account exists
        let acc = await tx.abbottabadAmountAccount.findUnique({
          where: { outletName: 'Abbottabad' }
        });
        if (!acc) {
          acc = await tx.abbottabadAmountAccount.create({
            data: { outletName: 'Abbottabad', approvedAmount: 0, runningBalance: 0, totalConsumed: 0 }
          });
        }

        // Idempotency: only deduct if not already deducted for this demand
        const existingDeduction = await tx.abbottabadAmountLedger.findFirst({
          where: { demandId: recheck.id, actionType: 'DEMAND_DEDUCTION' }
        });

        if (!existingDeduction && actualPlusBilty > 0) {
          const prevBalance = acc.runningBalance;
          const newBalance = prevBalance - actualPlusBilty;
          const newTotalConsumed = acc.totalConsumed + actualPlusBilty;

          await tx.abbottabadAmountAccount.update({
            where: { id: acc.id },
            data: {
              runningBalance: newBalance,
              totalConsumed: newTotalConsumed
            }
          });

          await tx.abbottabadAmountLedger.create({
            data: {
              accountId: acc.id,
              demandId: recheck.id,
              demandTransferNumber: recheck.transferNumber,
              actionType: 'DEMAND_DEDUCTION',
              previousAmount: acc.approvedAmount,
              adjustmentAmount: 0,
              newAmount: acc.approvedAmount,
              previousBalance: prevBalance,
              consumedAmount: actualPlusBilty,
              newBalance: newBalance,
              details: `Demand deduction for ${recheck.transferNumber || recheck.id.slice(0, 8)} (Products: ₨${totalProductValue.toLocaleString()} + ${finalCourierType}: ₨${finalBiltyAmount.toLocaleString()})`,
              performedById: req.user.id,
              performedByName: req.user.name || req.user.email,
              performedByRole: req.user.role
            }
          });
        }
      }

      await tx.outletDemandRequest.update({
        where: { id },
        data: {
          status: 'DISPATCHED',
          dispatchedAt: new Date(),
          dispatchedById: req.user.id,
          deliveryChannel: channel,
          deliveryBoyName: channel === 'ENAMELS' ? 'Enamels Delivery' : null,
          items: updatedDispatchedItems
        }
      });

      await tx.auditLog.create({
        data: {
          orderId: null,
          action: 'DEMAND_REQUEST_DISPATCHED',
          details: `Demand request ${id} (${recheck.transferNumber || ''}) dispatched by ${req.user.name || req.user.id} via ${channel}${isAbbottabad ? ` [Courier: ${finalCourierType} ₨${finalBiltyAmount}]` : ''}${deductedCount ? ` | warehouse stock deducted: ${deductedSummary.join(', ')}` : ''}`,
          performedBy: req.user.id
        }
      });
    }, { timeout: 30000 });

    try {
      cache.delPattern('pos:');
      cache.delPattern('warehouse:');
      cache.delPattern('products:');
      cache.delPattern('product-data:');
      cache.delPattern('outlet:');
    } catch (cacheErr) {
      console.error('Cache invalidation error after demand dispatch:', cacheErr);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('demand:updated', { id, transferNumber: existing.transferNumber, status: 'DISPATCHED', outletName: existing.outletName });
      io.emit('demand:dispatched', { id, transferNumber: existing.transferNumber, status: 'DISPATCHED', outletName: existing.outletName });
      io.emit('inventory-updated', { source: 'demand-dispatch', demandId: id });
    }

    await notify.create(req, { type: 'demand', moduleName: channel === 'ENAMELS' ? 'Delivery Boy' : 'Outlet Requests', path: channel === 'ENAMELS' ? '/delivery' : '/outlet-requests', role: channel === 'ENAMELS' ? 'DELIVERY_BOY' : 'OUTLET', title: 'Demand Dispatched', message: `Demand #${existing.transferNumber} dispatched via ${channel}`, action: 'Demand Dispatched', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: 'Demand dispatched.', deductedCount, deducted: deductedSummary });
  } catch (error) {
    if (error.code === 'DEMAND_NOT_DISPATCHABLE') {
      return res.status(409).json({ message: error.message });
    }
    if (error.code === 'INSUFFICIENT_STOCK' || error.code === 'PRODUCT_NOT_FOUND') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error dispatching demand request', error: error.message });
  }
};

const acceptDemandRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.outletDemandRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Demand request not found' });
    if (existing.status !== 'APPROVED' && existing.status !== 'PARTIALLY_APPROVED' && existing.status !== 'DISPATCHED') {
      return res.status(400).json({ message: `Cannot accept a ${existing.status.toLowerCase()} request. Only approved/partially approved/dispatched requests can be accepted.` });
    }

    let results = [];
    let transferNumber = existing.transferNumber;
    let outletName = existing.outletName;

    // Atomic accept: claim (acceptedAt null -> set) + outlet-inventory additions + audit
    // log in ONE transaction, with an in-tx conditional re-check so two concurrent
    // accepts (e.g. a double-click / simultaneous API calls) can NEVER both apply.
    try {
      await prisma.$transaction(async (tx) => {
        // Idempotency/claim: only one caller can flip acceptedAt null -> set.
        const claim = await tx.outletDemandRequest.updateMany({
          where: { id, acceptedAt: null, status: { in: ['APPROVED', 'PARTIALLY_APPROVED', 'DISPATCHED'] } },
          data: { acceptedAt: new Date(), acceptedById: req.user.id, status: 'COMPLETED' }
        });
        if (claim.count === 0) {
          const err = new Error('This demand has already been accepted.');
          err.code = 'DEMAND_ALREADY_ACCEPTED';
          throw err;
        }

        const rawItems = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items;
        const normStr = (s) => (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

        const updatedDemandItems = [];

        for (const it of rawItems) {
          const dispatchedQty = parseInt(it.dispatchedQty, 10) || parseInt(it.approvedQty, 10) || 0;
          if (dispatchedQty <= 0) {
            updatedDemandItems.push({ ...it, acceptedQty: 0, inTransitQty: 0 });
            continue;
          }

          // Support optional item-level acceptedQty from req.body.items
          let acceptedQty = dispatchedQty;
          if (Array.isArray(req.body?.items)) {
            const bodyMatch = req.body.items.find(b =>
              (b.inventoryItemId && b.inventoryItemId === it.inventoryItemId) ||
              (normStr(b.productName) === normStr(it.productName) && normStr(b.color) === normStr(it.color) && normStr(b.size) === normStr(it.size))
            );
            if (bodyMatch && bodyMatch.acceptedQty !== undefined) {
              acceptedQty = Math.max(0, parseInt(bodyMatch.acceptedQty, 10) || 0);
            }
          }

          let inv = null;
          if (it.inventoryItemId) {
            inv = await tx.inventoryItem.findUnique({ where: { id: it.inventoryItemId } });
          }
          if (!inv && it.productName) {
            inv = await tx.inventoryItem.findFirst({
              where: { name: { equals: it.productName, mode: 'insensitive' } }
            });
          }
          if (!inv) {
            inv = {
              id: it.inventoryItemId || null,
              name: it.productName,
              category: it.category || '',
              price: it.price || 0,
              variants: []
            };
          }

          const itemColorNorm = normStr(it.color);
          const itemSizeNorm = normStr(it.size);

          let matchedVariant = null;
          if (Array.isArray(inv.variants)) {
            matchedVariant = inv.variants.find(v =>
              normStr(v.color) === itemColorNorm &&
              normStr(v.size) === itemSizeNorm
            );
          }

          const variantBarcode = it.barcode || matchedVariant?.barcode || null;
          const canonicalColor = matchedVariant?.color ? matchedVariant.color.trim() : (it.color ? it.color.trim().replace(/\s+/g, ' ') : null);
          const canonicalSize = matchedVariant?.size ? matchedVariant.size.trim() : (it.size ? it.size.trim().replace(/\s+/g, ' ') : null);
          const masterPrice = resolveMasterPrice(inv, canonicalColor, canonicalSize);

          if (acceptedQty <= 0) {
            results.push({ productName: it.productName, status: 'ZERO_ACCEPTED', acceptedQty: 0 });
            updatedDemandItems.push({ ...it, acceptedQty: 0, inTransitQty: 0 });
            continue;
          }

          // ─── Step 1: Search for an existing ACTIVE OutletInventory record ───
          let oi = null;

          // 1a. By canonical variant barcode (ACTIVE only)
          if (variantBarcode) {
            oi = await tx.outletInventory.findFirst({
              where: {
                outletName: existing.outletName,
                barcode: variantBarcode,
                isActive: true,
                deletedAt: null
              }
            });
          }

          // 1b. By product name + normalized color + normalized size (ACTIVE only)
          if (!oi) {
            const activeOutletItems = await tx.outletInventory.findMany({
              where: {
                outletName: existing.outletName,
                name: { equals: inv.name, mode: 'insensitive' },
                isActive: true,
                deletedAt: null
              }
            });
            oi = activeOutletItems.find(o =>
              normStr(o.color) === itemColorNorm &&
              normStr(o.size) === itemSizeNorm
            ) || null;
          }

          // 1c. By metadata sourceStoreItemId + color + size (ACTIVE only)
          if (!oi && inv.id) {
            const metaOutletItems = await tx.outletInventory.findMany({
              where: {
                outletName: existing.outletName,
                isActive: true,
                deletedAt: null,
                metadata: { contains: inv.id }
              }
            });
            oi = metaOutletItems.find(o =>
              normStr(o.color) === itemColorNorm &&
              normStr(o.size) === itemSizeNorm
            ) || null;
          }

          // ─── Step 2: If NO active record found, check for an ARCHIVED/SOFT-DELETED record to REACTIVATE ───
          if (!oi) {
            let archived = null;
            if (variantBarcode) {
              archived = await tx.outletInventory.findFirst({
                where: {
                  outletName: existing.outletName,
                  barcode: variantBarcode,
                  OR: [{ isActive: false }, { deletedAt: { not: null } }]
                }
              });
            }
            if (!archived) {
              const allOutletItems = await tx.outletInventory.findMany({
                where: {
                  outletName: existing.outletName,
                  name: { equals: inv.name, mode: 'insensitive' },
                  OR: [{ isActive: false }, { deletedAt: { not: null } }]
                }
              });
              archived = allOutletItems.find(o =>
                normStr(o.color) === itemColorNorm &&
                normStr(o.size) === itemSizeNorm
              ) || null;
            }
            if (archived) {
              oi = archived;
            }
          }

          // ─── Step 3: Update existing or reactivated record ───
          if (oi) {
            const prevStock = oi.stock || 0;
            const newStock = prevStock + acceptedQty;
            const updateData = {
              stock: newStock,
              isActive: true,
              deletedAt: null
            };

            const currentPrice = parseFloat(oi.price);
            if ((Number.isNaN(currentPrice) || currentPrice <= 0) && masterPrice != null) {
              updateData.price = masterPrice;
            }

            // Sync canonical barcode if safe
            if (variantBarcode && oi.barcode !== variantBarcode) {
              const barcodeCollision = await tx.outletInventory.findFirst({
                where: {
                  outletName: existing.outletName,
                  barcode: variantBarcode,
                  id: { not: oi.id }
                }
              });
              if (!barcodeCollision) {
                updateData.barcode = variantBarcode;
              } else if (barcodeCollision.isActive === false || barcodeCollision.deletedAt !== null) {
                // Free up the canonical barcode from the old deleted row
                await tx.outletInventory.update({
                  where: { id: barcodeCollision.id },
                  data: { barcode: `${variantBarcode}_archived_${Date.now()}` }
                });
                updateData.barcode = variantBarcode;
              }
            } else if (!oi.barcode && variantBarcode) {
              updateData.barcode = variantBarcode;
            }

            if (canonicalColor && (!oi.color || normStr(oi.color) !== normStr(canonicalColor))) {
              updateData.color = canonicalColor;
            }
            if (canonicalSize && (!oi.size || normStr(oi.size) !== normStr(canonicalSize))) {
              updateData.size = canonicalSize;
            }
            if (inv.category && (!oi.category || normStr(oi.category) !== normStr(inv.category))) {
              updateData.category = inv.category;
            }

            await tx.outletInventory.update({
              where: { id: oi.id },
              data: updateData
            });

            await recordInventoryMovement({
              movementType: 'TRANSFER_IN',
              location: existing.outletName,
              productId: oi.id,
              productName: oi.name,
              color: oi.color,
              size: oi.size,
              barcode: updateData.barcode || oi.barcode || variantBarcode,
              previousQty: prevStock,
              newQty: newStock,
              difference: acceptedQty,
              referenceId: transferNumber,
              notes: `Outlet demand received from Warehouse (${acceptedQty} units accepted)`,
              performedBy: req.user?.name || 'Staff',
              tx
            });

            results.push({
              productName: it.productName,
              color: it.color,
              size: it.size,
              status: 'ACCEPTED',
              qty: acceptedQty,
              action: 'UPDATED'
            });
          } else {
            // ─── Step 4: Create new record if none exists ───
            let bc = variantBarcode || generateBarcode(inv.id, canonicalSize, canonicalColor);
            let attempt = 0;
            while (await tx.outletInventory.findFirst({ where: { outletName: existing.outletName, barcode: bc } })) {
              attempt++;
              bc = generateBarcode(inv.id, canonicalSize, canonicalColor, attempt);
              if (attempt > 25) {
                bc = `POS${Date.now().toString(36).toUpperCase().slice(-6)}${attempt}`;
                break;
              }
            }

            const created = await tx.outletInventory.create({
              data: {
                outletName: existing.outletName,
                name: inv.name,
                category: inv.category || '',
                color: canonicalColor,
                size: canonicalSize,
                fabric: inv.fabric || null,
                barcode: bc,
                stock: acceptedQty,
                price: masterPrice != null ? masterPrice : (parseFloat(inv.price) || 0),
                metadata: JSON.stringify({ sourceStoreItemId: inv.id }),
                isActive: true,
                deletedAt: null
              }
            });

            await recordInventoryMovement({
              movementType: 'TRANSFER_IN',
              location: existing.outletName,
              productId: created.id,
              productName: created.name,
              color: created.color,
              size: created.size,
              barcode: bc,
              previousQty: 0,
              newQty: acceptedQty,
              difference: acceptedQty,
              referenceId: transferNumber,
              notes: `Outlet demand received from Warehouse (${acceptedQty} units created)`,
              performedBy: req.user?.name || 'Staff',
              tx
            });

            results.push({
              productName: it.productName,
              color: it.color,
              size: it.size,
              status: 'ACCEPTED',
              qty: acceptedQty,
              action: 'CREATED'
            });
          }

          updatedDemandItems.push({
            ...it,
            acceptedQty,
            inTransitQty: 0
          });
        }

        // Update items in the demand record to record accepted and clear in-transit
        await tx.outletDemandRequest.update({
          where: { id },
          data: {
            items: updatedDemandItems
          }
        });
      }, { timeout: 30000 });
    } catch (txErr) {
      if (txErr.code === 'DEMAND_ALREADY_ACCEPTED') {
        return res.status(409).json({ message: txErr.message });
      }
      throw txErr;
    }

    if (req.user?.id) {
      try {
        await prisma.auditLog.create({
          data: {
            orderId: null,
            action: 'DEMAND_REQUEST_ACCEPTED',
            details: `Demand request ${id} (${existing.transferNumber || ''}) from ${existing.outletName} accepted — ${results.length} items added to outlet inventory`,
            performedBy: req.user.id
          }
        });
      } catch (auditErr) {
        console.warn('AuditLog creation warning in demand accept:', auditErr.message);
      }
    }

    // Invalidate all relevant inventory caches
    try {
      cache.delPattern('pos:');
      cache.delPattern('warehouse:');
      cache.delPattern('products:');
      cache.delPattern('product-data:');
      cache.delPattern('outlet:');
    } catch (cacheErr) {
      console.error('Cache invalidation error after demand accept:', cacheErr);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('demand:accepted', {
        id,
        outletName,
        transferNumber,
        status: 'COMPLETED'
      });
      io.emit('demand:updated', {
        id,
        outletName,
        transferNumber,
        status: 'COMPLETED'
      });
      io.emit('abbottabad:amount-updated');
      io.emit('abbottabad:demand-accepted', { id, transferNumber, outletName });
      io.emit('inventory-updated', { source: 'demand-accept', demandId: id });
    }

    await notify.create(req, { type: 'demand', moduleName: 'Inventory View', path: '/outlet-requests', role: 'STORE', title: 'Demand Accepted', message: `Demand #${existing.transferNumber} accepted — ${results.length} items added to outlet inventory`, action: 'Demand Accepted', employeeName: req.user?.name }).catch(() => {});

    console.log(`Demand ${id} accepted: ${results.length} items added to outlet inventory`);
    res.json({ message: 'Demand accepted.', accepted: results.length, items: results });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting demand request', error: error.message });
  }
};

// ─── Enamels Delivery Boy — Demand deliveries ───────────────────────────────
// The Demand (warehouse → outlet) dispatched via channel ENAMELS is surfaced to
// the Enamels Delivery Boy profile as a Job Sheet-style list. The boy:
//   accepts (deliveryBoyAcceptedAt claim) → delivers → marks delivered (deliveredAt)
// then the receiving Outlet accepts on the Outlet Stock Request page → outlet
// inventory is added (acceptDemandRequest). No re-deduction ever happens here —
// warehouse stock was already deducted once at dispatch.

const buildDemandJobSheet = (d) => {
  let items = [];
  try {
    items = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []);
  } catch { items = []; }
  const rows = (items || []).map((it) => ({
    productName: it.productName,
    color: it.color || null,
    size: it.size || null,
    quantity: parseInt(it.approvedQty != null ? it.approvedQty : it.quantity) || 0,
    qtyRequested: parseInt(it.requestedQty) || 0,
    units: parseInt(it.approvedQty != null ? it.approvedQty : it.quantity) || 0
  }));
  return {
    id: d.id,
    transferNumber: d.transferNumber,
    outletName: d.outletName,
    status: d.status,
    deliveryChannel: d.deliveryChannel,
    deliveryBoyName: d.deliveryBoyName,
    dispatchedAt: d.dispatchedAt,
    dispatchedById: d.dispatchedById,
    deliveryBoyAcceptedAt: d.deliveryBoyAcceptedAt,
    deliveredAt: d.deliveredAt,
    acceptedAt: d.acceptedAt,
    notes: d.notes,
    storeNotes: d.storeNotes,
    items: rows,
    totalUnits: rows.reduce((s, r) => s + r.units, 0),
    productCount: rows.length
  };
};

// GET /api/demand/delivery-boy — all ENAMELS demands assigned to the boy, both
// not-yet-accepted (actionable) and already accepted/delivered (history).
const getMyDemandDeliveries = async (req, res) => {
  try {
    const demands = await prisma.outletDemandRequest.findMany({
      where: {
        deliveryChannel: 'ENAMELS',
        dispatchedAt: { not: null },
        acceptedAt: null
      },
      orderBy: [{ dispatchedAt: 'desc' }]
    });
    const deliveries = (demands || []).map(buildDemandJobSheet);
    const actionable = deliveries.filter((d) => !d.deliveryBoyAcceptedAt);
    const inTransit = deliveries.filter((d) => d.deliveryBoyAcceptedAt && !d.deliveredAt);
    const delivered = deliveries.filter((d) => d.deliveredAt);
    res.json({ deliveries, actionable, inTransit, delivered, total: deliveries.length });
  } catch (error) {
    res.status(500).json({ message: 'Error loading demand deliveries', error: error.message });
  }
};

// PUT /api/demand/delivery-boy/:id/accept — boy accepts the assignment (idempotent).
const acceptDemandDeliveryById = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.outletDemandRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Demand not found' });
    if (existing.deliveryChannel !== 'ENAMELS' || !existing.dispatchedAt || existing.acceptedAt) {
      return res.status(400).json({ message: 'This demand is not an assignable Enamels delivery.' });
    }
    await prisma.$transaction(async (tx) => {
      const claim = await tx.outletDemandRequest.updateMany({
        where: { id, deliveryBoyAcceptedAt: null },
        data: { deliveryBoyAcceptedAt: new Date(), deliveryBoyAcceptedById: req.user.id }
      });
      if (claim.count === 0) {
        const err = new Error('This delivery has already been accepted.');
        err.code = 'DEMAND_ALREADY_ACCEPTED_BY_BOY';
        throw err;
      }
      await tx.auditLog.create({
        data: {
          orderId: null,
          action: 'DEMAND_DELIVERY_ACCEPTED',
          details: `Demand ${existing.transferNumber || id} delivery accepted by delivery boy ${req.user.name || req.user.id}`,
          performedBy: req.user.id
        }
      });
    }, { timeout: 30000 });
    res.json({ message: 'Delivery accepted.' });
  } catch (error) {
    if (error.code === 'DEMAND_ALREADY_ACCEPTED_BY_BOY') {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error accepting delivery', error: error.message });
  }
};

// PUT /api/demand/delivery-boy/:id/delivered — boy delivers; requires prior accept.
const markDemandDeliveredByBoy = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.outletDemandRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Demand not found' });
    if (existing.deliveryChannel !== 'ENAMELS' || !existing.dispatchedAt || existing.acceptedAt) {
      return res.status(400).json({ message: 'This demand is not an active Enamels delivery.' });
    }
    if (!existing.deliveryBoyAcceptedAt) {
      return res.status(400).json({ message: 'Accept the delivery before marking it delivered.' });
    }
    await prisma.$transaction(async (tx) => {
      const claim = await tx.outletDemandRequest.updateMany({
        where: { id, deliveredAt: null },
        data: { deliveredAt: new Date(), deliveredById: req.user.id }
      });
      if (claim.count === 0) {
        const err = new Error('This delivery has already been marked delivered.');
        err.code = 'DEMAND_ALREADY_DELIVERED';
        throw err;
      }
      await tx.auditLog.create({
        data: {
          orderId: null,
          action: 'DEMAND_DELIVERY_BOY_DELIVERED',
          details: `Demand ${existing.transferNumber || id} delivered by delivery boy ${req.user.name || req.user.id} — awaiting outlet accept`,
          performedBy: req.user.id
        }
      });
    }, { timeout: 30000 });

    const io = req.app.get('io');
    if (io) io.emit('demand:delivered', { id, transferNumber: existing.transferNumber, outletName: existing.outletName });

    res.json({ message: 'Marked delivered. Awaiting outlet acceptance.' });
  } catch (error) {
    if (error.code === 'DEMAND_ALREADY_DELIVERED') {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error marking delivery', error: error.message });
  }
};

// GET /api/demand/history — all-scoped Enamels-delivery ledger for Admin/Faisal/Store.
// Reuses the same query shape + job-sheet serializer as the boy panel but is NOT
// user-scoped: every dispatched demand appears with its full timeline (dispatched →
// boy-accepted → boy-delivered → outlet-accepted).
const getDemandDeliveriesHistory = async (req, res) => {
  try {
    const { status, outletName, channel, deliveryBoyName, dateFrom, dateTo } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
    const where = { dispatchedAt: { not: null } };
    if (status) where.status = status;
    if (outletName) where.outletName = { contains: outletName, mode: 'insensitive' };
    if (channel) where.deliveryChannel = channel;
    if (deliveryBoyName) where.deliveryBoyName = { contains: deliveryBoyName, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.dispatchedAt = {
        ...(where.dispatchedAt || {}),
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {})
      };
    }
    const demands = await prisma.outletDemandRequest.findMany({
      where,
      orderBy: [{ dispatchedAt: 'desc' }],
      take: limit
    });
    const deliveries = (demands || []).map(buildDemandJobSheet);
    res.json({
      deliveries,
      total: deliveries.length,
      pending: deliveries.filter((d) => !d.deliveryBoyAcceptedAt && !d.deliveredAt && !d.acceptedAt).length,
      inTransit: deliveries.filter((d) => d.deliveryBoyAcceptedAt && !d.deliveredAt && !d.acceptedAt).length,
      delivered: deliveries.filter((d) => d.deliveredAt && !d.acceptedAt).length,
      completed: deliveries.filter((d) => !!d.acceptedAt).length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading demand delivery history', error: error.message });
  }
};

module.exports = { createDemandRequest, getMyDemandRequests, getAllDemandRequests, approveDemandRequest, dispatchDemandRequest, acceptDemandRequest, getInventoryForOutlet, getDemandStats, getMyDemandDeliveries, acceptDemandDeliveryById, markDemandDeliveredByBoy, getDemandDeliveriesHistory };